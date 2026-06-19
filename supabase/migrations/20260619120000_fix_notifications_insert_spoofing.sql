-- =============================================================================
-- Fix: notifications INSERT allowed cross-user spoofing.
--
-- Old policy:
--   with check (auth.uid() = user_id or auth.uid() is not null)
-- The second clause is true for EVERY authenticated user, so any logged-in
-- user could insert a notification row with an arbitrary `user_id` — i.e. push
-- a forged/phishing notification into another user's bell feed.
--
-- Legitimate insert paths and why this new policy keeps them working:
--   * A user creating their OWN notification (NotificationContext) — uses
--     user_id = auth.uid(), covered by the first clause.
--   * Admin fan-out done client-side (BillingManager, NotificationsManager,
--     UsersAnalytics insert rows for other users) — covered by is_admin().
--   * Service-role broadcast_notification() bypasses RLS entirely, unaffected.
--
-- Effect: a normal user can only insert notifications addressed to themselves.
-- =============================================================================

drop policy if exists "System insert notifications" on public.notifications;
create policy "System insert notifications"
  on public.notifications for insert
  with check (
    (select auth.uid()) = user_id
    or (select public.is_admin())
  );
