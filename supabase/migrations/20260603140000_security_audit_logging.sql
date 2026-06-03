-- =====================================================================
-- SECURITY EVENT LOGGING + APPEND-ONLY AUDIT TRAIL
-- Adds two tamper-resistant tables and the triggers that feed them:
--   * public.security_log  — security events (auth failures, authz denials,
--     admin actions, payment events, abuse, suspicious signals).
--   * public.audit_log     — who/when/old/new for sensitive data changes.
--   * public.alert_state   — dedup ledger so the alert sweep does not spam.
--
-- Append-only guarantee: a BEFORE UPDATE OR DELETE trigger raises on both
-- tables, so NOT EVEN the service role (which bypasses RLS) can mutate a row
-- through normal paths. DELETE is permitted only inside the SECURITY DEFINER
-- retention function below, which flips a transaction-local GUC the trigger
-- checks. An attacker holding the anon key (the only key shipped to clients)
-- cannot insert, read, update, or delete these tables at all.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Append-only guard
-- ---------------------------------------------------------------------
create or replace function public.reject_log_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    -- Permit deletes only when the retention routine has opted in for this
    -- transaction. Any other DELETE (incl. via service role) is rejected.
    if current_setting('app.allow_log_purge', true) = 'on' then
      return old;
    end if;
    raise exception 'append-only: % rows cannot be deleted', tg_table_name;
  end if;
  raise exception 'append-only: % rows cannot be updated', tg_table_name;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. security_log
-- ---------------------------------------------------------------------
create table if not exists public.security_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  event_type    text not null check (char_length(event_type) between 1 and 100),
  severity      text not null default 'info'
                  check (severity in ('info', 'warn', 'error', 'critical')),
  user_id       uuid references auth.users(id) on delete set null,
  actor_email   text,
  ip            text,
  user_agent    text,
  route         text,
  http_method   text,
  status_code   int,
  metadata      jsonb not null default '{}'::jsonb
);

create index if not exists idx_security_log_occurred  on public.security_log(occurred_at desc);
create index if not exists idx_security_log_type_time on public.security_log(event_type, occurred_at desc);
create index if not exists idx_security_log_user       on public.security_log(user_id);
create index if not exists idx_security_log_ip         on public.security_log(ip);
create index if not exists idx_security_log_sev_time   on public.security_log(severity, occurred_at desc);

alter table public.security_log enable row level security;

-- Admin read only. No insert/update/delete policy => anon/authenticated have
-- no access. Server writes use the service role (bypasses RLS); DB triggers
-- write as SECURITY DEFINER (also bypasses RLS).
drop policy if exists "security_log_select" on public.security_log;
create policy "security_log_select" on public.security_log for select
  using ((select public.is_admin()));

drop trigger if exists security_log_append_only on public.security_log;
create trigger security_log_append_only
  before update or delete on public.security_log
  for each row execute function public.reject_log_mutation();

-- ---------------------------------------------------------------------
-- 3. audit_log
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid references auth.users(id) on delete set null,
  actor_email    text,
  action         text not null check (char_length(action) between 1 and 100),
  table_name     text,
  record_id      text,
  old_value      jsonb,
  new_value      jsonb,
  ip             text,
  session_id     text,
  source         text not null default 'system'
                   check (source in ('ui', 'api', 'system', 'trigger')),
  metadata       jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_log_occurred on public.audit_log(occurred_at desc);
