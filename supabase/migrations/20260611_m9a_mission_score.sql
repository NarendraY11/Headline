-- M9A: Mission Score
-- Stores quiz attempt score (0-100) on scored mission types
-- (drill / mini_test / mock). review / viva / flashcard / read stay NULL.
ALTER TABLE study_missions
  ADD COLUMN IF NOT EXISTS score smallint
    CHECK (score BETWEEN 0 AND 100);
