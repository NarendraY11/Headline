-- =====================================================================
-- Phase 8.2B.2 — scheduled trigger for mission-reminders (SHIPPED DISABLED).
--
-- run_mission_reminders(): POSTs to the mission-reminders Edge Function with
-- the service role as X-Internal-Secret (same server-auth as send-push). Reads
-- project URL + service key from Vault so no secret is hard-coded.
--
-- The cron job is intentionally NOT scheduled by this migration. Enable it ONLY
-- after manual verification (see bottom). Single daily evening send.
-- =====================================================================

create or replace function public.run_mission_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url     text;
  service_key  text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if base_url is null or service_key is null then
    raise notice 'run_mission_reminders: project_url / service_role_key not in Vault — skipping';
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/functions/v1/mission-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-Internal-Secret', service_key
               ),
    body    := jsonb_build_object('dryRun', false)
  );
end;
$$;

revoke execute on function public.run_mission_reminders() from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- ENABLE (run manually only AFTER verification):
--   1. VAPID keys set (Vercel VITE_VAPID_PUBLIC_KEY + Supabase secrets)
--   2. Vault has project_url + service_role_key
--   3. ≥1 real push_subscription exists
--   4. mission-reminders { dryRun:true } returns a sane plan
--   5. a real send writes a push_delivery_log success row
--
-- Then schedule the single evening send (16:07 UTC ≈ 21:37 IST — off the :00
-- mark so it doesn't pile onto every other cron at the hour boundary):
--
--   select cron.schedule(
--     'mission-reminders-evening',
--     '7 16 * * *',
--     $$ select public.run_mission_reminders(); $$
--   );
--
-- Disable / roll back instantly:
--   select cron.unschedule('mission-reminders-evening');
-- ---------------------------------------------------------------------
