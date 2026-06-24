// =====================================================================
// Phase 7.1 — XP values + pure helpers (NO supabase import)
//
// Kept separate from xp.ts so pure logic is unit-testable without pulling in
// the supabase client (which throws at import time when env vars are absent,
// e.g. in CI).
// =====================================================================

export type XpEventType =
  | "question_answered"
  | "quiz_completed"
  | "mission_completed"
  | "streak_bonus"
  | "achievement_unlock";

/** Tunable award scale (balanced). Single source for all XP amounts. */
export const XP_VALUES = {
  questionCorrect: 2,
  questionWrong: 1,
  quizCompleted: 10,
  missionCompleted: 25,
  streakBonus: 5,
  achievementUnlock: 50,
} as const;

/**
 * Pure: XP for a finished quiz's questions.
 * correct answers earn more than wrong ones, but every answer earns something.
 */
export function computeQuizQuestionXp(correct: number, total: number): number {
  const c = Math.max(0, Math.min(correct, total));
  const wrong = Math.max(0, total - c);
  return c * XP_VALUES.questionCorrect + wrong * XP_VALUES.questionWrong;
}
