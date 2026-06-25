-- Phase 8.2B.1: account-level push reminder preferences.
-- Opt-out model: empty {} = all reminder types enabled. A type set to false
-- under the "push" namespace is muted. Namespaced so future channels (email)
-- can be added without schema change. Client-writable: not in the
-- protect_profile_billing_columns guarded set, and profiles own-row UPDATE RLS
-- already permits a user to write their own row.
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
