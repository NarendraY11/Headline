-- Phase 7.2.1 hotfix: questions without subcategory_id are valid by design.
-- user_question_attempts had subcategory_id/subject_id as NOT NULL, but the
-- questions table has subcategory_id nullable. submitQuestionAttempt passes
-- `subcategoryId || null`, so missing subcategories cause 23502 constraint
-- violations during quiz submission. subject_id has the same null risk.
alter table public.user_question_attempts
  alter column subcategory_id drop not null,
  alter column subject_id drop not null;
