-- =====================================================================
-- AUDIT FIXES — AI Study Scheduler (post-M6 release audit)
--
-- Addresses medium / low findings from the M1-M6 release readiness audit:
--
--   Fix #14 — missions_completed_ts constraint is unidirectional.
--             The old constraint only checked: completed → ts NOT NULL.
--             The reverse (non-completed → ts IS NULL) was enforced by
--             the trigger only. A trigger bug could leave completed_at
--             set on a pending/skipped mission. Make the constraint
--             bidirectional so the DB enforces both directions.
--
--   Fix #17 — study_plans DELETE policy allows users to delete plans.
--             Deletion has no audit trail, and orphans materialized
--             missions (plan_id goes NULL, source=plan missions become
--             unattributed). Users should only archive plans (status
--             update), not hard-delete them. Restrict DELETE to admins.
--
-- Additive only — no data is changed. Safe on a live DB (the constraint
-- change will reject any rows that violate the new rule, but no such
-- rows can exist because the trigger has been enforcing it since M1).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fix #14: bidirectional completed_at constraint
-- Drop the old unidirectional constraint and replace with one that
-- enforces both directions:
--   completed  → completed_at IS NOT NULL
--   !completed → completed_at IS NULL
-- ---------------------------------------------------------------------
alter table public.study_missions
  drop constraint if exists missions_completed_ts;

-- FIX #14: Bidirectional CHECK. The trigger (enforce_mission_integrity)
-- already maintains this invariant; the constraint is a belt-and-suspenders
-- DB-level guard that survives even if the trigger is ever disabled or
-- bypassed by a future service-role migration.
alter table public.study_missions
  add constraint missions_completed_ts check (
    (status = 'completed' and completed_at is not null)
    or
    (status <> 'completed' and completed_at is null)
  );

-- ---------------------------------------------------------------------
-- Fix #17: remove user DELETE on study_plans
-- Users soft-delete by setting status = 'archived'. Hard deletion has
-- no audit trail and orphans materialized missions. Restrict to admins.
-- ---------------------------------------------------------------------
drop policy if exists "study_plans_delete" on public.study_plans;

-- FIX #17: Admin-only hard delete. Users should update status to
-- 'archived' instead. The service-role materialize endpoint never
-- deletes plans, so this does not affect any automated flows.
create policy "study_plans_delete" on public.study_plans for delete
  using ((select public.is_admin()));

-- =====================================================================
-- ROLLBACK (manual):
--   -- Revert #14: drop bidirectional, restore unidirectional
--   alter table public.study_missions drop constraint missions_completed_ts;
--   alter table public.study_missions
--     add constraint missions_completed_ts
--       check (status <> 'completed' or completed_at is not null);
--
--   -- Revert #17: restore user delete policy
--   drop policy if exists "study_plans_delete" on public.study_plans;
--   create policy "study_plans_delete" on public.study_plans for delete
--     using ((select auth.uid()) = user_id or (select public.is_admin()));
-- =====================================================================
