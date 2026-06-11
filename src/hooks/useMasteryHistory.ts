// =====================================================================
// M8E: useMasteryHistory — weekly accuracy aggregation
//
// Fetches user_question_attempts for the last N weeks, groups by
// (subject_id, ISO-week), and returns a matrix of weekly accuracy
// percentages used by MasteryHeatmap and MasteryTrendGraph.
//
// No new table — derived entirely from existing user_question_attempts.
// Client-side aggregation (user's own RLS-filtered rows; typical window
// ≤ 2000 rows per 8-week period, well within client memory).
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

/** One data point: a week's accuracy across subjects. */
export interface MasteryHistoryPoint {
  /** Short display label e.g. "Jun 3" */
  weekLabel: string;
  /** ISO date of week's Monday */
  weekStart: string;
  /** accuracy 0-100 per subject_id; undefined = no answers that week */
  [subjectId: string]: number | string | undefined;
}

export interface UseMasteryHistoryResult {
  /** Sorted oldest → newest */
  weeks: MasteryHistoryPoint[];
  /** All subject_ids with data in the window */
  subjects: string[];
  loading: boolean;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Monday of the ISO week containing `d`. */
function weekMonday(d: Date): Date {
  const day = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon … 7=Sun
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day - 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useMasteryHistory(weeks = 8): UseMasteryHistoryResult {
  const flagEnabled = useFeature("masteryAnalytics");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [result, setResult] = useState<UseMasteryHistoryResult>({
    weeks: [],
    subjects: [],
    loading: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!flagEnabled || !userId) return;

    setResult((r) => ({ ...r, loading: true, error: null }));

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - weeks * 7);
    const windowStartISO = windowStart.toISOString();

    try {
      const { data, error } = await supabase
        .from("user_question_attempts")
        .select("subject_id, is_correct, answered_at")
        .eq("user_id", userId)
        .gte("answered_at", windowStartISO)
        .not("subject_id", "is", null);

      if (error) throw new Error(error.message);

      // Aggregate by (weekMonday, subject_id)
      const map = new Map<string, Map<string, { correct: number; total: number }>>();

      for (const row of (data ?? []) as { subject_id: string; is_correct: boolean; answered_at: string }[]) {
        const mon = weekMonday(new Date(row.answered_at));
        const weekKey = isoDate(mon);
        if (!map.has(weekKey)) map.set(weekKey, new Map());
        const subjMap = map.get(weekKey)!;
        if (!subjMap.has(row.subject_id)) subjMap.set(row.subject_id, { correct: 0, total: 0 });
        const s = subjMap.get(row.subject_id)!;
        s.total++;
        if (row.is_correct) s.correct++;
      }

      // Build week slots for the full window (even empty weeks)
      const slotKeys: string[] = [];
      const cur = weekMonday(windowStart);
      while (isoDate(cur) <= isoDate(weekMonday(new Date()))) {
        slotKeys.push(isoDate(cur));
        cur.setDate(cur.getDate() + 7);
      }
      // Keep last `weeks` slots
      const slots = slotKeys.slice(-weeks);

      // Collect all subjects with data
      const subjectSet = new Set<string>();
      map.forEach((subjMap) => subjMap.forEach((_, sid) => subjectSet.add(sid)));
      const subjects = Array.from(subjectSet).sort();

      const points: MasteryHistoryPoint[] = slots.map((weekStart) => {
        const mon = new Date(weekStart);
        const point: MasteryHistoryPoint = { weekLabel: weekLabel(mon), weekStart };
        const subjMap = map.get(weekStart);
        if (subjMap) {
          subjMap.forEach((counts, sid) => {
            point[sid] = counts.total > 0 ? Math.round((counts.correct / counts.total) * 100) : 0;
          });
        }
        return point;
      });

      setResult({ weeks: points, subjects, loading: false, error: null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load mastery history.";
      setResult({ weeks: [], subjects: [], loading: false, error: msg });
    }
  }, [flagEnabled, userId, weeks]);

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagEnabled, userId]);

  return result;
}
