-- 1. Add plan_expires_at column to public.profiles if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'plan_expires_at'
  ) then
    alter table public.profiles add column plan_expires_at timestamptz;
  end if;
end $$;

-- 2. Change plan CHECK constraint to allow ('free', 'trial', 'pro')
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'trial', 'pro'));

-- 3. Billing-column protection (SUPERSEDED).
--    The original enforce_billing_security / protect_billing_fields() trigger
--    lived here. It was partial (covered only plan, plan_started_at,
--    plan_expires_at), silently reverted instead of erroring, and skipped the
--    guard when auth.role() was NULL. It has been DROPPED and replaced by
--    trg_protect_profile_billing / protect_profile_billing_columns() — see
--    migration-rls-ownership-hardening.sql. Do not re-create the old trigger.

-- 5. Add ip_address column to active_sessions for server-side IP binding.
--    Written by the service role via /api/session/check; users never set it.
alter table public.active_sessions
  add column if not exists ip_address text;