create index if not exists idx_audit_log_actor    on public.audit_log(actor_user_id);
create index if not exists idx_audit_log_table     on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_action    on public.audit_log(action, occurred_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log for select
  using ((select public.is_admin()));

drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.reject_log_mutation();

-- ---------------------------------------------------------------------
-- 4. alert_state — one row per alert key; the sweep updates last_fired_at.
--    NOT append-only (the sweep must update it), admin-read only.
-- ---------------------------------------------------------------------
create table if not exists public.alert_state (
  alert_key      text primary key,
  last_fired_at  timestamptz not null default now(),
  last_value     numeric,
  fire_count     int not null default 1,
  updated_at     timestamptz not null default now()
);

alter table public.alert_state enable row level security;

drop policy if exists "alert_state_select" on public.alert_state;
create policy "alert_state_select" on public.alert_state for select
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 5. Audit triggers on sensitive tables
-- ---------------------------------------------------------------------

-- profiles: capture identity/role/billing changes. Runs SECURITY DEFINER so
-- the insert into audit_log lands regardless of the caller's RLS.
create or replace function public.audit_profiles_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
  old_snap jsonb := '{}'::jsonb;
  new_snap jsonb := '{}'::jsonb;
begin
  -- Only log the security-relevant columns, never the whole row (avoids
  -- copying settings blobs / PII we don't need in the trail).
  if new.email is distinct from old.email then
    old_snap := old_snap || jsonb_build_object('email', old.email);
    new_snap := new_snap || jsonb_build_object('email', new.email);
  end if;
  if new.plan is distinct from old.plan then
    old_snap := old_snap || jsonb_build_object('plan', old.plan);
    new_snap := new_snap || jsonb_build_object('plan', new.plan);
  end if;
  if new.plan_status is distinct from old.plan_status then
    old_snap := old_snap || jsonb_build_object('plan_status', old.plan_status);
    new_snap := new_snap || jsonb_build_object('plan_status', new.plan_status);
  end if;
  if new.plan_expires_at is distinct from old.plan_expires_at then
    old_snap := old_snap || jsonb_build_object('plan_expires_at', old.plan_expires_at);
    new_snap := new_snap || jsonb_build_object('plan_expires_at', new.plan_expires_at);
  end if;

  if new_snap = '{}'::jsonb then
    return new; -- nothing security-relevant changed
  end if;

  insert into public.audit_log(
    actor_user_id, actor_email, action, table_name, record_id,
    old_value, new_value, source
  ) values (
    auth.uid(),
    auth.jwt()->>'email',
    'profile.update',
    'profiles',
    old.id::text,
    old_snap,
    new_snap,
    case when auth.role() = 'service_role' then 'api' else 'ui' end
  );
  return new;
end;
$$;

drop trigger if exists audit_profiles_change on public.profiles;
create trigger audit_profiles_change
  after update on public.profiles
  for each row execute function public.audit_profiles_change();

-- admins: every grant (insert) and revoke (delete) of admin role is logged.
create or replace function public.audit_admins_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(
      actor_user_id, actor_email, action, table_name, record_id, new_value, source
    ) values (
      auth.uid(), auth.jwt()->>'email', 'admin.grant', 'admins', new.email,
      jsonb_build_object('email', new.email),
      case when auth.role() = 'service_role' then 'api' else 'ui' end
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log(
      actor_user_id, actor_email, action, table_name, record_id, old_value, source
    ) values (
      auth.uid(), auth.jwt()->>'email', 'admin.revoke', 'admins', old.email,
      jsonb_build_object('email', old.email),
      case when auth.role() = 'service_role' then 'api' else 'ui' end
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_admins_change on public.admins;
create trigger audit_admins_change
  after insert or delete on public.admins
  for each row execute function public.audit_admins_change();

-- ---------------------------------------------------------------------
-- 6. Retention purge (admin-only). Drops log rows older than N days.
--    Sets the transaction-local GUC the append-only trigger checks.
-- ---------------------------------------------------------------------
create or replace function public.purge_old_logs(retain_days int default 365)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'not authorized to purge logs';
  end if;
  perform set_config('app.allow_log_purge', 'on', true);
  delete from public.security_log where occurred_at < now() - make_interval(days => retain_days);
  delete from public.audit_log    where occurred_at < now() - make_interval(days => retain_days);
  perform set_config('app.allow_log_purge', 'off', true);
end;
$$;

-- Harden definer functions: pin search_path, revoke broad client EXECUTE. They
-- run via triggers or admin RPC, not anon PostgREST. (is_admin stays grantable;
-- see schema.sql note.)
revoke execute on function public.reject_log_mutation()      from anon, authenticated, public;
revoke execute on function public.audit_profiles_change()    from anon, authenticated, public;
revoke execute on function public.audit_admins_change()      from anon, authenticated, public;
revoke execute on function public.purge_old_logs(int)        from anon, public;
-- authenticated keeps EXECUTE on purge_old_logs so an admin can call it via
-- RPC; the in-body is_admin() check is the real gate.
