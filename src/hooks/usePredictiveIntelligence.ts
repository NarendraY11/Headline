// M11: usePredictiveIntelligence — aggregates existing hook data and runs
// predictive algorithms client-side. No new API calls.

import { useMemo } from "react";
import { useFeature } from "./useFeatureFlags";
import { useMasterySnapshots } from "./useMasterySnapshots";
import { useExamReadiness } from "./useExamReadiness";
import { useMasteryHistory } from "./useMasteryHistory";
import {
  computePredictiveIntelligence,
  type PredictiveIntelligenceResult,
} from "../lib/predictiveIntelligence";
import type { MasterySnapshot } from "../lib/masterySnapshot";

export interface UsePredictiveIntelligenceState {
  result: PredictiveIntelligenceResult | null;
  loading: boolean;
  enabled: boolean;
}

/**
 * Phase 9.2: accepts optional pre-fetched snapshots to skip internal
 * useMasterySnapshots fetch and pass through to useExamReadiness.
 */
export function usePredictiveIntelligence(
  subjectsCount: number,
  subjectTitleMap: Record<string, string>,
  preSnapshots?: MasterySnapshot[]
): UsePredictiveIntelligenceState {
  const enabled = useFeature("predictiveIntelligence");
  const { snapshots: internalSnapshots, loading: snapshotsLoading } = useMasterySnapshots(!!preSnapshots);
  const snapshots = preSnapshots ?? internalSnapshots;
  const examReadiness = useExamReadiness(subjectsCount, preSnapshots);
  const masteryHistory = useMasteryHistory(8);

  const loading = (preSnapshots ? false : snapshotsLoading) || examReadiness.loading || masteryHistory.loading;

  const result = useMemo((): PredictiveIntelligenceResult | null => {
    if (!enabled) return null;
    if (loading) return null;
    if (snapshots.length === 0) return null;

    return computePredictiveIntelligence(
      { score: examReadiness.score, band: examReadiness.band, components: examReadiness.components },
      snapshots,
      subjectTitleMap,
      masteryHistory.velocityPerWeek
    );
  // subjectTitleMap excluded from deps intentionally — display-only labels,
  // not algorithmic inputs; map reference changes every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loading, snapshots, examReadiness.score, examReadiness.band, examReadiness.components, masteryHistory.velocityPerWeek]);

  return { result, loading: enabled ? loading : false, enabled };
}
