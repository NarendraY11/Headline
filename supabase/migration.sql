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

-- 3. Create a BEFORE UPDATE trigger function on public.profiles that BLOCKS changes to the billing columns UNLESS the current role is the service_role
create or replace function public.protect_billing_fields()
returns trigger as $$
begin
  -- Only enforce this check for non-service roles
  if auth.role() <> 'service_role' then
    NEW.plan = OLD.plan;
    NEW.plan_started_at = OLD.plan_started_at;
    NEW.plan_expires_at = OLD.plan_expires_at;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- 4. Create trigger
drop trigger if exists enforce_billing_security on public.profiles;
create trigger enforce_billing_security
  before update on public.profiles
  for each row
  execute function public.protect_billing_fields();

-- 5. Add ip_address column to active_sessions for server-side IP binding.
--    Written by the service role via /api/session/check; users never set it.
alter table public.active_sessions
  add column if not exists ip_address text;
