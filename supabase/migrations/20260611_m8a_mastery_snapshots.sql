-- ============================================================
-- M8A: Adaptive Mastery Engine — snapshot foundation
--
-- Creates:
--   mastery_snapshots   — one row per (user, subject); refreshed
--                         after each quiz session. Source of truth
--                         for adaptive regen trigger comparisons.
--
-- Adds to study_plans:
--   last_regen_at       — timestamp of most recent adaptive regen
--   regen_count         — total regens performed on this plan
--   auto_regen_enabled  — user-level kill-switch for auto-regen
--
-- All mastery values are derived from user_question_attempts
-- (source of truth). This table is a cache/materialized view
-- pattern — never the source of truth for raw answer data.
-- ============================================================

-- ── mastery_snapshots ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mastery_snapshots (
  user_id          uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject_id       text        NOT NULL,

  -- lifetime aggregates (derived from user_question_attempts)
  mastery          int         NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100),
  correct_total    int         NOT NULL DEFAULT 0 CHECK (correct_total >= 0),
  answers_total    int         NOT NULL DEFAULT 0 CHECK (answers_total >= 0),

  -- 7-day sliding window for recency and regression detection
  correct_7d       int         NOT NULL DEFAULT 0 CHECK (correct_7d >= 0),
  total_7d         int         NOT NULL DEFAULT 0 CHECK (total_7d >= 0),

  -- mastery at last plan generation/re-generation (re-baselined on each regen)
  baseline_mastery int         NOT NULL DEFAULT 0 CHECK (baseline_mastery BETWEEN 0 AND 100),

  updated_at       timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, subject_id)
);

-- Covering index for per-user queries (dashboard load, mastery-check)
CREATE INDEX IF NOT EXISTS idx_mastery_snapshots_user
  ON mastery_snapshots (user_id);

-- Time-windowed index for admin aggregate queries
CREATE INDEX IF NOT EXISTS idx_mastery_snapshots_updated
  ON mastery_snapshots (user_id, updated_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE mastery_snapshots ENABLE ROW LEVEL SECURITY;

-- Users own their rows
CREATE POLICY "mastery_snapshots_user_all"
  ON mastery_snapshots
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all rows for analytics
CREATE POLICY "mastery_snapshots_admin_select"
  ON mastery_snapshots
  FOR SELECT
  USING (is_admin());

-- ── study_plans: adaptive regen metadata ────────────────────────────────────

ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS last_regen_at      timestamptz,
  ADD COLUMN IF NOT EXISTS regen_count        int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_regen_enabled boolean     NOT NULL DEFAULT true;

-- ── Grant service-role full access (admin operations) ───────────────────────
-- The RLS policies above cover authenticated users. The service-role client
-- bypasses RLS by design, so no explicit GRANT is needed. Documenting intent
-- only: service-role writes happen via the /api/study/* endpoints.
