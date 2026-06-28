// =====================================================================
// PHASE 9 — Adaptive Learning Engine (pure core)
//
// Decides WHAT the student should study next.
// Pure + synchronous: no React, no Supabase, no hooks.
// DB layer lives in useAdaptiveLearning hook.
//
// Priority ladder (highest → lowest):
//   1. Review Due       — SM-2 reviews overdue (immediate)
//   2. Weak Module      — mastery < WEAK_THRESHOLD in scope module
//   3. Mission Required — active mission target
//   4. Exam Proximity   — exam within URGENT_DAYS days
//   5. Continue         — resume lowest-mastery module
//   6. New Content      — unattempted modules
//   7. Reinforce        — mastery 60–79% module
//   8. Random Practice  — fallback
// =====================================================================

import type { ContentScope } from "./contentDeliveryEngine";
import type { LearningProgress, ItemProgress } from "../hooks/useLearningProgress";

// ─── Priority Weights ─────────────────────────────────────────────────
// Configurable via PRIORITY_WEIGHTS constant.
// Each factor contributes to a score; highest score wins.

export const PRIORITY_WEIGHTS = {
  reviewDue: 100,
  weakModule: 80,
  missionRequired: 70,
  examProximity: 60,
  continueLearning: 50,
  newContent: 40,
  reinforce: 30,
  randomPractice: 10,
} as const;

export type PriorityReason = keyof typeof PRIORITY_WEIGHTS;

// ─── Thresholds ───────────────────────────────────────────────────────

const WEAK_THRESHOLD = 40;         // mastery % below which a module is "weak"
const CONTINUE_THRESHOLD = 60;     // continueLearning fires below this; reinforce fires above
const REINFORCE_THRESHOLD = 80;    // mastery % below which we reinforce
const URGENT_DAYS = 7;             // days to exam that triggers exam-proximity boost
const MIN_QUESTIONS_FOR_MASTERY = 3; // minimum attempts before mastery is meaningful

// ─── Input Types ──────────────────────────────────────────────────────

export interface SubjectMastery {
  subjectId: string;
  masteryPct: number;
}

export interface ActiveMissionState {
  isActive: boolean;
  targetSubjectId: string | null;
  targetModuleId: string | null;
  questionsRemaining: number;
}

