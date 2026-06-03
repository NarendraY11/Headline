-- =====================================================================
-- SLACK NOTIFICATIONS EXPANSION
-- Builds on 20260603150000_security_alert_sweep.sql. Adds:
--   1. Multi-channel notify_slack(message, channel) — routes to a per-channel
--      Vault webhook (security | revenue | ops | digest), falling back to the
--      security webhook so nothing is silently dropped.
--   2. run_ops_sweep() — abuse-block / rate-limit bursts → #ops (every 5 min).
--   3. run_daily_digest() — 24h business pulse (revenue, signups, Pro, trials,
--      security) → #digest (daily).
--
-- Vault secrets (set the ones you want; security is the fallback for all):
--   slack_security_webhook  (already exists)
--   slack_revenue_webhook   slack_ops_webhook   slack_digest_webhook
-- Add new ones with:
--   select vault.create_secret('https://hooks.slack.com/services/...',
--                              'slack_revenue_webhook', 'revenue alerts');
-- See docs/security-observability.md §2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Multi-channel notifier. Replaces the single-channel notify_slack(text).
--    Drop the old 1-arg overload first so a one-arg call resolves to this
--    2-arg form (default channel) instead of staying ambiguous.
-- ---------------------------------------------------------------------
drop function if exists public.notify_slack(text);

create or replace function public.notify_slack(message text, channel text default 'security')
returns void
language plpgsql
security definer
set search_path = public, vault, extensions, net
as $$
declare
  secret_name text;
  hook text;
begin
  secret_name := case channel
    when 'revenue' then 'slack_revenue_webhook'
    when 'ops'     then 'slack_ops_webhook'
    when 'digest'  then 'slack_digest_webhook'
    else                'slack_security_webhook'
  end;

  select decrypted_secret into hook
    from vault.decrypted_secrets where name = secret_name limit 1;

  -- Fall back to the security webhook if this channel has no configured secret,
  -- so a missing per-channel hook degrades to "all in one channel" not "lost".
  if hook is null or hook = '' or hook = 'REPLACE_ME' then
    select decrypted_secret into hook
      from vault.decrypted_secrets where name = 'slack_security_webhook' limit 1;
  end if;

  if hook is null or hook = '' or hook = 'REPLACE_ME' then
    return; -- nothing configured yet; no-op
  end if;

  perform net.http_post(
    url     := hook,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('text', message)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Dedup gate gains a channel arg. Drop the old 4-arg overload so existing
--    4-arg calls in run_security_sweep() resolve to this form (default channel).
-- ---------------------------------------------------------------------
drop function if exists public.security_alert_fire(text,int,numeric,text);

create or replace function public.security_alert_fire(
  p_key          text,
  p_cooldown_min int,
  p_value        numeric,
  p_message      text,
  p_channel      text default 'security'
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

  perform public.notify_slack(p_message, p_channel);
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Ops sweep: operational/abuse bursts → #ops. Separate from the security
--    sweep so its thresholds and channel can be tuned independently.
-- ---------------------------------------------------------------------
create or replace function public.run_ops_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  -- Abuse-block burst (global): honeypot / form rate-limit / attack-pattern.
  select count(*) into v
  from public.security_log
  where event_type = 'abuse.blocked'
    and occurred_at > now() - interval '5 minutes';
  if v > 20 then
    perform public.security_alert_fire(
      'abuse_burst', 30, v,
      format(':no_entry: *Abuse-block burst* — %s submissions blocked (honeypot/rate-limit/attack) in 5 min.', v),
      'ops');
  end if;

  -- Rate-limit burst (global).
  select count(*) into v
  from public.security_log
  where event_type = 'ratelimit.exceeded'
    and occurred_at > now() - interval '5 minutes';
  if v > 50 then
    perform public.security_alert_fire(
      'ratelimit_burst', 30, v,
      format(':vertical_traffic_light: *Rate-limit burst* — %s rate-limit rejections in 5 min.', v),
      'ops');
  end if;

  -- Single-device eviction spike (one user repeatedly kicked = session theft / shared creds).
  select count(*) into v
  from public.security_log
  where event_type = 'session.superseded'
    and occurred_at > now() - interval '5 minutes';
  if v > 30 then
    perform public.security_alert_fire(
      'eviction_burst', 30, v,
      format(':iphone: *Session-eviction spike* — %s single-device evictions in 5 min (shared/leaked credentials?).', v),
      'ops');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Daily digest: 24h business pulse → #digest.
-- ---------------------------------------------------------------------
create or replace function public.run_daily_digest()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  since          timestamptz := now() - interval '24 hours';
  new_signups    int;
  new_pro        int;
  downgrades     int;
  trials_started int;
  active_pro     int;
  revenue_paise  bigint;
  payment_count  int;
  abuse_blocked  int;
  crit_events    int;
  msg            text;
begin
  select count(*) into new_signups    from public.profiles where created_at >= since;
  select count(*) into new_pro        from public.plan_changes where new_plan = 'pro'  and created_at >= since;
  select count(*) into downgrades     from public.plan_changes where new_plan = 'free' and created_at >= since;
  select count(*) into trials_started from public.profiles where trial_started_at >= since;
  select count(*) into active_pro     from public.profiles where plan = 'pro' and plan_status = 'active';

  select coalesce(sum(amount), 0), count(*)
    into revenue_paise, payment_count
    from public.payments
   where created_at >= since and status in ('paid', 'captured');

  select count(*) into abuse_blocked from public.security_log
   where event_type = 'abuse.blocked' and occurred_at >= since;
  select count(*) into crit_events   from public.security_log
   where severity = 'critical' and occurred_at >= since;

  msg := format(
    E':bar_chart: *Daily digest — last 24h*\n'
    || E'• :money_with_wings: Revenue: ₹%s from %s payment(s)\n'
    || E'• :rocket: New Pro: %s   |   :arrow_down: Downgrades: %s\n'
    || E'• :seedling: Signups: %s   |   :hourglass_flowing_sand: Trials started: %s\n'
    || E'• :crown: Active Pro subscribers: %s\n'
    || E'• :shield: Critical security events: %s   |   :no_entry: Abuse blocked: %s',
    to_char(revenue_paise / 100.0, 'FM999,999,990.00'),
    payment_count, new_pro, downgrades, new_signups, trials_started, active_pro,
    crit_events, abuse_blocked
  );

  perform public.notify_slack(msg, 'digest');
end;
$$;

-- ---------------------------------------------------------------------
-- Lock down: API-facing roles must never call these directly.
-- ---------------------------------------------------------------------
revoke execute on function public.notify_slack(text, text)                        from anon, authenticated, public;
revoke execute on function public.security_alert_fire(text,int,numeric,text,text)  from anon, authenticated, public;
revoke execute on function public.run_ops_sweep()                                 from anon, authenticated, public;
revoke execute on function public.run_daily_digest()                              from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Schedule: ops sweep every 5 min; digest once daily at 03:00 UTC (08:30 IST).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('ops-sweep')
      where exists (select 1 from cron.job where jobname = 'ops-sweep');
    perform cron.schedule('ops-sweep', '*/5 * * * *', 'select public.run_ops_sweep();');

    perform cron.unschedule('daily-digest')
      where exists (select 1 from cron.job where jobname = 'daily-digest');
    perform cron.schedule('daily-digest', '0 3 * * *', 'select public.run_daily_digest();');
  end if;
exception when others then
  raise warning 'Could not schedule ops-sweep/daily-digest: %', sqlerrm;
end $$;
