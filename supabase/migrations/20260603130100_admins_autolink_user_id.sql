-- Auto-populate admins.user_id on insert so every path that adds an admin
-- (client AdminSettings, api/admin/init-owner, server.ts) links the stable auth
-- uuid without code changes. Admins added before they have signed up keep
-- user_id null and rely on the email fallback in is_admin() until then.

create or replace function public.admins_link_user_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.user_id is null then
    select id into new.user_id from auth.users where email = new.email limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists admins_link_user_id_trg on public.admins;
create trigger admins_link_user_id_trg
  before insert on public.admins
  for each row execute function public.admins_link_user_id();

-- This is a trigger function, never meant to be called directly. Triggers fire
-- regardless of EXECUTE grant, so revoke direct RPC access to keep it off the
-- exposed API surface. (Do NOT do this for is_admin() — RLS calls that one.)
revoke execute on function public.admins_link_user_id() from anon, authenticated, public;