export interface AdaptiveEngineInput {
  // Content layer
  scope: ContentScope;
  // Progress layer (from useLearningProgress RPC)
  learningProgress: LearningProgress;
  // Mastery layer (from useMasterySnapshots)
  masteryMap: Record<string, number>;          // subjectId → mastery %
  moduleAnsweredMap: Record<string, number>;   // moduleId → answered count
  // Review queue
  reviewDueCount: number;
  // Mission
  missionState: ActiveMissionState;
  // Exam proximity
  examDate: Date | null;
  currentDate: Date;
  // XP / engagement
  currentXp: number;
  currentRank: string;
  currentStreak: number;
  todayMinutesAvailable: number;
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface AdaptiveRecommendation {
  nextSubjectId: string | null;
  nextSubjectLabel: string | null;
  nextModuleId: string | null;
  nextModuleLabel: string | null;
  nextTopicId: string | null;
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes: number;
  confidence: number;           // 0–100
  priority: number;             // raw priority score
  reason: PriorityReason;
  reasonLabel: string;
  reviewQuestionsFirst: boolean;
}

export interface ReadinessBreakdown {
  coveragePct: number;          // answered/total questions
  masteryPct: number;           // avg mastery across scope subjects
  reviewHealthPct: number;      // 100 - min(100, reviewDue * 5) — reviews not overdue
  missionCompletionPct: number; // mission completion rate (0 if no mission)
  consistencyPct: number;       // streak-based (streak/30 capped at 100)
  accuracyPct: number;          // correct/answered across all modules
  recentActivityPct: number;    // 100 if streak > 0, 50 if xp > 0, 0 otherwise
  weakAreaPenalty: number;       // negative: -5 per weak subject
}

export interface ReadinessScore {
  score: number;                // 0–100
  breakdown: ReadinessBreakdown;
}

export type StudyHealthStatus = "green" | "yellow" | "red";

export interface StudyHealthReason {
  code: string;
  label: string;
  severity: "info" | "warning" | "critical";
}

export interface StudyHealth {
  status: StudyHealthStatus;
  reasons: StudyHealthReason[];
  examples: string[];
}

export type ExamReadinessStatus = "ready" | "needs-review" | "at-risk";

export interface ExamReadiness {
  status: ExamReadinessStatus;
  remainingSubjects: number;
  remainingModules: number;
  estimatedStudyHours: number;
  confidence: number;           // 0–100
  projectedCompletionDays: number | null;
}

export interface AdaptiveOutput {
  recommendation: AdaptiveRecommendation;
  readinessScore: ReadinessScore;
  studyHealth: StudyHealth;
  examReadiness: ExamReadiness;
  // Analytics
  weakestSubjects: SubjectMastery[];
  strongestSubjects: SubjectMastery[];
  weakestModules: Array<{ moduleId: string; masteryPct: number; subjectId: string }>;
  strongestModules: Array<{ moduleId: string; masteryPct: number; subjectId: string }>;
  reviewDebt: number;
  studyVelocity: number;        // modules completed per week (derived from progress + streak)
  projectedCompletionDate: Date | null;
  retentionTrend: "improving" | "stable" | "declining" | "unknown";
}

// ─── STEP 3: Priority Model ───────────────────────────────────────────

interface ScoredCandidate {
  subjectId: string;
  subjectLabel: string;
  moduleId: string | null;
  moduleLabel: string | null;
  score: number;
  reason: PriorityReason;
}

function daysUntil(target: Date, from: Date): number {
  return Math.max(0, Math.round((target.getTime() - from.getTime()) / 86_400_000));
}

function scoreCandidates(input: AdaptiveEngineInput): ScoredCandidate[] {
  const {
    scope, learningProgress, masteryMap, moduleAnsweredMap,
    reviewDueCount, missionState, examDate, currentDate,
  } = input;

  const candidates: ScoredCandidate[] = [];

  for (const subject of scope.subjects) {
    const subjectMastery = masteryMap[subject.id] ?? 0;

    // Get all modules for this subject from scope
    const subjectModules = scope.modules.filter(m => m.subjectId === subject.id);

    for (const mod of subjectModules) {
      const mp: ItemProgress | undefined = learningProgress.modules[mod.id];
      const answered = mp?.answered ?? moduleAnsweredMap[mod.id] ?? 0;
      const mastery = mp?.mastery ?? 0;
      let score = 0;
      let reason: PriorityReason = "randomPractice";

      // Priority 1: Review due
      if (reviewDueCount > 0) {
        score = PRIORITY_WEIGHTS.reviewDue + reviewDueCount;
        reason = "reviewDue";
      }
      // Priority 2: Weak module
      else if (answered >= MIN_QUESTIONS_FOR_MASTERY && mastery < WEAK_THRESHOLD) {
        score = PRIORITY_WEIGHTS.weakModule + (WEAK_THRESHOLD - mastery);
        reason = "weakModule";
      }
      // Priority 3: Mission required
      else if (
        missionState.isActive &&
        missionState.targetSubjectId === subject.id &&
        (missionState.targetModuleId === null || missionState.targetModuleId === mod.id)
      ) {
        score = PRIORITY_WEIGHTS.missionRequired + missionState.questionsRemaining;
        reason = "missionRequired";
      }
      // Priority 4: Exam proximity
      else if (examDate) {
        const daysLeft = daysUntil(examDate, currentDate);
        if (daysLeft <= URGENT_DAYS && subjectMastery < 80) {
          score = PRIORITY_WEIGHTS.examProximity + (URGENT_DAYS - daysLeft);
          reason = "examProximity";
        }
      }

      if (score === 0) {
        // Priority 5: Continue learning — started module, mastery still low (<60%)
        if (answered > 0 && mastery < CONTINUE_THRESHOLD) {
          score = PRIORITY_WEIGHTS.continueLearning + (CONTINUE_THRESHOLD - mastery);
          reason = "continueLearning";
        }
        // Priority 6: New content
        else if (answered === 0) {
          score = PRIORITY_WEIGHTS.newContent + (10 - Math.min(10, subject.priority));
          reason = "newContent";
        }
        // Priority 7: Reinforce — mastery 60–79% (good progress, cement it)
        else if (answered > 0 && mastery >= CONTINUE_THRESHOLD && mastery < REINFORCE_THRESHOLD) {
          score = PRIORITY_WEIGHTS.reinforce + (REINFORCE_THRESHOLD - mastery);
          reason = "reinforce";
        }
        // Priority 8: Random practice
        else {
          score = PRIORITY_WEIGHTS.randomPractice;
          reason = "randomPractice";
        }
      }

      candidates.push({
        subjectId: subject.id,
        subjectLabel: subject.label,
        moduleId: mod.id,
        moduleLabel: mod.label,
        score,
        reason,
      });
    }

    // Subject with no modules in scope — still emit a subject-level candidate
    if (subjectModules.length === 0) {
      candidates.push({
        subjectId: subject.id,
        subjectLabel: subject.label,
        moduleId: null,
        moduleLabel: null,
        score: PRIORITY_WEIGHTS.newContent + (10 - Math.min(10, subject.priority)),
        reason: "newContent",
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ─── STEP 4: Student Readiness Score ──────────────────────────────────

export function computeReadiness(input: AdaptiveEngineInput): ReadinessScore {
  const { scope, learningProgress, masteryMap, reviewDueCount, missionState, currentStreak, currentXp } = input;

  if (!scope.hasContent) {
    return {
      score: 0,
      breakdown: {
        coveragePct: 0, masteryPct: 0, reviewHealthPct: 0,
        missionCompletionPct: 0, consistencyPct: 0, accuracyPct: 0,
        recentActivityPct: 0, weakAreaPenalty: 0,
      },
    };
  }

  // Coverage: answered/total questions across scope modules
  const allModules = scope.modules;
  const totalAnswered = allModules.reduce((s, m) => s + (learningProgress.modules[m.id]?.answered ?? 0), 0);
  // Estimate total: 50 questions per module if unknown
  const totalEstimated = allModules.length * 50;
  const coveragePct = totalEstimated > 0
    ? Math.min(100, Math.round((totalAnswered / totalEstimated) * 100))
    : 0;

  // Mastery: avg across scope subjects (only those with data)
  const subjectsWithData = scope.subjects.filter(s => masteryMap[s.id] !== undefined);
  const masteryPct = subjectsWithData.length > 0
    ? Math.round(subjectsWithData.reduce((s, sub) => s + (masteryMap[sub.id] ?? 0), 0) / subjectsWithData.length)
    : 0;

  // Review health: 100 - penalty per overdue review (5 pts each, capped at 100)
  const reviewHealthPct = Math.max(0, 100 - Math.min(100, reviewDueCount * 5));

  // Mission completion
  const missionCompletionPct = missionState.isActive
    ? Math.max(0, Math.min(100, 100 - missionState.questionsRemaining))
    : 100; // no mission = 100% (nothing pending)

  // Consistency: streak-based
  const consistencyPct = Math.min(100, currentStreak * 4); // 25-day streak = 100%

  // Accuracy: avg correct/answered across modules
  const modulesWithAttempts = allModules.filter(m => (learningProgress.modules[m.id]?.answered ?? 0) > 0);
  const accuracyPct = modulesWithAttempts.length > 0
    ? Math.round(
        modulesWithAttempts.reduce((s, m) => {
          const mp = learningProgress.modules[m.id];
          if (!mp || mp.answered === 0) return s;
          return s + (mp.correct / mp.answered) * 100;
        }, 0) / modulesWithAttempts.length
      )
    : 0;

  // Recent activity
  const recentActivityPct = currentStreak > 0 ? 100 : currentXp > 0 ? 50 : 0;

  // Weak area penalty: -5 per subject below WEAK_THRESHOLD
  const weakSubjects = scope.subjects.filter(s => (masteryMap[s.id] ?? 0) < WEAK_THRESHOLD && masteryMap[s.id] !== undefined);
  const weakAreaPenalty = -weakSubjects.length * 5;

  // Weighted score (weights sum to ~100 after penalty)
  const raw =
    coveragePct * 0.20 +
    masteryPct * 0.25 +
    reviewHealthPct * 0.15 +
    missionCompletionPct * 0.10 +
    consistencyPct * 0.10 +
    accuracyPct * 0.15 +
    recentActivityPct * 0.05 +
    weakAreaPenalty;

  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    breakdown: {
      coveragePct,
      masteryPct,
      reviewHealthPct,
      missionCompletionPct,
      consistencyPct,
      accuracyPct,
      recentActivityPct,
      weakAreaPenalty,
    },
  };
}

// ─── STEP 5: Study Health ─────────────────────────────────────────────

export function computeStudyHealth(input: AdaptiveEngineInput): StudyHealth {
  const { reviewDueCount, currentStreak, currentDate, examDate, masteryMap, scope } = input;
  const reasons: StudyHealthReason[] = [];

  if (reviewDueCount > 10) {
    reasons.push({ code: "reviews-overdue", label: `${reviewDueCount} reviews overdue`, severity: "critical" });
  } else if (reviewDueCount > 3) {
    reasons.push({ code: "reviews-pending", label: `${reviewDueCount} reviews pending`, severity: "warning" });
  }

  if (currentStreak === 0) {
    reasons.push({ code: "inactive", label: "No study activity today", severity: "warning" });
  }

  const weakSubjects = scope.subjects.filter(s => (masteryMap[s.id] ?? 0) < WEAK_THRESHOLD && masteryMap[s.id] !== undefined);
  if (weakSubjects.length > 0) {
    reasons.push({
      code: "weak-modules",
      label: `${weakSubjects.length} subject(s) below ${WEAK_THRESHOLD}% mastery`,
      severity: weakSubjects.length > 2 ? "critical" : "warning",
    });
  }

  if (examDate) {
    const daysLeft = daysUntil(examDate, currentDate);
    const avgMastery = scope.subjects.length > 0
      ? scope.subjects.reduce((s, sub) => s + (masteryMap[sub.id] ?? 0), 0) / scope.subjects.length
      : 0;
    if (daysLeft <= URGENT_DAYS && avgMastery < 70) {
      reasons.push({ code: "exam-close", label: `Exam in ${daysLeft} day(s), avg mastery ${Math.round(avgMastery)}%`, severity: "critical" });
    }
  }

  if (currentStreak >= 7 && weakSubjects.length === 0 && reviewDueCount === 0) {
    reasons.push({ code: "on-track", label: "Consistent study streak, no overdue reviews", severity: "info" });
  }

  const criticalCount = reasons.filter(r => r.severity === "critical").length;
  const warningCount = reasons.filter(r => r.severity === "warning").length;

  let status: StudyHealthStatus;
  if (criticalCount > 0) {
    status = "red";
  } else if (warningCount > 0) {
    status = "yellow";
  } else {
    status = "green";
  }

  // Examples are natural-language descriptions for the UI
  const examples: string[] = [];
  if (reviewDueCount > 3) examples.push(`${reviewDueCount} spaced-repetition reviews are waiting`);
  if (currentStreak === 0) examples.push("You haven't studied today");
  if (weakSubjects.length > 0) examples.push(`${weakSubjects.map(s => s.label).join(", ")} need attention`);
  if (examDate) {
    const d = daysUntil(examDate, currentDate);
    if (d <= URGENT_DAYS) examples.push(`Exam in ${d} day(s)`);
  }
  if (status === "green") examples.push("Great consistency — keep it up");

  return { status, reasons, examples };
}

// ─── STEP 6: Exam Readiness ───────────────────────────────────────────

export function computeExamReadiness(input: AdaptiveEngineInput): ExamReadiness {
  const { scope, learningProgress, masteryMap, examDate, currentDate } = input;

  const allSubjects = scope.subjects;
  const allModules = scope.modules;

  const subjectsReady = allSubjects.filter(s => (masteryMap[s.id] ?? 0) >= 80);
  const remainingSubjects = allSubjects.length - subjectsReady.length;

  const modulesReady = allModules.filter(m => (learningProgress.modules[m.id]?.mastery ?? 0) >= 80);
  const remainingModules = allModules.length - modulesReady.length;

  // Estimate hours: each remaining module ~1.5 hrs avg
  const estimatedStudyHours = Math.max(0, remainingModules * 1.5);

  const avgMastery = allSubjects.length > 0
    ? allSubjects.reduce((s, sub) => s + (masteryMap[sub.id] ?? 0), 0) / allSubjects.length
    : 0;

  // Confidence = 0–100 based on avg mastery + coverage
  const totalAnswered = allModules.reduce((s, m) => s + (learningProgress.modules[m.id]?.answered ?? 0), 0);
  const totalEstimated = allModules.length * 50;
  const coverageFactor = totalEstimated > 0 ? Math.min(1, totalAnswered / totalEstimated) : 0;
  const confidence = Math.round((avgMastery * 0.7 + coverageFactor * 100 * 0.3));

  let status: ExamReadinessStatus;
  if (avgMastery >= 80 && remainingSubjects === 0) {
    status = "ready";
  } else if (avgMastery >= 50 || remainingSubjects <= allSubjects.length * 0.3) {
    status = "needs-review";
  } else {
    status = "at-risk";
  }

  // Projected completion
  let projectedCompletionDays: number | null = null;
  if (remainingModules > 0 && input.currentStreak > 0) {
    // velocity: assume 0.5 modules/day at current streak pace
    const dailyModules = 0.5;
    projectedCompletionDays = Math.ceil(remainingModules / dailyModules);
  }

  // Check if projected completion is before exam
  if (examDate && projectedCompletionDays !== null) {
    const daysLeft = daysUntil(examDate, currentDate);
    if (projectedCompletionDays > daysLeft) {
      status = "at-risk";
    }
  }

  return {
    status,
    remainingSubjects,
    remainingModules,
    estimatedStudyHours,
    confidence,
    projectedCompletionDays,
  };
}

// ─── STEP 11: Analytics helpers ───────────────────────────────────────

function buildSubjectMasteryList(scope: ContentScope, masteryMap: Record<string, number>): SubjectMastery[] {
  return scope.subjects.map(s => ({ subjectId: s.id, masteryPct: masteryMap[s.id] ?? 0 }));
}

function buildModuleList(scope: ContentScope, learningProgress: LearningProgress): Array<{ moduleId: string; masteryPct: number; subjectId: string }> {
  return scope.modules.map(m => ({
    moduleId: m.id,
    masteryPct: learningProgress.modules[m.id]?.mastery ?? 0,
    subjectId: m.subjectId,
  }));
}

function deriveRetentionTrend(learningProgress: LearningProgress): "improving" | "stable" | "declining" | "unknown" {
  const modules = Object.values(learningProgress.modules);
  if (modules.length < 3) return "unknown";
  // Simple heuristic: compare avg mastery of recently studied modules vs overall
  const byMastery = modules.filter(m => m.answered > 0).map(m => m.mastery);
  if (byMastery.length < 2) return "unknown";
  const half = Math.floor(byMastery.length / 2);
  const recent = byMastery.slice(half);
  const older = byMastery.slice(0, half);
  const recentAvg = recent.reduce((s, x) => s + x, 0) / recent.length;
  const olderAvg = older.reduce((s, x) => s + x, 0) / older.length;
  if (recentAvg > olderAvg + 5) return "improving";
  if (recentAvg < olderAvg - 5) return "declining";
  return "stable";
}

// ─── Reason Labels ────────────────────────────────────────────────────

const REASON_LABELS: Record<PriorityReason, string> = {
  reviewDue: "Spaced-repetition reviews overdue",
  weakModule: "Low mastery — needs reinforcement",
  missionRequired: "Active mission target",
  examProximity: "Exam approaching — urgent review",
  continueLearning: "Resume from where you left off",
  newContent: "New subject to unlock",
  reinforce: "Reinforce recent learning",
  randomPractice: "General practice",
};

// ─── Difficulty derivation ────────────────────────────────────────────

function deriveDifficulty(reason: PriorityReason, mastery: number): "easy" | "medium" | "hard" {
  if (reason === "reviewDue" || reason === "weakModule") return "hard";
  if (reason === "examProximity") return "hard";
  if (reason === "reinforce") return "medium";
  if (mastery < 40) return "easy";  // new learner — start gentle
  if (mastery < 70) return "medium";
  return "easy";
}

// ─── Main Engine ──────────────────────────────────────────────────────

/**
 * computeAdaptiveOutput — pure entry point for Phase 9 engine.
 *
 * Given all available learning signals, returns:
 *  - recommendation: what to study next
 *  - readinessScore: 0–100 with breakdown
 *  - studyHealth: Green/Yellow/Red
 *  - examReadiness: Ready/Needs Review/At Risk
 *  - analytics: weak/strong subjects and modules, velocity, etc.
 */
export function computeAdaptiveOutput(input: AdaptiveEngineInput): AdaptiveOutput {
  const { scope, learningProgress, masteryMap, todayMinutesAvailable, currentStreak } = input;

  // ── Recommendation ──────────────────────────────────────────────────
  let recommendation: AdaptiveRecommendation;

  if (!scope.hasContent) {
    recommendation = {
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
      reasonLabel: "No content in scope",
      reviewQuestionsFirst: false,
    };
  } else {
    const candidates = scoreCandidates(input);
    const top = candidates[0];

    const topModuleMastery = top?.moduleId
      ? (learningProgress.modules[top.moduleId]?.mastery ?? 0)
      : (masteryMap[top?.subjectId ?? ""] ?? 0);

    recommendation = {
      nextSubjectId: top?.subjectId ?? null,
      nextSubjectLabel: top?.subjectLabel ?? null,
      nextModuleId: top?.moduleId ?? null,
      nextModuleLabel: top?.moduleLabel ?? null,
      nextTopicId: null, // topics are resolved downstream from module
      difficulty: top ? deriveDifficulty(top.reason, topModuleMastery) : "easy",
      estimatedMinutes: Math.min(todayMinutesAvailable, 20), // 20 min default session
      confidence: top ? Math.min(100, Math.round(top.score)) : 0,
      priority: top?.score ?? 0,
      reason: top?.reason ?? "randomPractice",
      reasonLabel: top ? REASON_LABELS[top.reason] : "No content available",
      reviewQuestionsFirst: input.reviewDueCount > 0,
    };
  }

  // ── Core outputs ────────────────────────────────────────────────────
  const readinessScore = computeReadiness(input);
  const studyHealth = computeStudyHealth(input);
  const examReadiness = computeExamReadiness(input);

  // ── Analytics ───────────────────────────────────────────────────────
  const allSubjectMastery = buildSubjectMasteryList(scope, masteryMap);
  const allModuleMastery = buildModuleList(scope, learningProgress);

  const weakestSubjects = [...allSubjectMastery].sort((a, b) => a.masteryPct - b.masteryPct).slice(0, 5);
  const strongestSubjects = [...allSubjectMastery].sort((a, b) => b.masteryPct - a.masteryPct).slice(0, 5);

  const weakestModules = [...allModuleMastery]
    .filter(m => learningProgress.modules[m.moduleId]?.answered ?? 0 > 0)
    .sort((a, b) => a.masteryPct - b.masteryPct)
    .slice(0, 5);
  const strongestModules = [...allModuleMastery]
    .filter(m => learningProgress.modules[m.moduleId]?.answered ?? 0 > 0)
    .sort((a, b) => b.masteryPct - a.masteryPct)
    .slice(0, 5);

  const reviewDebt = input.reviewDueCount;

  // Study velocity: modules completed (mastery ≥ 80) / max(1, streak/7)
  const modulesCompleted = allModuleMastery.filter(m => m.masteryPct >= 80).length;
  const weeksFactor = Math.max(1, currentStreak / 7);
  const studyVelocity = parseFloat((modulesCompleted / weeksFactor).toFixed(1));

  // Projected completion
  let projectedCompletionDate: Date | null = null;
  if (examReadiness.projectedCompletionDays !== null) {
    const d = new Date(input.currentDate);
    d.setDate(d.getDate() + examReadiness.projectedCompletionDays);
    projectedCompletionDate = d;
  }

  const retentionTrend = deriveRetentionTrend(learningProgress);

  return {
    recommendation,
    readinessScore,
    studyHealth,
    examReadiness,
    weakestSubjects,
    strongestSubjects,
    weakestModules,
    strongestModules,
    reviewDebt,
    studyVelocity,
    projectedCompletionDate,
    retentionTrend,
  };
}
