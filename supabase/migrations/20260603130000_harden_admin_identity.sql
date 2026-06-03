-- Harden admin identity: key the admins roster on the stable auth user_id
-- (uuid) in addition to email. is_admin() now matches by user_id OR email, so
-- existing email-based admins keep working with zero lockout risk while checks
-- prefer the immutable uuid (emails can change / re-verify).
--
-- EXECUTE grants on is_admin() are preserved by CREATE OR REPLACE — do NOT
-- revoke them; every RLS policy calls this function.

alter table public.admins
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- Backfill from the verified auth users by email.
update public.admins a
set user_id = u.id
from auth.users u
where u.email = a.email and a.user_id is null;

create unique index if not exists admins_user_id_key
  on public.admins (user_id) where user_id is not null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.admins
    where (user_id is not null and user_id = auth.uid())
       or email = auth.jwt()->>'email'
  );
$$;
