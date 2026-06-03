-- =====================================================================
-- SUSPICIOUS-ACTIVITY ALERT SWEEP
-- A pg_cron job runs run_security_sweep() every 5 minutes. It scans the
-- append-only security_log for the patterns below, dedups via alert_state,
-- and posts to Slack via pg_net using the webhook stored in Supabase Vault.
--
-- Rules:
--   A. >10 failed logins for one account in 5 min        (critical)
--   B. one IP touching >50 distinct accounts in 5 min    (critical)
--   C. bulk data access > 100 records                    (warn)
--   D. login from a new IP/location for an existing user (warn)
--   E. >3 password-reset requests for one account /15min (warn)
--   F. 401/403 error volume above baseline in 5 min      (warn)
--
-- Prereqs (already applied): pg_net + supabase_vault enabled, Vault secret
-- 'slack_security_webhook' present. Replace its placeholder value with the
-- real Slack incoming-webhook URL to turn alerts on (see SECURITY-OBSERVABILITY.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Slack notifier. No-ops until the Vault secret holds a real URL, so the
-- sweep is safe to schedule before Slack is configured.
-- ---------------------------------------------------------------------
create or replace function public.notify_slack(message text)
returns void
language plpgsql
security definer
set search_path = public, vault, extensions, net
as $$
declare
  hook text;
begin
  select decrypted_secret into hook
    from vault.decrypted_secrets
   where name = 'slack_security_webhook'
   limit 1;

  if hook is null or hook = '' or hook = 'REPLACE_ME' then
    return; -- not configured yet
  end if;

  perform net.http_post(
    url     := hook,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('text', message)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Dedup gate: fires (posts to Slack + records state) only if this alert key
-- has not fired within its cooldown window. Returns whether it fired.
-- ---------------------------------------------------------------------
create or replace function public.security_alert_fire(
  p_key          text,
  p_cooldown_min int,
  p_value        numeric,
  p_message      text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
begin
  select last_fired_at into last_at from public.alert_state where alert_key = p_key;
  if last_at is not null and last_at > now() - make_interval(mins => p_cooldown_min) then
    return false; -- still cooling down; suppress duplicate
  end if;

  insert into public.alert_state(alert_key, last_fired_at, last_value, fire_count, updated_at)
  values (p_key, now(), p_value, 1, now())
  on conflict (alert_key) do update
    set last_fired_at = now(),
        last_value    = excluded.last_value,
        fire_count    = public.alert_state.fire_count + 1,
        updated_at    = now();

  perform public.notify_slack(p_message);
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- The sweep itself.
-- ---------------------------------------------------------------------
create or replace function public.run_security_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v bigint;
begin
  -- A. Failed-login burst: >10 for one account in 5 min.
  for r in
    select actor_email, count(*) c
    from public.security_log
    where event_type = 'auth.login_failed'
      and occurred_at > now() - interval '5 minutes'
      and actor_email is not null
    group by actor_email
    having count(*) > 10
  loop
    perform public.security_alert_fire(
      'failed_login:' || r.actor_email, 30, r.c,
      format(':rotating_light: *Failed-login burst* — %s failed attempts for `%s` in 5 min.', r.c, r.actor_email));
  end loop;

  -- B. IP fan-out: one IP touching >50 distinct accounts in 5 min.
  for r in
    select ip, count(distinct actor_email) c
    from public.security_log
    where event_type like 'auth.%'
      and occurred_at > now() - interval '5 minutes'
      and ip is not null and ip <> 'anonymous'
      and actor_email is not null
    group by ip
    having count(distinct actor_email) > 50
  loop
    perform public.security_alert_fire(
      'ip_fanout:' || r.ip, 60, r.c,
      format(':rotating_light: *Credential-stuffing signal* — IP `%s` hit %s distinct accounts in 5 min.', r.ip, r.c));
  end loop;

  -- C. Bulk data access: an event reporting >100 records read.
  for r in
    select id, actor_email, user_id, (metadata->>'count')::int c
    from public.security_log
    where event_type = 'data.bulk_access'
      and occurred_at > now() - interval '5 minutes'
      and coalesce((metadata->>'count')::int, 0) > 100
  loop
    perform public.security_alert_fire(
      'bulk_access:' || coalesce(r.actor_email, r.user_id::text, r.id::text), 15, r.c,
      format(':open_file_folder: *Bulk data access* — %s records read by `%s`.', r.c, coalesce(r.actor_email, r.user_id::text, 'unknown')));
  end loop;

  -- D. New IP/location for an existing user (proxy for new-country login).
  for r in
    select s.actor_email, s.ip
    from public.security_log s
    where s.event_type = 'auth.login_success'
      and s.occurred_at > now() - interval '5 minutes'
      and s.actor_email is not null
      and s.ip is not null and s.ip <> 'anonymous'
      and not exists (
        select 1 from public.security_log h
        where h.event_type = 'auth.login_success'
          and h.actor_email = s.actor_email
          and h.ip = s.ip
          and h.occurred_at < now() - interval '5 minutes'
      )
    group by s.actor_email, s.ip
  loop
    perform public.security_alert_fire(
      'new_ip:' || r.actor_email || ':' || r.ip, 1440, null,
      format(':round_pushpin: *New-IP login* — `%s` signed in from a previously-unseen IP `%s`.', r.actor_email, r.ip));
  end loop;

  -- E. Password-reset flood: >3 for one account in 15 min.
  for r in
    select actor_email, count(*) c
    from public.security_log
    where event_type = 'auth.password_reset_requested'
      and occurred_at > now() - interval '15 minutes'
      and actor_email is not null
    group by actor_email
    having count(*) > 3
  loop
    perform public.security_alert_fire(
      'pw_reset:' || r.actor_email, 60, r.c,
      format(':warning: *Password-reset flood* — %s reset requests for `%s` in 15 min.', r.c, r.actor_email));
  end loop;

  -- F. 401/403 volume above baseline (tune the 100 threshold per traffic).
  select count(*) into v
  from public.security_log
  where status_code in (401, 403)
    and occurred_at > now() - interval '5 minutes';
  if v > 100 then
    perform public.security_alert_fire(
      'http_4xx_spike', 30, v,
      format(':warning: *Auth-error spike* — %s 401/403 responses in 5 min (baseline ~100).', v));
  end if;
end;
$$;

revoke execute on function public.notify_slack(text)                      from anon, authenticated, public;
revoke execute on function public.security_alert_fire(text,int,numeric,text) from anon, authenticated, public;
revoke execute on function public.run_security_sweep()                    from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Schedule: every 5 minutes.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('security-sweep')
      where exists (select 1 from cron.job where jobname = 'security-sweep');
    perform cron.schedule('security-sweep', '*/5 * * * *', 'select public.run_security_sweep();');
  end if;
exception when others then
  raise warning 'Could not schedule security-sweep: %', sqlerrm;
end $$;
