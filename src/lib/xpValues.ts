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

// =====================================================================
// Phase 7.3 — Rank progression (Certificate Track)
//
// Rank is DERIVED from cumulative XP, never persisted. computeRank() is pure
// so it unit-tests without supabase. Thresholds are the v1 economy (approved):
// a light user (~50 XP/day) reaches ATPL Holder in ~6 months.
// =====================================================================

export interface Rank {
  /** Certificate-track display name. */
  name: string;
  /** Cumulative XP at which this rank is reached (inclusive). */
  threshold: number;
}

/** Ordered ascending by threshold. First entry MUST be threshold 0. */
export const RANKS: readonly Rank[] = [
  { name: "Student Pilot", threshold: 0 },
  { name: "Solo Endorsed", threshold: 250 },
  { name: "PPL Rated", threshold: 750 },
  { name: "CPL Candidate", threshold: 2000 },
  { name: "ATPL Candidate", threshold: 5000 },
  { name: "ATPL Holder", threshold: 10000 },
] as const;

export interface RankProgress {
  /** Current rank for the given XP. */
  rank: Rank;
  /** Next rank up, or null at the top rank. */
  next: Rank | null;
  /** Zero-based index of the current rank in RANKS. */
  index: number;
  /** XP accumulated past the current rank's threshold. */
  xpIntoRank: number;
  /** XP span from current rank to next (0 at top rank). */
  xpForNext: number;
  /** XP remaining to reach next rank (0 at top rank). */
  xpRemaining: number;
  /** Fraction 0..1 toward next rank (1 at top rank). */
  progress: number;
  /** True when already at the highest rank. */
  isMax: boolean;
}

/** Pure: derive rank + progress-to-next from a cumulative XP balance. */
export function computeRank(xp: number): RankProgress {
  const balance = Math.max(0, Math.floor(xp));
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (balance >= RANKS[i].threshold) index = i;
    else break;
  }
  const rank = RANKS[index];
  const next = index < RANKS.length - 1 ? RANKS[index + 1] : null;
  const isMax = next === null;
  const xpIntoRank = balance - rank.threshold;
  const xpForNext = next ? next.threshold - rank.threshold : 0;
  const xpRemaining = next ? Math.max(0, next.threshold - balance) : 0;
  const progress = next ? Math.min(1, xpIntoRank / xpForNext) : 1;
  return { rank, next, index, xpIntoRank, xpForNext, xpRemaining, progress, isMax };
}

/**
 * Pure: did a balance change cross into a higher rank? Returns the newly
 * reached rank when oldXp→newXp advanced the rank index, else null. Used to
 * fire the rank-up moment. No-op (null) when XP did not move or did not cross.
 */
export function didRankUp(oldXp: number, newXp: number): Rank | null {
  if (newXp <= oldXp) return null;
  const before = computeRank(oldXp).index;
  const after = computeRank(newXp).index;
  return after > before ? RANKS[after] : null;
}
