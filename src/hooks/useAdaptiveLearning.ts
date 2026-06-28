// =====================================================================
// PHASE 9 — useAdaptiveLearning hook (STEP 7)
//
// Consumes existing hooks; feeds pure adaptiveLearningEngine.
// No additional DB calls. Returns recommendation + health + readiness.
// Gated: only runs when adaptiveLearning flag is ON.
// =====================================================================

import { useMemo } from "react";
import { useFeature } from "./useFeatureFlags";
import { useContentScope } from "./useContentScope";
import { useLearningProgress } from "./useLearningProgress";
import { useMasterySnapshots } from "./useMasterySnapshots";
import {
  computeAdaptiveOutput,
  type AdaptiveEngineInput,
  type AdaptiveOutput,
  type ActiveMissionState,
} from "../lib/adaptiveLearningEngine";
import { EMPTY_SCOPE } from "../lib/contentDeliveryEngine";
import type { StudyMissionRow } from "../types/studyScheduler";

// ─── Empty output (flag OFF or no content) ───────────────────────────

const EMPTY_OUTPUT: AdaptiveOutput = {
  recommendation: {
    nextSubjectId: null,
    nextSubjectLabel: null,
    nextModuleId: null,
    nextModuleLabel: null,
    nextTopicId: null,
    difficulty: "easy",
    estimatedMinutes: 0,
    confidence: 0,
    priority: 0,
    reason: "randomPractice",
    reasonLabel: "Adaptive Learning is OFF",
    reviewQuestionsFirst: false,
  },
  readinessScore: { score: 0, breakdown: { coveragePct: 0, masteryPct: 0, reviewHealthPct: 0, missionCompletionPct: 0, consistencyPct: 0, accuracyPct: 0, recentActivityPct: 0, weakAreaPenalty: 0 } },
  studyHealth: { status: "green", reasons: [], examples: [] },
  examReadiness: { status: "needs-review", remainingSubjects: 0, remainingModules: 0, estimatedStudyHours: 0, confidence: 0, projectedCompletionDays: null },
  weakestSubjects: [],
  strongestSubjects: [],
  weakestModules: [],
  strongestModules: [],
  reviewDebt: 0,
  studyVelocity: 0,
  projectedCompletionDate: null,
  retentionTrend: "unknown",
};

// ─── Hook params ──────────────────────────────────────────────────────

export interface UseAdaptiveLearningParams {
  /** Active mission row from useActiveMission, or null */
  mission: StudyMissionRow | null;
  /** Due review count — from getDueQuestionIds().length in TodayView */
  reviewDueCount: number;
  /** XP balance from useXp */
  currentXp: number;
  /** Rank label from useXp */
  currentRank: string;
  /** Streak days from userData.streak_count */
  currentStreak: number;
  /** Exam date from user profile / enrollment (null if unknown) */
  examDate: Date | null;
  /** Minutes the student says they have today (default 30) */
  todayMinutesAvailable?: number;
}

export interface UseAdaptiveLearningResult extends AdaptiveOutput {
  /** false while scope or progress is loading */
  loading: boolean;
  /** true when flag is OFF */
  disabled: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAdaptiveLearning(params: UseAdaptiveLearningParams): UseAdaptiveLearningResult {
  const flagEnabled = useFeature("adaptiveLearning");
  const contentDeliveryEnabled = useFeature("contentDeliveryEngine");

  const { scope, loading: scopeLoading } = useContentScope(!!contentDeliveryEnabled);
  const { progress: learningProgress, loading: progressLoading } = useLearningProgress();
  const { snapshots, loading: snapshotsLoading } = useMasterySnapshots();

  // Build masteryMap from snapshots (subject_id → mastery %)
  const masteryMap = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const snap of snapshots) {
      m[snap.subject_id] = snap.mastery;
    }
    return m;
  }, [snapshots]);

  // Build moduleAnsweredMap from learningProgress
  const moduleAnsweredMap = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const [id, mp] of Object.entries(learningProgress.modules)) {
      m[id] = mp.answered;
    }
    return m;
  }, [learningProgress.modules]);

  // Build ActiveMissionState from mission row
  const missionState = useMemo<ActiveMissionState>(() => {
    const m = params.mission;
    if (!m || m.status === "completed" || m.status === "skipped") {
      return { isActive: false, targetSubjectId: null, targetModuleId: null, questionsRemaining: 0 };
    }
    const payload = m.payload;
    // targetCount is the total target; we can't know answered count from the row alone
    // so use full targetCount as questionsRemaining (score reflects mission urgency)
    const questionsRemaining = payload?.targetCount ?? 20;
    return {
      isActive: true,
      targetSubjectId: payload?.subjectId ?? null,
      targetModuleId: payload?.subcategoryId ?? null,
      questionsRemaining,
    };
  }, [params.mission]);

  const loading = scopeLoading || progressLoading || snapshotsLoading;

  const output = useMemo<AdaptiveOutput>(() => {
    if (!flagEnabled || loading) return EMPTY_OUTPUT;

    const effectiveScope = scope.hasContent ? scope : EMPTY_SCOPE;

    const input: AdaptiveEngineInput = {
      scope: effectiveScope,
      learningProgress,
      masteryMap,
      moduleAnsweredMap,
      reviewDueCount: params.reviewDueCount,
      missionState,
      examDate: params.examDate,
      currentDate: new Date(),
      currentXp: params.currentXp,
      currentRank: params.currentRank,
      currentStreak: params.currentStreak,
      todayMinutesAvailable: params.todayMinutesAvailable ?? 30,
    };

    return computeAdaptiveOutput(input);
  }, [flagEnabled, loading, scope, learningProgress, masteryMap, moduleAnsweredMap, params, missionState]);

  return {
    ...output,
    loading,
    disabled: !flagEnabled,
  };
}
