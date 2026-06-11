-- ============================================================
-- M8C: SM-2 Algorithm Upgrade — question_progress columns
--
-- Adds:
--   quality      smallint DEFAULT 4 CHECK (0..5)
--   review_count int      DEFAULT 0
--
-- Existing rows: quality=4 (correct/normal), review_count=seen_count.
-- SM-2 path gated behind sm2Algorithm feature flag.
-- SM-lite path unchanged when flag OFF.
-- ============================================================

ALTER TABLE question_progress
  ADD COLUMN IF NOT EXISTS quality      smallint NOT NULL DEFAULT 4
    CHECK (quality BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS review_count int      NOT NULL DEFAULT 0
    CHECK (review_count >= 0);

UPDATE question_progress
SET review_count = seen_count
WHERE review_count = 0 AND seen_count > 0;
