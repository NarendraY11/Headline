-- =====================================================================
-- SECURITY LOGGING HARDENING + AUTOMATIC RETENTION
-- Addresses advisor findings on the logging objects and schedules the
-- 365-day retention purge so the append-only tables don't grow forever.
-- =====================================================================

-- Pin search_path on the append-only guard (advisor 0011).
alter function public.reject_log_mutation() set search_path = public;

-- purge_old_logs is an ops/cron routine, not a client RPC. Remove the
-- authenticated grant so it isn't callable from the exposed API (advisor 0029);
-- only the table owner (pg_cron) and service_role can run it. The body keeps a
-- belt-and-braces authorization check.
create or replace function public.purge_old_logs(retain_days int default 365)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin()
          or auth.role() = 'service_role'
          or current_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized to purge logs';
  end if;
  perform set_config('app.allow_log_purge', 'on', true);
  delete from public.security_log where occurred_at < now() - make_interval(days => retain_days);
  delete from public.audit_log    where occurred_at < now() - make_interval(days => retain_days);
  perform set_config('app.allow_log_purge', 'off', true);
end; $$;
revoke execute on function public.purge_old_logs(int) from anon, authenticated, public;

-- Automatic 365-day retention, monthly (01:17 on the 1st, off the :00 herd).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-old-logs') then
      perform cron.unschedule('purge-old-logs');
    end if;
    perform cron.schedule('purge-old-logs', '17 1 1 * *', 'select public.purge_old_logs(365);');
  end if;
exception when others then raise warning 'Could not schedule purge-old-logs: %', sqlerrm;
end $$;
