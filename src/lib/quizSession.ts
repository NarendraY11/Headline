// =====================================================================
// quizSession.ts — pure quiz completion path (no React dependencies)
//
// submitQuizSession contains the exact logic previously inside finishQuiz
// in QuizView.tsx. All React state reads are replaced with input.* fields.
// All side effects that require React (navigate, setState, addNotification,
// updateUserData) are returned in the result so the view can apply them.
//
// Preserve all FIX / Phase comments from the original finishQuiz body.
// =====================================================================

import { supabase } from "./supabase";
import { recordAnswerProgress, trackAnswerForStreakAndGoal } from "./spacedRepetition";
import { awardXp, computeQuizQuestionXp, getXpBalance, XP_VALUES } from "./xp";
import { unlockAchievement } from "./achievements";
import { completeMission } from "./studyScheduler";
import { snapshotMastery } from "./masterySnapshot";
import { submitQuestionAttempt } from "./progress";
import { trackEvent } from "./track";
import { didRankUp } from "./xpValues";
import { quizStateKey } from "./storageKeys";
import type { Question } from "../data/questions";
import type { UserData } from "../contexts/AuthContext";

export interface QuizSessionInput {
  user: { uid: string; id?: string } | null;
  userData: UserData | null;
  // updateUserData is passed through to trackAnswerForStreakAndGoal so streak
  // updates are preserved. It is a plain function reference, not a hook.
  updateUserData: (data: Partial<UserData>) => Promise<void> | void;
  questions: Question[];
  answers: Record<string, string>;
  timeElapsed: number;
  timePerQuestion: Record<string, number>;
  mode: string;
  topicId: string | null | undefined;
  customTopic: string | undefined;
  missionId: string | undefined;
  engineMission: boolean | undefined;
  logbook: any[];
  storageKey: string;
  // feature flags
  xpEnabled: boolean;
  masterySnapshotsEnabled: boolean;
  sm2AlgorithmEnabled: boolean;
  sm2QualityTimingEnabled: boolean;
  negativeMarkingEnabled: boolean;
  // FIX #11: pass current value of missionCompletedRef.current so the function
  // can guard against double-completion without touching a React ref directly.
  missionAlreadyCompleted: boolean;
}

export interface QuizSessionResult {
  attemptRecord: any;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  unlockedMilestone: { id: string; title: string; badge: string; desc: string } | null;
  xpEarned: number;
  rankUpName: string | null;
  // true when completeMission was called (and succeeded) in this invocation.
  // The view uses this to latch missionCompletedRef.current.
  missionCompleted: boolean;
  // Navigation hint — the view navigates based on this, never this module.
  navigateTo: "mission-complete" | "results";
  missionCompleteState?: { missionId: string; xpEarned: number; rankUpName: string | null };
  // React side-effects deferred to the view
  userDataUpdate: { attempts: Record<string, any> } | null;
  notificationsToAdd: Array<{ title: string; body: string; type: string }>;
}

