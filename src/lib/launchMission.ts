// =====================================================================
// AI Study Scheduler — mission / task launch resolver (Phase M5)
//
// Translates a StudyMissionRow or StudyPlanTask into a React Router
// navigate() call with the correct route + location.state payload.
//
// Route mapping (per design doc):
//   review              → /quiz/review  (SR due-queue, QuizView handles)
//   mock / mini_test    → /mock-exams
//   read                → /topic/:subjectId
//   drill / viva /
//   flashcard / quiz    → /quiz/:subjectId   (customQuestions pre-fetched)
//
// On launch: mission status flipped to in_progress.
// On finish: QuizView reads location.state.missionId and calls
//            completeMission(missionId, attemptId).
// =====================================================================

import type { NavigateFunction } from "react-router-dom";
import {
  fetchQuestionsByIds,
  fetchQuizQuestionsForTopic,
} from "./content.js";
import { getDueQuestionIds } from "./spacedRepetition.js";
import { updateMissionStatus } from "./studyScheduler.js";
import { trackMissionStarted } from "./studyAnalytics.js";
import type {
  LaunchMode,
  LaunchRoute,
  MissionType,
  StudyMissionRow,
  StudyPlanTask,
  TaskScope,
} from "../types/studyScheduler";

// ── Internal shared routing core ─────────────────────────────────────────────

interface LaunchSpec {
  route: LaunchRoute;
  mode: LaunchMode;
  type: MissionType;
  subjectId?: string | null;
  scope?: TaskScope;
  targetCount?: number | null;
}

async function resolveAndNavigate(
  spec: LaunchSpec,
  missionId: string | undefined,
  navigate: NavigateFunction,
  userId?: string | null
): Promise<void> {
  const stateBase = missionId ? { missionId } : {};

  // ── review: spaced-repetition due queue ──────────────────────────────────
  if (spec.route === "review" || spec.type === "review") {
    navigate("/quiz/review", { state: { ...stateBase, mode: spec.mode } });
    return;
  }

  // ── mock / mini_test ─────────────────────────────────────────────────────
  if (spec.route === "mock" || spec.type === "mock" || spec.type === "mini_test") {
    navigate("/mock-exams", { state: stateBase });
    return;
  }

  // ── read: topic view ─────────────────────────────────────────────────────
  if (spec.route === "topic" || spec.type === "read") {
    if (spec.subjectId) {
      navigate(`/topic/${spec.subjectId}`, { state: stateBase });
    } else {
      navigate("/modules", { state: stateBase });
    }
    return;
  }

  // ── quiz (drill / viva / flashcard) ──────────────────────────────────────
  // Pre-fetch questions so QuizView can skip its own DB round-trip and apply
  // mission-specific count + subject scope.
  const limit = spec.targetCount ?? 20;
  let questions = null;

  try {
    if (spec.scope === "due" && userId) {
      const ids = await getDueQuestionIds(userId);
      if (ids.length > 0) {
        questions = await fetchQuestionsByIds(ids.slice(0, limit));
      }
    } else if (spec.subjectId) {
      questions = await fetchQuizQuestionsForTopic(spec.subjectId, limit, true);
    }
  } catch {
    // Swallow — QuizView falls back to topic-based load from the URL param.
  }

  const topicSegment = spec.subjectId ?? "all";
  navigate(`/quiz/${topicSegment}`, {
    state: {
      ...stateBase,
      mode: spec.mode,
      ...(questions && questions.length > 0 ? { customQuestions: questions } : {}),
    },
  });
}

// ── launchMission ────────────────────────────────────────────────────────────

/**
 * Launch a StudyMissionRow as a live learning session.
 *
 * 1. Marks mission as `in_progress`.
 * 2. Resolves the correct route + question set.
 * 3. Navigates with `location.state.{ mode, missionId, customQuestions? }`.
 */
export async function launchMission(
  mission: StudyMissionRow,
  navigate: NavigateFunction,
  userId?: string | null
): Promise<void> {
  // FIX #8: Previously fire-and-forget (.catch(()=>{})). Failures were invisible
  // and the mission status machine was silently broken — mission stayed "pending"
  // but QuizView would mark it "completed", skipping "in_progress" entirely.
  // Now we await and log failures. Navigation is NOT blocked on failure (the
  // in_progress flip is cosmetic UX, not a prerequisite for the session).
  try {
    await updateMissionStatus(mission.id, "in_progress");
  } catch (err) {
    console.error("launchMission: could not set in_progress:", err);
  }

  trackMissionStarted(mission.id, mission.type, mission.payload?.subjectId);

  const { payload, type } = mission;

  await resolveAndNavigate(
    {
      route: payload.route,
      mode: payload.mode,
      type,
      subjectId: payload.subjectId,
      scope: payload.scope,
      targetCount: payload.targetCount,
    },
    mission.id,
    navigate,
    userId
  );
}

// ── launchTask ───────────────────────────────────────────────────────────────

/**
 * Launch a StudyPlanTask directly (e.g., from PlanDayCard "Start Studying").
 *
 * Does NOT mark a mission row in_progress (there may not be one yet for this
 * task — materialization is a separate step). missionId is absent in state.
 */
export async function launchTask(
  task: StudyPlanTask,
  navigate: NavigateFunction,
  userId?: string | null
): Promise<void> {
  await resolveAndNavigate(
    {
      route: task.launch.route,
      mode: task.launch.mode,
      type: task.type,
      subjectId: task.subjectId,
      scope: task.scope,
      targetCount: task.targetCount,
    },
    undefined,
    navigate,
    userId
  );
}
