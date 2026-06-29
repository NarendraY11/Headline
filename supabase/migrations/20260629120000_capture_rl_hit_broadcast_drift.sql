-- =====================================================================
-- Capture unversioned DB drift into migrations (review 2026-06-29, finding D1).
--
-- public.rl_hit() and public.broadcast_notification() — plus the rate_limits
-- table that rl_hit() depends on — existed ONLY in the remote DB and in no
-- tracked migration. Code calls them at:
--   * api/_lib/utils.ts:82      -> rl_hit(p_key, p_limit, p_window_sec)
--   * api/admin/broadcast.ts:43 -> broadcast_notification(p_title, p_message, p_type)
--   * server.ts:211             -> broadcast_notification(...)
--
-- Definitions below are copied verbatim from the live project
-- (ref iwamrscqmedyklafiqvu) via pg_get_functiondef so a fresh rebuild or
-- staging branch reproduces production exactly. Idempotent: `if not exists` +
-- `create or replace`, safe to run against the live DB.
-- =====================================================================

-- ── rate_limits: fixed-window counter buckets (rl_hit backing store) ──
create table if not exists public.rate_limits (
  bucket        text primary key,
  window_start  timestamptz not null default now(),
  count         integer     not null default 0
);

-- Server-only table: written exclusively by the SECURITY DEFINER rl_hit()
-- via the service-role client. Enable RLS with no policies so anon/auth
-- clients cannot read or write it directly.
alter table public.rate_limits enable row level security;

-- ── rl_hit: cross-instance fixed-window rate limiter ─────────────────
create or replace function public.rl_hit(p_key text, p_limit integer, p_window_sec integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.rate_limits as r (bucket, window_start, count)
    values (p_key, v_now, 1)
  on conflict (bucket) do update
    set count = case
          when r.window_start < v_now - make_interval(secs => p_window_sec) then 1
          else r.count + 1 end,
        window_start = case
          when r.window_start < v_now - make_interval(secs => p_window_sec) then v_now
          else r.window_start end
  returning r.count into v_count;
  return v_count <= p_limit;
end;
$function$;

-- ── broadcast_notification: admin/service fan-out to all profiles ────
create or replace function public.broadcast_notification(p_title text, p_message text, p_type text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_count int;
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'broadcast_notification: admin or service_role required'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.notifications (user_id, title, message, type, read)
  select id, left(p_title, 200), left(p_message, 2000),
         coalesce(nullif(p_type, ''), 'system'), false
  from public.profiles;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
