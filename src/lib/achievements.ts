// =====================================================================
// Phase 7.1 — Achievement persistence
//
// Promotes the previously-transient quiz milestones (toast-only) into durable
// rows in achievement_unlocks. Idempotent via the table PK (user_id,
// achievement_id) — re-detecting an already-unlocked achievement is a no-op.
//
// Detection logic stays in QuizView (unchanged thresholds); this module owns
// the canonical definitions + persistence so future gallery surfaces (7.3) can
// read unlock state.
// =====================================================================

import { supabase } from "./supabase";

export interface AchievementDef {
  id: string;
  title: string;
  badge: string;
  desc: string;
}

/** Canonical achievement catalog. IDs match QuizView detection. */
export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  "first-flight": {
    id: "first-flight",
    title: "Operational Clearance Unlocked",
    badge: "Opera Alpha",
    desc: "Your first training block is logged. Solid startup sequence! Clear flight telemetry is now officially running.",
  },
  centurion: {
    id: "centurion",
    title: "Centurion Pilot Unlocked",
    badge: "Centurion",
    desc: "You have answered over 100 high-fidelity syllabus questions. Excellent pacing density.",
  },
  precision: {
    id: "precision",
    title: "Supercritical Precision Unlocked",
    badge: "Precision Pilot",
    desc: "Completed this training block with over 90% accuracy. Optimal operational standards achieved.",
  },
};

/**
 * Idempotently record an achievement unlock.
 * Returns true only when NEWLY unlocked (so the caller can fire the toast +
 * XP award exactly once). A duplicate (PK conflict, 23505) returns false.
 */
export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  if (!userId || !achievementId) return false;
  const { error } = await supabase
    .from("achievement_unlocks")
    .insert({ user_id: userId, achievement_id: achievementId });
  if (error) {
    if ((error as { code?: string }).code === "23505") return false; // already unlocked
    console.warn("unlockAchievement failed:", error.message);
    return false;
  }
  return true;
}

/** All achievement ids the user has unlocked. */
export async function getUnlockedAchievements(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("achievement_unlocks")
    .select("achievement_id")
    .eq("user_id", userId);
  if (error) throw new Error(`getUnlockedAchievements: ${error.message}`);
  return (data ?? []).map((r) => r.achievement_id as string);
}
