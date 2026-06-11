// =====================================================================
// M8A: Adaptive Mastery Engine — mastery snapshot layer
//
// snapshotMastery() computes per-subject mastery from the existing
// user_question_attempts table (source of truth) and persists a
// lightweight cache row in mastery_snapshots (one row per subject).
//
// This is NOT a duplicate progress system — it is a materialised
// view pattern. The raw answer log in user_question_attempts is
// never modified here.
//
// Derived fields (never stored):
//   delta          = mastery - baseline_mastery
//   trend          = classification of delta
//   confidence     = reliability of the mastery estimate
//   classification = CRITICAL / WEAK / DEVELOPING / STRONG
// =====================================================================

import { supabase } from "./supabase.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Row shape matching mastery_snapshots DB table. */
export interface MasterySnapshotRow {
  user_id: string;
  subject_id: string;
  mastery: number;            // 0-100, lifetime accuracy
  correct_total: number;
  answers_total: number;
  correct_7d: number;
  total_7d: number;
  baseline_mastery: number;   // mastery at last plan generation
  updated_at: string;         // ISO timestamptz
}

/** Derived fields computed client-side from MasterySnapshotRow. */
export interface MasterySnapshot extends MasterySnapshotRow {
  delta: number;
  trend: "IMPROVING" | "PROGRESSING" | "STABLE" | "REGRESSING" | "DECLINING";
  confidence: number;         // 0.0 → 1.0
  classification: "CRITICAL" | "WEAK" | "DEVELOPING" | "STRONG";
}

// ── Derived field computation ─────────────────────────────────────────────

export function deriveMasteryFields(row: MasterySnapshotRow): MasterySnapshot {
  const delta = row.mastery - row.baseline_mastery;

  let trend: MasterySnapshot["trend"];
  if (delta >= 10) trend = "IMPROVING";
  else if (delta >= 3) trend = "PROGRESSING";
  else if (delta > -3) trend = "STABLE";
  else if (delta > -10) trend = "REGRESSING";
  else trend = "DECLINING";

  // Early regression override: significant recent accuracy drop
  if (
    row.total_7d >= 5 &&
    row.correct_7d / row.total_7d < 0.5 &&
    (trend === "STABLE" || trend === "PROGRESSING")
  ) {
    trend = "REGRESSING";
  }

  const volumeFactor = Math.min(1.0, row.answers_total / 50);
  const recencyFactor =
    row.total_7d >= 10 ? 1.0
    : row.total_7d >= 5  ? 0.8
    : row.total_7d >= 2  ? 0.6
    : 0.3;
  const confidence = volumeFactor * recencyFactor;

  let classification: MasterySnapshot["classification"];
  if (row.mastery < 50) classification = "CRITICAL";
  else if (row.mastery < 65) classification = "WEAK";
  else if (row.mastery < 80) classification = "DEVELOPING";
  else classification = "STRONG";

  return { ...row, delta, trend, confidence, classification };
}

// ── snapshotMastery ───────────────────────────────────────────────────────

/**
 * Refresh mastery_snapshots for the given subjects.
 *
 * 1. Reads user_question_attempts for the listed subjects (RLS-protected).
 * 2. Aggregates lifetime + 7-day window stats.
 * 3. Reads current baseline_mastery from existing snapshots (preserve on
 *    upsert; only the adaptive-regen path re-baselines).
 * 4. Upserts one row per subject into mastery_snapshots.
 *
 * Safe to call fire-and-forget after quiz completion. Errors are
 * non-fatal — the snapshot is a cache; missing rows fall back to
 * useMasterySnapshots() → useUserProgress().
 */
