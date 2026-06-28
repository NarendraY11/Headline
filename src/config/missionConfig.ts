// Phase 5B: Deterministic mission generation from primaryTrack + readiness.
// No AI, no hallucination. Inputs → mission shape.
//
// Phase 6 (Mission Activation Engine): deriveEngineMission() below produces a
// *launchable* mission draft (real subjectId + difficulty + launch route) that
// the engine persists as a study_missions row. Pure + deterministic: same
// inputs → identical draft (no AI, no Date, no Math.random).
//
// Phase 5 (Content Delivery Engine): deriveEngineMissionFromScope() is the
// scope-aware replacement for deriveEngineMission(). Use it when the
// contentDeliveryEngine flag is ON — it derives eligible subjects from the
// ContentScope instead of the hardcoded TRACK_SUBJECTS map.

import { getPrimaryTrackFamily } from "../data/trainingPaths";
import type { ContentScope } from "../lib/contentDeliveryEngine";
import type {
  LaunchMode,
  LaunchRoute,
  MissionType,
  TaskDifficulty,
  TaskScope,
} from "../types/studyScheduler";

export interface MissionShape {
  title: string;
  subject: string;
  questionCount: number;
  estimatedMinutes: number;
  source: "readiness" | "diagnostic" | "default";
}

// Subject pools per track family — ordered by typical syllabus priority
const DGCA_SUBJECTS = [
  "Air Navigation",
  "Meteorology",
  "Air Regulations",
  "Technical General",
  "Technical Specific",
];

const TYPE_RATING_SUBJECTS: Record<string, string[]> = {
  "type-a320": ["A320 Pneumatics", "A320 Hydraulics", "A320 Electrical", "A320 Flight Controls", "A320 Fuel System"],
  "type-a330": ["A330 Systems", "A330 Hydraulics", "A330 Electrical", "A330 Flight Controls"],
  "type-b737": ["B737 Systems", "B737 Hydraulics", "B737 Electrical", "B737 Flight Controls"],
  "type-b777": ["B777 Systems", "B777 Hydraulics", "B777 Electrical"],
  "type-atr72": ["ATR72 Systems", "ATR72 Propulsion", "ATR72 Electrics"],
};

// Career objective secondary missions
export interface CareerMission {
  objectiveId: string;
  title: string;
  description: string;
  items: Array<{ label: string; to: string; duration: string }>;
}

export const CAREER_OBJECTIVE_MISSIONS: Record<string, CareerMission> = {
  "airline-recruitment": {
    objectiveId: "airline-recruitment",
    title: "Interview Readiness",
    description: "Airline hiring preparation alongside your exam track.",
    items: [
      { label: "Technical Interview Practice", to: "/interview-prep/technical", duration: "15 min" },
      { label: "Aptitude Drill",               to: "/interview-prep/aptitude",  duration: "10 min" },
      { label: "HR Scenario Review",           to: "/interview-prep/hr",        duration: "8 min"  },
    ],
  },
};

/**
 * Derives a deterministic mission from user context.
 * Priority: weakest subject from readiness → diagnostic result → track default.
 */
export function deriveMainMission(opts: {
  targetExam: string | null | undefined;
  weakestSubject?: string | null;
  diagnosticWeakSubject?: string | null;
  dailyGoal?: number;
}): MissionShape {
  const { targetExam, weakestSubject, diagnosticWeakSubject, dailyGoal = 20 } = opts;
  const trackFamily = getPrimaryTrackFamily(targetExam);
  const questionCount = Math.min(Math.max(dailyGoal, 10), 50);
  const estimatedMinutes = Math.round(questionCount * 0.55); // ~33s/question

  // Use weakest subject from readiness report if available
  if (weakestSubject) {
    return {
      title: weakestSubject,
      subject: weakestSubject,
      questionCount,
      estimatedMinutes,
      source: "readiness",
    };
  }

  // Use diagnostic weak subject as fallback
  if (diagnosticWeakSubject) {
    return {
      title: diagnosticWeakSubject,
      subject: diagnosticWeakSubject,
      questionCount,
      estimatedMinutes,
      source: "diagnostic",
    };
  }

  // Default: first subject in the track pool
  if (trackFamily === "type_rating" && targetExam) {
    const subjects = TYPE_RATING_SUBJECTS[targetExam] ?? ["Aircraft Systems"];
    return {
      title: subjects[0],
      subject: subjects[0],
      questionCount,
      estimatedMinutes,
      source: "default",
    };
  }

  const subjects = DGCA_SUBJECTS;
  return {
    title: subjects[0],
    subject: subjects[0],
    questionCount,
    estimatedMinutes,
    source: "default",
  };
}

