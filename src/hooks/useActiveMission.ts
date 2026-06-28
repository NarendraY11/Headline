// =====================================================================
// Phase 6 — Mission Activation Engine: useActiveMission
//
// Surfaces the user's single active (pending/in_progress) engine mission and
// the imperative generate / resume / abandon actions.
//
// AUTH SAFETY (see auth-deadlock-root-cause): every supabase read/write lives
// inside a useCallback and is invoked from useEffect — NEVER inside the
// onAuthStateChange callback. The hook early-returns until the flag is ON and
// useAuth() has resolved a userId, so no query fires before auth is ready and
// there is no cold-load fetch loop.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import {
  abandonEngineMission,
  createEngineMission,
  getActiveEngineMission,
  getLatestCompletedMissionToday,
  startEngineMission,
} from "../lib/studyScheduler";
import { launchMission } from "../lib/launchMission";
import { deriveEngineMission, deriveEngineMissionFromScope } from "../config/missionConfig";
import { useContentScope } from "./useContentScope";
import {
  trackMissionAbandoned,
  trackMissionCreated,
  trackMissionResumed,
  type MissionEventContext,
} from "../lib/studyAnalytics";
import type { StudyMissionRow } from "../types/studyScheduler";
import type { ContentScope } from "../lib/contentDeliveryEngine";

export interface GenerateInputs {
  targetExam: string | null | undefined;
  /** subjectId → mastery 0..100 */
  mastery: Record<string, number>;
  dailyGoal?: number;
  /** Current readiness score 0-100, captured as the impact baseline. */
  readinessScore: number;
  careerObjective?: string | null;
}

export interface UseActiveMissionResult {
  mission: StudyMissionRow | null;
  /** Phase 8.1: most recent system mission completed today (UTC), or null.
   *  Prevents Today from immediately falling back to "Generate" after same-day completion. */
  completedToday: StudyMissionRow | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  generate: (inputs: GenerateInputs) => Promise<StudyMissionRow | null>;
  resume: (mission: StudyMissionRow, navigate: NavigateFunction, inputs: GenerateInputs) => Promise<void>;
  abandon: (mission: StudyMissionRow, inputs: GenerateInputs) => Promise<void>;
  refetch: () => void;
}

function ctxOf(inputs: GenerateInputs, mission: StudyMissionRow | null): MissionEventContext {
  return {
    primaryTrack: inputs.targetExam ?? null,
    careerObjective: inputs.careerObjective ?? null,
    missionType: mission?.type ?? null,
    subject: mission?.payload?.subjectId ?? null,
    accuracy: mission?.score ?? null,
  };
}

/**
 * Phase 9.2: accepts optional pre-resolved scope from TodayView to skip the
 * internal useContentScope DB fetch. ActiveMissionCard (which doesn't hoist)
 * omits this param and keeps its own fetch.
 */
export function useActiveMission(preResolvedScope?: ContentScope): UseActiveMissionResult {
  const engineEnabled = useFeature("missionEngine");
  const contentDeliveryEnabled = useFeature("contentDeliveryEngine");
  // Skip internal fetch when caller provides scope.
  const { scope: internalScope } = useContentScope(!preResolvedScope && !!contentDeliveryEnabled);
  const scope = preResolvedScope ?? internalScope;
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [mission, setMission] = useState<StudyMissionRow | null>(null);
  const [completedToday, setCompletedToday] = useState<StudyMissionRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!engineEnabled || !userId) return;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const [row, todayRow] = await Promise.all([
        getActiveEngineMission(userId),
        getLatestCompletedMissionToday(userId),
      ]);
      if (active) {
        setMission(row);
        setCompletedToday(todayRow);
      }
    } catch {
      if (active) setError("Failed to load your mission.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [engineEnabled, userId]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.((fn) => fn?.()); };
  }, [load]);

  const generate = useCallback(
    async (inputs: GenerateInputs): Promise<StudyMissionRow | null> => {
      if (!engineEnabled || !userId || busy) return null;
      setBusy(true);
      setError(null);
      try {
        const draft = contentDeliveryEnabled && scope.hasContent
          ? deriveEngineMissionFromScope({ scope, mastery: inputs.mastery, dailyGoal: inputs.dailyGoal })
          : deriveEngineMission({ targetExam: inputs.targetExam, mastery: inputs.mastery, dailyGoal: inputs.dailyGoal });
        const row = await createEngineMission(userId, draft, inputs.readinessScore);
        setMission(row);
        trackMissionCreated(row.id, ctxOf(inputs, row));
        return row;
      } catch {
        setError("Could not generate a mission. Please try again.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [engineEnabled, contentDeliveryEnabled, scope, userId, busy]
  );

  const resume = useCallback(
    async (m: StudyMissionRow, navigate: NavigateFunction, inputs: GenerateInputs): Promise<void> => {
      if (busy) return;
      setBusy(true);
      try {
        await startEngineMission(m);
        trackMissionResumed(m.id, ctxOf(inputs, m));
        // launchMission also flips in_progress + fires mission_started, then navigates.
        // The engineMission flag tells QuizView to route to the mission completion
        // screen (instead of its default results view) when the quiz finishes.
        await launchMission(m, navigate, userId, { engineMission: true });
      } catch {
        setError("Could not start the mission.");
      } finally {
        setBusy(false);
      }
    },
    [busy, userId]
  );

  const abandon = useCallback(
    async (m: StudyMissionRow, inputs: GenerateInputs): Promise<void> => {
      if (busy) return;
      setBusy(true);
      try {
        await abandonEngineMission(m.id);
        trackMissionAbandoned(m.id, ctxOf(inputs, m));
        setMission(null);
      } catch {
        setError("Could not abandon the mission.");
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  return { mission, completedToday, loading, error, busy, generate, resume, abandon, refetch: load };
}
