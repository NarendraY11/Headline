// Phase 5B: Deterministic mission generation from primaryTrack + readiness.
// No AI, no hallucination. Inputs → mission shape.

import { getPrimaryTrackFamily } from "../data/trainingPaths";

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
