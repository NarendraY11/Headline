-- =============================================================================
-- Security hardening: profiles billing-column lockdown + notifications DELETE.
--
-- This migration documents changes applied to the live project during the
-- permission audit. It is idempotent and safe to re-run.
--
-- Context:
--   * profiles.plan / trial columns are server-authoritative (granted only via
--     the service role in /api/payment/* , /api/payment/webhook , /api/start-trial,
--     or by an admin). The profiles_update RLS policy permits a user to UPDATE
--     their own row but CANNOT restrict which columns; without a trigger a client
--     could `UPDATE profiles SET plan='lifetime'` and bypass payment entirely.
--   * notifications previously had no DELETE policy, so users could not dismiss
--     their own notifications (deny-by-default).
-- =============================================================================

-- 1. Comprehensive billing/plan/trial column guard. Rejects client changes to
--    any billing column unless the caller is the service role or an admin.
--    Supersedes the legacy public.protect_billing_fields() trigger, which only
--    covered (plan, plan_started_at, plan_expires_at), silently reverted instead
--    of erroring, and skipped the guard when auth.role() was NULL.
create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Server (service_role) and admins may change anything.
  if (auth.role() = 'service_role') or public.is_admin() then
    return new;
  end if;

  if new.plan             is distinct from old.plan
     or new.plan_status      is distinct from old.plan_status
     or new.plan_started_at  is distinct from old.plan_started_at
     or new.plan_expires_at  is distinct from old.plan_expires_at
     or new.trial_used       is distinct from old.trial_used
     or new.trial_started_at is distinct from old.trial_started_at
     or new.trial_ends_at    is distinct from old.trial_ends_at then
    raise exception 'Billing/plan columns can only be modified by the server.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_billing on public.profiles;
create trigger trg_protect_profile_billing
  before update on public.profiles
  for each row execute function public.protect_profile_billing_columns();

-- Retire the legacy partial guard now that trg_protect_profile_billing is the
-- single authoritative billing trigger. (Drop trigger first, then the function.)
drop trigger if exists enforce_billing_security on public.profiles;
drop function if exists public.protect_billing_fields();

-- 2. Allow users to delete (dismiss) their own notifications; admins may delete
--    any. Mirrors the ownership shape of notifications_select / _update.
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete
  using (((select auth.uid()) = user_id) or (select public.is_admin()));
