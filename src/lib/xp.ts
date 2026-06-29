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
import { XP_VALUES, computeQuizQuestionXp, type XpEventType } from "./xpValues";

// Re-export so existing callers (QuizView, spacedRepetition) keep importing
// these from "./xp" unchanged.
export { XP_VALUES, computeQuizQuestionXp };
export type { XpEventType };

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

/** Total XP balance = SUM(amount). Server-side aggregate — no client reduce. */
export async function getXpBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("xp_events")
    .select("amount.sum()")
    .eq("user_id", userId)
    .single();
  if (error) {
    console.error("getXpBalance error:", error);
    return 0;
  }
  return (data as any)?.sum ?? 0;
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