export async function submitQuizSession(input: QuizSessionInput): Promise<QuizSessionResult> {
  const {
    user,
    userData,
    updateUserData,
    questions,
    answers,
    timeElapsed,
    timePerQuestion,
    mode,
    topicId,
    customTopic,
    missionId,
    engineMission,
    logbook,
    storageKey,
    xpEnabled,
    masterySnapshotsEnabled,
    sm2AlgorithmEnabled,
    sm2QualityTimingEnabled,
    negativeMarkingEnabled,
  } = input;

  const totalQuestions = questions.length;

  // Collect deferred React side-effects
  const notificationsToAdd: Array<{ title: string; body: string; type: string }> = [];
  let userDataUpdate: { attempts: Record<string, any> } | null = null;

  // Phase 7.3/7.4: rank-up state. xpBefore is hoisted so the single
  // didRankUp call (after the achievement block) includes achievement XP.
  let rankUpName: string | null = null;
  let xpEarnedThisFinish = 0;
  let xpBefore = 0;

  // FIX #11: local mutable copy — tracks whether completeMission was called
  // within THIS invocation (mirrors missionCompletedRef in the view).
  let missionCompleted = input.missionAlreadyCompleted;

  // M9B: compute session median response time for SM-2 quality derivation
  const sessionTimes = Object.values(timePerQuestion).filter((t) => t > 0);
  const sortedTimes = [...sessionTimes].sort((a, b) => a - b);
  const medianSessionTimeSec = sortedTimes.length > 0
    ? (sortedTimes[Math.floor(sortedTimes.length / 2)] ?? 30)
    : 30;

  // Record real attempt
  let correctCount = 0;
  const ataBreakdown: Record<string, { correct: number; total: number }> = {};
  const wrongQuestionIds: string[] = [];
  let answeredCount = 0;

  questions.forEach((q) => {
    const userSelected = answers[q.id];
    const isCorrect = userSelected === q.correct;
    if (isCorrect) {
      correctCount++;
    } else {
      wrongQuestionIds.push(q.id);
    }

    if (!ataBreakdown[q.ata]) {
      ataBreakdown[q.ata] = { correct: 0, total: 0 };
    }
    ataBreakdown[q.ata].total++;
    if (isCorrect) ataBreakdown[q.ata].correct++;

    // Record per-question performance for spaced repetition if answered
    if (userSelected) {
      answeredCount++;
      // M9B: pass response time for SM-2 quality derivation
      const qTimeSec = timePerQuestion[q.id] ?? 0;
      recordAnswerProgress(user?.uid || null, q.id, isCorrect, q.topicId,
        sm2AlgorithmEnabled ? {
          useSM2: true,
          ...(sm2QualityTimingEnabled && qTimeSec > 0 ? {
            timeSec: qTimeSec,
            medianTimeSec: medianSessionTimeSec,
            sm2QualityTiming: true,
          } : {})
        } : undefined
      );

      if (user) {
        submitQuestionAttempt(user.uid, q.id, isCorrect, q.subjectId, q.subcategoryId, q.examId);
      }
    }
  });

  if (answeredCount > 0) {
    // Track streaks and daily goal progress on submit
    trackAnswerForStreakAndGoal(user, userData, updateUserData, answeredCount, xpEnabled);
  }

  const penalty = negativeMarkingEnabled ? wrongQuestionIds.length * 0.25 : 0;
  const finalScore = Math.max(0, correctCount - penalty);
  const percentage = Math.round((finalScore / totalQuestions) * 100);

  // Track quiz_complete telemetry
  trackEvent("quiz_complete", {
    subcategoryId: topicId || undefined,
    metadata: {
      score: finalScore,
      total: totalQuestions,
      percentage,
      mode,
    }
  });

  const attemptRecord = {
    id: crypto.randomUUID(),
    topicId: topicId || "default",
    topicTitle: customTopic || questions[0]?.ata || "Quiz",
    mode,
    total: totalQuestions,
    correct: correctCount, // Store raw correct for logbook stats
    percentage,
    durationSec: timeElapsed,
    dateISO: new Date().toISOString(),
    perTopic: ataBreakdown,
    wrongQuestionIds,
    penalty,
  };

  // Clear the active session state
  localStorage.removeItem(storageKey);

  if (user) {
    const attemptUid = attemptRecord.id;
    // FIX #2: saveAttempt was called fire-and-forget. If the user navigated
    // away before the async work completed, the attempt insert and
    // completeMission call were silently dropped — mission stuck in_progress.
    // Now finishQuiz is async and we await saveAttempt() before setStatus.
    const saveAttempt = async () => {
      try {
        const { error } = await supabase
          .from("attempts")
          .insert({
            user_id: user.uid,
            topic_id: attemptUid,
            mode: attemptRecord.mode || "practice",
            score: attemptRecord.correct || 0,
            total: attemptRecord.total || 0,
            percentage: attemptRecord.percentage || 0,
            duration_sec: attemptRecord.durationSec || 0,
            wrong_question_ids: attemptRecord.wrongQuestionIds || [],
            data: attemptRecord,
          });
        if (error) {
          console.error("Could not save attempt to Supabase:", error);
        } else if (missionId && !missionCompleted) {
          // FIX #3: completeMission error was silently swallowed via .catch(()=>{}).
          // Now we await and log failures explicitly. Mission stays in_progress
          // on failure — better than silently claiming success.
          // FIX #11: missionCompleted ensures we only call completeMission once
          // per quiz session even if finishQuiz somehow re-runs (e.g. back-nav).
          missionCompleted = true;
          try {
            await completeMission(missionId, attemptUid);
          } catch (missionErr) {
            console.error("Could not complete mission:", missionErr);
            // Non-fatal: attempt is saved; mission status update is best-effort.
          }
        }
      } catch (err) {
        console.error("Could not save attempt exceptionally:", err);
      }
    };
    await saveAttempt();

    // Phase 7.1: XP awards (gated on xpSystem). Idempotent per source_id, so
    // a re-finish / back-nav never double-awards. question_answered is
    // aggregated per quiz (one row, amount = Σ per-question value).
    if (xpEnabled) {
      // Capture balance BEFORE awarding. xpBefore is hoisted to outer scope
      // so the single didRankUp call (below the achievement block) can include
      // achievement XP. awardXp is idempotent: a re-finish writes nothing,
      // awarded stays 0, and didRankUp later returns null — no phantom rank-up.
      try { xpBefore = await getXpBalance(user.uid); } catch { /* non-fatal */ }
      let awarded = 0;
      const qXp = computeQuizQuestionXp(correctCount, totalQuestions);
      if (await awardXp(user.uid, "question_answered", qXp, attemptUid)) awarded += qXp;
      if (await awardXp(user.uid, "quiz_completed", XP_VALUES.quizCompleted, attemptUid)) awarded += XP_VALUES.quizCompleted;
      if (missionId && missionCompleted) {
        if (await awardXp(user.uid, "mission_completed", XP_VALUES.missionCompleted, missionId)) awarded += XP_VALUES.missionCompleted;
      }
      xpEarnedThisFinish = awarded;
      // Phase 7.4: rank-up NOT fired here — deferred to after achievement block
      // so achievement_unlock XP can be included in the delta before didRankUp.
    }

    // M8A: refresh mastery_snapshots for subjects touched in this session.
    // Fire-and-forget — non-blocking, non-fatal.
    if (masterySnapshotsEnabled && user?.id) {
      const sessionSubjectIds = [
        ...new Set(
          questions
            .map((q) => (q as { subjectId?: string }).subjectId)
            .filter((id): id is string => !!id)
        ),
      ];
      if (sessionSubjectIds.length > 0) {
        snapshotMastery(user.id, sessionSubjectIds).catch((err) => {
          console.warn("snapshotMastery: non-critical failure:", err);
        });
      }
    }

    userDataUpdate = {
      attempts: {
        [quizStateKey(attemptUid)]: attemptRecord,
      },
    };
  } else {
    let localLogbook: any[] = [];
    try {
      const saved = localStorage.getItem("heading_logbook");
      if (saved) localLogbook = JSON.parse(saved);
    } catch {}

    const newLogbook = [...localLogbook, attemptRecord];
    localStorage.setItem("heading_logbook", JSON.stringify(newLogbook));
    localStorage.setItem("pwa_has_session", "true");
  }

  // Milestone logic:
  let localLogList: any[] = [];
  try {
    const saved = localStorage.getItem("heading_logbook");
    if (saved) localLogList = JSON.parse(saved);
  } catch {}

  const isFirstTime = logbook ? logbook.length === 0 : localLogList.length === 0;
  const currentAccuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  let unlockedMilestone: { id: string; title: string; badge: string; desc: string } | null = null;
  if (isFirstTime) {
    unlockedMilestone = {
      id: "first-flight",
      title: "Operational Clearance Unlocked",
      badge: "Opera Alpha",
      desc: "Your first training block is logged. Solid startup sequence! Clear flight telemetry is now officially running."
    };
  } else {
    const activeLogs = logbook || localLogList;
    const totalAnswersCount = activeLogs.reduce((acc: number, x: any) => acc + (x.total || 0), 0) + totalQuestions;
    const priorAnswersCount = activeLogs.reduce((acc: number, x: any) => acc + (x.total || 0), 0);

    if (totalAnswersCount >= 100 && priorAnswersCount < 100) {
      unlockedMilestone = {
        id: "centurion",
        title: "Centurion Pilot Unlocked",
        badge: "Centurion",
        desc: "You have answered over 100 high-fidelity syllabus questions. Excellent pacing density."
      };
    } else if (currentAccuracy >= 90 && totalQuestions >= 5) {
      unlockedMilestone = {
        id: "precision",
        title: "Supercritical Precision Unlocked",
        badge: "Precision Pilot",
        desc: "Completed this training block with over 90% accuracy. Optimal operational standards achieved."
      };
    }
  }

  if (unlockedMilestone) {
    notificationsToAdd.push({ title: unlockedMilestone.title, body: unlockedMilestone.desc, type: "milestone" });
    // Phase 7.4: awaited (was fire-and-forget). Awaiting lets achievement XP
    // be included in xpEarnedThisFinish before didRankUp fires. Still idempotent:
    // unlockAchievement returns false on duplicate; awardXp swallows 23505.
    if (user) {
      const uid = user.uid;
      const achId = unlockedMilestone.id;
      try {
        const wasNew = await unlockAchievement(uid, achId);
        if (wasNew && xpEnabled) {
          if (await awardXp(uid, "achievement_unlock", XP_VALUES.achievementUnlock, achId)) {
            xpEarnedThisFinish += XP_VALUES.achievementUnlock;
          }
        }
      } catch { /* non-fatal — achievement miss never blocks completion */ }
    }
  } else {
    const topicName = customTopic || questions[0]?.ata || "this module";
    notificationsToAdd.push({
      title: "Module Complete",
      body: `You scored ${Math.round(currentAccuracy)}% on ${topicName}. Keep the momentum going!`,
      type: "milestone"
    });
  }

  // Phase 7.4: single rank-up decision using FULL awarded XP for this finish
  // (question + quiz + mission + achievement). xpBefore was captured before any
  // award; xpEarnedThisFinish now includes achievement XP if it wrote.
  // Guard: user + xpEnabled + something actually written (no phantom on retry).
  if (xpEnabled && user && xpEarnedThisFinish > 0) {
    const ru = didRankUp(xpBefore, xpBefore + xpEarnedThisFinish);
    if (ru) {
      rankUpName = ru.name;
      notificationsToAdd.push({
        title: "Rank Advanced",
        body: `You reached ${ru.name}. Cleared for the next stage of training.`,
        type: "milestone"
      });
    }
  }

  // Phase 6: engine mission → go to the completion screen (readiness impact,
  // Generate Next Mission). completeMission already ran inside saveAttempt().
  if (engineMission && missionId) {
    return {
      attemptRecord,
      percentage,
      correctCount,
      totalQuestions,
      unlockedMilestone,
      xpEarned: xpEarnedThisFinish,
      rankUpName,
      missionCompleted,
      navigateTo: "mission-complete",
      missionCompleteState: { missionId, xpEarned: xpEarnedThisFinish, rankUpName },
      userDataUpdate,
      notificationsToAdd,
    };
  }

  return {
    attemptRecord,
    percentage,
    correctCount,
    totalQuestions,
    unlockedMilestone,
    xpEarned: xpEarnedThisFinish,
    rankUpName,
    missionCompleted,
    navigateTo: "results",
    userDataUpdate,
    notificationsToAdd,
  };
}
