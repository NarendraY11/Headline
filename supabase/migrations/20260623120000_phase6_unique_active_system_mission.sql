-- Phase 6 hardening: DB-level guarantee — one active engine mission per user.
--
-- Partial unique index on study_missions: only constrains rows where
--   source = 'system'  (engine missions)
--   status IN ('pending', 'in_progress')  (active lifecycle states)
--
-- AI scheduler rows (source='plan') and completed/skipped rows are unaffected.
-- CREATE UNIQUE INDEX IF NOT EXISTS = idempotent, safely rerunnable.
-- No table rewrite (partial index, zero data change on empty set).
--
-- Applied to prod DB iwamrscqmedyklafiqvu via Supabase MCP on 2026-06-23.

create unique index if not exists uniq_active_system_mission_per_user
  on study_missions (user_id)
  where source = 'system'
    and status in ('pending', 'in_progress');
