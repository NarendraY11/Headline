// =====================================================================
// Phase 7.1 — XP ledger (append-only, authoritative)
//
// XP is NEVER recalculated from aggregates. Each award is one immutable row
// in xp_events; balance = SUM(amount). Awards are idempotent per
// (user_id, type, source_id) via a partial unique index — re-awarding the
// same source (same attempt / mission / achievement) is a no-op.
//
// Hook-free by design: callers gate on useFeature("xpSystem") before awarding,
// so this module never touches React or the auth lock.
// =====================================================================

import { supabase } from "./supabase";
import { posthogCapture } from "./posthog.js";

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

export interface XpEventRow {
  id: string;
  user_id: string;
  type: XpEventType;
  amount: number;
  source_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

/**
 * Pure: XP for a finished quiz's questions.
 * correct answers earn more than wrong ones, but every answer earns something.
 */
export function computeQuizQuestionXp(correct: number, total: number): number {
  const c = Math.max(0, Math.min(correct, total));
  const wrong = Math.max(0, total - c);
  return c * XP_VALUES.questionCorrect + wrong * XP_VALUES.questionWrong;
}

/**
 * Award XP. Idempotent: a duplicate (user_id, type, source_id) is swallowed
 * (Postgres 23505). Returns true only when a NEW row was written.
 */
export async function awardXp(
  userId: string,
  type: XpEventType,
  amount: number,
  sourceId?: string | null,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  if (!userId || amount <= 0) return false;
  const { error } = await supabase.from("xp_events").insert({
    user_id: userId,
    type,
    amount,
    source_id: sourceId ?? null,
    meta,
  });
  if (error) {
    // 23505 = unique violation = already awarded for this source. Not an error.
    if ((error as { code?: string }).code === "23505") return false;
    console.warn("awardXp failed:", error.message);
    return false;
  }
  posthogCapture("xp_awarded", { xp_type: type, amount, source_id: sourceId ?? null });
  return true;
}

/** Total XP balance = SUM(amount). ponytail: sum on read; cache only if slow. */
export async function getXpBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("xp_events")
    .select("amount")
    .eq("user_id", userId);
  if (error) throw new Error(`getXpBalance: ${error.message}`);
  return (data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);
}

/** Recent XP events, newest first. */
export async function getXpEvents(userId: string, limit = 100): Promise<XpEventRow[]> {
  const { data, error } = await supabase
    .from("xp_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getXpEvents: ${error.message}`);
  return (data as XpEventRow[]) ?? [];
}
