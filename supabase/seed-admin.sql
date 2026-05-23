-- =====================================================================
-- HEADING — ADMINISTRATIVE SEED AND BOOTSTRAP ROSTER
-- Run this AFTER schema.sql, because it needs the admins table to exist.
-- =====================================================================

-- Seed the initial master administrator account securely
insert into public.admins (email) 
values ('narendray112050@gmail.com')
on conflict (email) do nothing;
