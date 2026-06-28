// M11B: useForecastEngine — aggregates existing hook data for forecast algorithms

import { useMemo } from "react";
import { useFeature } from "./useFeatureFlags";
import { useMasterySnapshots } from "./useMasterySnapshots";
import { useExamReadiness } from "./useExamReadiness";
import { useMasteryHistory } from "./useMasteryHistory";
import { usePredictiveIntelligence } from "./usePredictiveIntelligence";
import {
  computeForecastEngine,
  type ForecastEngineResult,
} from "../lib/forecastEngine";
import type { MasterySnapshot } from "../lib/masterySnapshot";

export interface UseForecastEngineState {
  result: ForecastEngineResult | null;
  loading: boolean;
  enabled: boolean;
}

/**
 * Phase 9.3: accepts optional pre-fetched snapshots from TodayView to skip
 * internal useMasterySnapshots fetch. Threads snapshots through to
 * useExamReadiness and usePredictiveIntelligence (both already support skip).
 * Backward-compatible: omit snapshots to preserve standalone behavior.
 */
export function useForecastEngine(
  subjectsCount: number,
  subjectTitleMap: Record<string, string>,
  injectedSnapshots?: MasterySnapshot[]
): UseForecastEngineState {
  const enabled = useFeature("predictiveIntelligence");
  const { snapshots: ownSnapshots, loading: snapshotsLoading } = useMasterySnapshots(!!injectedSnapshots);
  const snapshots = injectedSnapshots ?? ownSnapshots;
  const examReadiness = useExamReadiness(subjectsCount, injectedSnapshots);
  const masteryHistory = useMasteryHistory(8);
  const predictive = usePredictiveIntelligence(subjectsCount, subjectTitleMap, injectedSnapshots);

  const loading = (injectedSnapshots ? false : snapshotsLoading) || examReadiness.loading || masteryHistory.loading;

  const result = useMemo((): ForecastEngineResult | null => {
    if (!enabled) return null;
    if (loading) return null;
    if (snapshots.length === 0) return null;

    const etaWeeks = predictive.result?.successForecast.etaWeeks ?? null;

    return computeForecastEngine(
      { score: examReadiness.score, band: examReadiness.band, components: examReadiness.components },
      snapshots,
      masteryHistory.weeks,
      masteryHistory.subjects,
      masteryHistory.velocityPerWeek,
      etaWeeks
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loading, snapshots, examReadiness.score, examReadiness.band, examReadiness.components,
      masteryHistory.weeks, masteryHistory.subjects, masteryHistory.velocityPerWeek,
      predictive.result?.successForecast.etaWeeks]);

  return { result, loading: enabled ? loading : false, enabled };
}
