// =====================================================================
// M8A: Adaptive Mastery Engine — useMasterySnapshots hook
//
// Reads mastery_snapshots from DB when masterySnapshots flag is ON.
// Falls back to useUserProgress() subjectMastery if:
//   - flag is OFF
//   - user has no snapshot rows yet (new user / pre-M8A)
//
// Exposes MasterySnapshot[] with full derived fields (delta, trend,
// confidence, classification) so dashboard components don't need to
// recompute them.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import { useUserProgress } from "../lib/progress";
import {
  deriveMasteryFields,
  getActiveSnapshotsForUser,
  type MasterySnapshot,
  type MasterySnapshotRow,
} from "../lib/masterySnapshot";

export interface UseMasterySnapshotsState {
  snapshots: MasterySnapshot[];
  loading: boolean;
  error: string | null;
  /** true when data came from mastery_snapshots DB rows */
  fromCache: boolean;
  /** Re-read from DB (e.g., after manual regen) */
  refetch: () => void;
}

export function useMasterySnapshots(): UseMasterySnapshotsState {
  const flagEnabled = useFeature("masterySnapshots");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [snapshots, setSnapshots] = useState<MasterySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Fallback: derive snapshot-shaped rows from useUserProgress
  const { stats: progressStats, loading: progressLoading } = useUserProgress();

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    // ── Flag OFF or no userId → use progress fallback ──────────────────
    if (!flagEnabled) {
      const fallback = buildFallbackSnapshots(userId, progressStats.subjectMastery);
      setSnapshots(fallback);
      setFromCache(false);
      setLoading(false);
      return;
    }

    // ── Flag ON → try DB ───────────────────────────────────────────────
    try {
      const rows = await getActiveSnapshotsForUser(userId);
      if (rows.length > 0) {
        setSnapshots(rows);
        setFromCache(true);
      } else {
        // No snapshots yet (user has not completed a quiz since M8A deploy)
        const fallback = buildFallbackSnapshots(userId, progressStats.subjectMastery);
        setSnapshots(fallback);
        setFromCache(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load mastery snapshots.";
      setError(msg);
      // Fall back to progress stats on error so UI is never blank
      const fallback = buildFallbackSnapshots(userId, progressStats.subjectMastery);
      setSnapshots(fallback);
      setFromCache(false);
    } finally {
      setLoading(false);
    }
  }, [flagEnabled, userId, progressStats.subjectMastery]);

  useEffect(() => {
    if (!progressLoading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoading, userId, flagEnabled]);

  return { snapshots, loading, error, fromCache, refetch: load };
}

// ── buildFallbackSnapshots ────────────────────────────────────────────────

/**
 * Construct MasterySnapshot objects from useUserProgress.subjectMastery
 * when the flag is off or no DB rows exist. baseline_mastery = mastery
 * (delta=0, trend=STABLE) since we have no plan baseline to compare.
 */
function buildFallbackSnapshots(
  userId: string,
  subjectMastery: Record<string, number>
): MasterySnapshot[] {
  return Object.entries(subjectMastery).map(([subjectId, mastery]) => {
    const row: MasterySnapshotRow = {
      user_id: userId,
      subject_id: subjectId,
      mastery,
      correct_total: 0,    // unknown without full UQA scan
      answers_total: 0,
      correct_7d: 0,
      total_7d: 0,
      baseline_mastery: mastery,  // no baseline known → delta = 0
      updated_at: new Date().toISOString(),
    };
    return deriveMasteryFields(row);
  });
}