/**
 * Returns secondary career objective mission config, or null if not applicable.
 */
export function getCareerMission(careerObjective: string | null | undefined): CareerMission | null {
  if (!careerObjective) return null;
  return CAREER_OBJECTIVE_MISSIONS[careerObjective] ?? null;
}

// =====================================================================
// Phase 6 — Mission Activation Engine: deterministic launchable mission
// =====================================================================

/**
 * The ONLY subjects with a published question bank today. The engine can only
 * generate missions a user can actually complete, so generation is restricted
 * to this set. `label` is the canonical name; `short` is used in mission titles.
 *
 * ponytail: hard-coded — validated against src/data/topics.ts `status:"active"`
 * subjects. When a new subject gets a question bank, add it here + to TRACK_SUBJECTS.
 */
export interface EngineSubject {
  id: string;
  label: string;
  short: string;
  questionCount: number;
}

export const ENGINE_SUBJECTS: Record<string, EngineSubject> = {
  "air-navigation":      { id: "air-navigation",      label: "Air Navigation",      short: "Air Navigation",      questionCount: 450 },
  "meteorology":         { id: "meteorology",         label: "Aviation Meteorology", short: "Meteorology",         questionCount: 100 },
  "air-regulation":      { id: "air-regulation",      label: "Air Regulation",      short: "Air Regulations",     questionCount: 50  },
  "principles-of-flight":{ id: "principles-of-flight",label: "Principles of Flight", short: "Principles of Flight", questionCount: 180 },
  "a320-systems":        { id: "a320-systems",        label: "Airbus A320 Family",  short: "A320 Systems",        questionCount: 1478 },
};

/** Track family → eligible subject ids, in fixed priority order (tie-break). */
const TRACK_SUBJECTS: Record<string, string[]> = {
  dgca:        ["air-navigation", "meteorology", "air-regulation"],
  type_rating: ["a320-systems"],
  easa:        ["principles-of-flight"],
  faa:         ["air-navigation", "meteorology", "air-regulation"], // no FAA bank yet → DGCA fallback
};

export type MissionCategory = "training" | "career";

/**
 * Launchable mission draft. Maps onto a study_missions row:
 *   missionType → row.type, difficulty/scope/mode/route/subjectId/targetCount → row.payload,
 *   estimatedMin → row.estimated_min. Extra display fields (title/description/category)
 *   ride in row.payload so no schema change is needed.
 */
