// =====================================================================
// M8B: useExamReadiness hook
//
// Assembles inputs from three sources and calls computeExamReadiness():
//   - useMasterySnapshots()  → mastery + answersTotals per subject
//   - useUserProgress()      → streakCount (fallback for snapshots)
//   - useAuth()              → userData.lastActivityDate
//
// totalExamSubjects passed in from TodayView (subjectsList.length)
// to avoid a redundant subjects fetch inside the hook.
//
// Fires trackReadinessImproved when the band changes between renders.
// =====================================================================

import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useMasterySnapshots } from "./useMasterySnapshots";
import { useUserProgress } from "../lib/progress";
import {
  computeExamReadiness,
  readinessBand,
  type ExamReadinessResult,
} from "../lib/examReadiness";
import { trackReadinessImproved } from "../lib/studyAnalytics";

export interface UseExamReadinessResult extends ExamReadinessResult {
  loading: boolean;
}

export function useExamReadiness(totalExamSubjects: number): UseExamReadinessResult {
  const { userData } = useAuth();
  const { snapshots, loading: snapshotsLoading } = useMasterySnapshots();
  const { stats: progressStats, loading: progressLoading } = useUserProgress();

  const lastBandRef = useRef<string | null>(null);

  const loading = snapshotsLoading || progressLoading;

  // Build lookup maps from snapshots (or fallback from progressStats)
  const subjectMasteries: Record<string, number> = {};
  const answersTotals: Record<string, number> = {};

  if (snapshots.length > 0) {
    for (const s of snapshots) {
      subjectMasteries[s.subject_id] = s.mastery;
      answersTotals[s.subject_id] = s.answers_total;
    }
  } else {
    // Fallback: use progressStats when no snapshots populated yet
    for (const [subjectId, mastery] of Object.entries(progressStats.subjectMastery)) {
      subjectMasteries[subjectId] = mastery;
      answersTotals[subjectId] = 0;  // unknown — coverage uses mastery > 0 proxy
    }
  }

  const streakCount =
    (userData?.streakCount ?? 0) ||
    progressStats.streakCount ||
    0;

  const result = loading
    ? { score: 0, band: "poor" as const, components: { mastery: 0, coverage: 0, consistency: 0, recency: 0 } }
    : computeExamReadiness({
        subjectMasteries,
        answersTotals,
        totalExamSubjects,
        streakCount,
        lastActivityDate: userData?.lastActivityDate ?? "",
      });

  // Fire analytics when band changes
  useEffect(() => {
    if (loading) return;
    const newBand = readinessBand(result.score);
    if (lastBandRef.current && lastBandRef.current !== newBand) {
      trackReadinessImproved(
        lastBandRef.current as Parameters<typeof trackReadinessImproved>[1],
        newBand,
        result.score,
        result.components
      );
    }
    lastBandRef.current = newBand;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.score, loading]);

  return { ...result, loading };
}
