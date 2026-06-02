-- =============================================================================
-- Admin Notifications: targeted (personal/group) admin sends + audit history.
--
-- Delivery rides the existing per-user `notifications` table (one row per
-- recipient), so the existing user bell / unread / mark-read / Supabase Realtime
-- (NotificationContext) work unchanged. This table is the admin-only AUDIT and
-- HISTORY record of what was dispatched.
--
-- Idempotent; also applied to the live project.
-- =============================================================================

create table if not exists public.admin_notifications (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references auth.users(id) on delete set null,
  recipient_ids uuid[] not null default '{}',
  message       text not null,
  type          text not null check (type in ('personal','group')),
  created_at    timestamptz not null default now()
);

alter table public.admin_notifications enable row level security;

-- Admin-only audit/history (mirrors the is_admin() pattern used across the schema).
drop policy if exists admin_notifications_select on public.admin_notifications;
create policy admin_notifications_select on public.admin_notifications
  for select using ((select public.is_admin()));

-- Insert allowed only for admins, and only stamping their own id as sender.
drop policy if exists admin_notifications_insert on public.admin_notifications;
create policy admin_notifications_insert on public.admin_notifications
  for insert with check ((select public.is_admin()) and admin_id = (select auth.uid()));