export async function snapshotMastery(
  userId: string,
  subjectIds: string[]
): Promise<MasterySnapshot[]> {
  if (!userId || subjectIds.length === 0) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Fetch all-time attempts for these subjects ──────────────────────
  const { data: allAttempts, error: allErr } = await supabase
    .from("user_question_attempts")
    .select("subject_id, is_correct")
    .eq("user_id", userId)
    .in("subject_id", subjectIds);

  if (allErr) throw new Error(`snapshotMastery: all-time query failed: ${allErr.message}`);

  // ── 2. Fetch 7-day window ─────────────────────────────────────────────
  const { data: recentAttempts, error: recentErr } = await supabase
    .from("user_question_attempts")
    .select("subject_id, is_correct")
    .eq("user_id", userId)
    .in("subject_id", subjectIds)
    .gte("answered_at", sevenDaysAgo);

  if (recentErr) throw new Error(`snapshotMastery: 7d query failed: ${recentErr.message}`);

  // ── 3. Aggregate ──────────────────────────────────────────────────────
  const allTime: Record<string, { correct: number; total: number }> = {};
  const recent: Record<string, { correct: number; total: number }> = {};

  for (const row of allAttempts ?? []) {
    if (!row.subject_id) continue;
    if (!allTime[row.subject_id]) allTime[row.subject_id] = { correct: 0, total: 0 };
    allTime[row.subject_id].total++;
    if (row.is_correct) allTime[row.subject_id].correct++;
  }
  for (const row of recentAttempts ?? []) {
    if (!row.subject_id) continue;
    if (!recent[row.subject_id]) recent[row.subject_id] = { correct: 0, total: 0 };
    recent[row.subject_id].total++;
    if (row.is_correct) recent[row.subject_id].correct++;
  }

  // ── 4. Read existing baselines (preserve them on upsert) ─────────────
  const { data: existingRows } = await supabase
    .from("mastery_snapshots")
    .select("subject_id, baseline_mastery")
    .eq("user_id", userId)
    .in("subject_id", subjectIds);

  const baselines: Record<string, number> = {};
  for (const row of existingRows ?? []) {
    baselines[row.subject_id] = row.baseline_mastery;
  }

  // ── 5. Build upsert rows ──────────────────────────────────────────────
  const now = new Date().toISOString();
  const upsertRows: Omit<MasterySnapshotRow, "user_id">[] = subjectIds
    .filter((id) => allTime[id])   // skip subjects with zero attempts
    .map((subjectId) => {
      const at = allTime[subjectId] ?? { correct: 0, total: 0 };
      const rc = recent[subjectId] ?? { correct: 0, total: 0 };
      const mastery = at.total > 0 ? Math.round((at.correct / at.total) * 100) : 0;
      // baseline defaults to current mastery on first snapshot for this subject
      const baseline_mastery = baselines[subjectId] ?? mastery;

      return {
        subject_id: subjectId,
        mastery,
        correct_total: at.correct,
        answers_total: at.total,
        correct_7d: rc.correct,
        total_7d: rc.total,
        baseline_mastery,
        updated_at: now,
      };
    });

  if (upsertRows.length === 0) return [];

  const { error: upsertErr } = await supabase
    .from("mastery_snapshots")
    .upsert(
      upsertRows.map((r) => ({ ...r, user_id: userId })),
      { onConflict: "user_id,subject_id" }
    );

  if (upsertErr) throw new Error(`snapshotMastery: upsert failed: ${upsertErr.message}`);

  // ── 6. Return derived snapshots ───────────────────────────────────────
  return upsertRows.map((r) =>
    deriveMasteryFields({ ...r, user_id: userId })
  );
}

// ── getActiveSnapshotsForUser ─────────────────────────────────────────────

/**
 * Read all mastery_snapshots rows for a user from the DB.
 * Used by useMasterySnapshots() for initial load.
 */
export async function getActiveSnapshotsForUser(
  userId: string
): Promise<MasterySnapshot[]> {
  const { data, error } = await supabase
    .from("mastery_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("subject_id", { ascending: true });

  if (error) throw new Error(`getActiveSnapshotsForUser: ${error.message}`);
  return ((data ?? []) as MasterySnapshotRow[]).map(deriveMasteryFields);
}