export interface EngineMissionDraft {
  category: MissionCategory;
  title: string;
  description: string;
  subjectId: string;
  subjectLabel: string;
  missionType: MissionType;
  difficulty: TaskDifficulty;
  scope: TaskScope;
  mode: LaunchMode;
  route: LaunchRoute;
  questionCount: number;
  estimatedMin: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Deterministically derive the next training mission from user context.
 *
 * Selection: weakest eligible subject (lowest mastery), tie-broken by the fixed
 * TRACK_SUBJECTS order. Difficulty + title scale by mastery band. Every mission
 * is a topic-scoped practice quiz (route "quiz") so it always launches into the
 * subject's real question bank — no dependency on SR due-queues or mock papers
 * that may be empty for a given user.
 *
 * Pure: no I/O, no Date, no randomness. Same inputs → identical draft.
 */
export function deriveEngineMission(opts: {
  targetExam: string | null | undefined;
  /** subjectId → mastery 0..100 */
  mastery: Record<string, number>;
  dailyGoal?: number;
}): EngineMissionDraft {
  const family = getPrimaryTrackFamily(opts.targetExam) ?? "dgca";
  const eligible = TRACK_SUBJECTS[family] ?? TRACK_SUBJECTS.dgca;

  // Weakest eligible subject; first-in-order wins ties (deterministic).
  let chosenId = eligible[0];
  let lowest = Infinity;
  for (const id of eligible) {
    const m = opts.mastery[id] ?? 0;
    if (m < lowest) {
      lowest = m;
      chosenId = id;
    }
  }

  const subj = ENGINE_SUBJECTS[chosenId];
  const mastery = opts.mastery[chosenId] ?? 0;

  // Band → difficulty + title suffix. Type stays "drill" (route "quiz") so the
  // mission always has real questions to launch into.
  let difficulty: TaskDifficulty;
  let suffix: string;
  if (mastery < 40)      { difficulty = "standard"; suffix = "Foundations"; }
  else if (mastery < 65) { difficulty = "complex";  suffix = "Practice"; }
  else if (mastery < 80) { difficulty = "mixed";    suffix = "Review"; }
  else                   { difficulty = "extreme";  suffix = "Assessment"; }

  const goal = clamp(opts.dailyGoal ?? 20, 5, 30);
  const questionCount = Math.min(goal, subj.questionCount);
  const estimatedMin = Math.max(5, Math.round(questionCount * 0.75)); // ~45s/q

  return {
    category: "training",
    title: `${subj.short} ${suffix}`,
    description: `${questionCount} ${difficulty} questions to build your ${subj.short} mastery.`,
    subjectId: subj.id,
    subjectLabel: subj.label,
    missionType: "drill",
    difficulty,
    scope: "topic",
    mode: "practice",
    route: "quiz",
    questionCount,
    estimatedMin,
  };
}

// =====================================================================
// Phase 5 — Scope-aware mission derivation
// =====================================================================

/**
 * Scope-aware replacement for deriveEngineMission().
 * Use when contentDeliveryEngine flag is ON.
 *
 * Derives eligible subjects from the ContentScope (which comes from
 * resolveContentScope) instead of the hardcoded TRACK_SUBJECTS map.
 * Falls back to deriveEngineMission() when no eligible subjects exist
 * in the scope (e.g. coming-soon subjects with no question bank yet).
 */
export function deriveEngineMissionFromScope(opts: {
  scope: ContentScope;
  /** subjectId → mastery 0..100 */
  mastery: Record<string, number>;
  dailyGoal?: number;
}): EngineMissionDraft {
  // Find eligible subjects: intersection of scope subjects and ENGINE_SUBJECTS
  const eligible = opts.scope.subjects
    .filter((s) => ENGINE_SUBJECTS[s.id] !== undefined)
    .sort((a, b) => a.priority - b.priority);

  if (eligible.length === 0) {
    // No eligible subjects in scope — fall back to legacy derivation
    return deriveEngineMission({
      targetExam: opts.scope.certificationId,
      mastery: opts.mastery,
      dailyGoal: opts.dailyGoal,
    });
  }

  // Weakest eligible subject; first-in-priority wins ties (deterministic)
  let chosenId = eligible[0].id;
  let lowest = Infinity;
  for (const s of eligible) {
    const m = opts.mastery[s.id] ?? 0;
    if (m < lowest) {
      lowest = m;
      chosenId = s.id;
    }
  }

  const subj = ENGINE_SUBJECTS[chosenId];
  const mastery = opts.mastery[chosenId] ?? 0;

  let difficulty: TaskDifficulty;
  let suffix: string;
  if (mastery < 40)      { difficulty = "standard"; suffix = "Foundations"; }
  else if (mastery < 65) { difficulty = "complex";  suffix = "Practice"; }
  else if (mastery < 80) { difficulty = "mixed";    suffix = "Review"; }
  else                   { difficulty = "extreme";  suffix = "Assessment"; }

  const goal = clamp(opts.dailyGoal ?? 20, 5, 30);
  const questionCount = Math.min(goal, subj.questionCount);
  const estimatedMin = Math.max(5, Math.round(questionCount * 0.75));

  return {
    category: "training",
    title: `${subj.short} ${suffix}`,
    description: `${questionCount} ${difficulty} questions to build your ${subj.short} mastery.`,
    subjectId: subj.id,
    subjectLabel: subj.label,
    missionType: "drill",
    difficulty,
    scope: "topic",
    mode: "practice",
    route: "quiz",
    questionCount,
    estimatedMin,
  };
}
