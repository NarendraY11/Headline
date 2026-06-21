// Config-driven training-path catalog for onboarding Step 1.
// Adding a path or goal = data edit here; the UI renders generically off `status`.
// ponytail: pure static config, no DB. Step 1 doesn't need live exam fetch.

export type PathStatus = "active" | "coming_soon" | "beta" | "deprecated";

export interface Goal {
  id: string; // "cpl"
  label: string; // "CPL"
  targetExam: string; // "dgca-cpl" — carries the token ModulesView substring-matches
  includes?: string[]; // optional informational context panel (DGCA certs)
}

export interface TrainingPath {
  id: string; // "dgca"
  label: string; // "DGCA"
  description: string;
  status: PathStatus;
  goalPrompt: string; // Level-2 heading
  tooltip?: string; // shown for non-active states
  goals: Goal[];
}

const DGCA_CORE = [
  "Air Navigation",
  "Meteorology",
  "Air Regulations",
  "Technical General",
  "Technical Specific",
];

export const TRAINING_PATHS: TrainingPath[] = [
  {
    id: "dgca",
    label: "DGCA",
    description: "Indian Pilot Licensing & DGCA Exam Preparation",
    status: "active",
    goalPrompt: "What are you preparing for?",
    goals: [
      { id: "cpl", label: "CPL", targetExam: "dgca-cpl", includes: DGCA_CORE },
      { id: "atpl", label: "ATPL", targetExam: "dgca-atpl", includes: DGCA_CORE },
      { id: "rtr", label: "RTR", targetExam: "dgca-rtr" },
      { id: "ppl", label: "PPL", targetExam: "dgca-ppl" },
    ],
  },
  {
    id: "airline",
    label: "Airline Recruitment",
    description: "Airline Selection, Technical Screening & Interview Preparation",
    status: "active",
    goalPrompt: "What are you preparing for?",
    goals: [
      { id: "technical", label: "Technical Interview", targetExam: "airline-technical" },
      { id: "aptitude", label: "Aptitude Assessment", targetExam: "airline-aptitude" },
      { id: "hr", label: "HR Interview", targetExam: "airline-hr" },
      { id: "screening", label: "Airline Screening Preparation", targetExam: "airline-screening" },
    ],
  },
  {
    id: "type_rating",
    label: "Type Rating",
    description: "Aircraft-Specific Training & Assessments",
    status: "active",
    goalPrompt: "What aircraft are you preparing for?",
    goals: [
      { id: "atr72", label: "ATR72", targetExam: "type-atr72" },
      { id: "a320", label: "Airbus A320", targetExam: "type-a320" },
      { id: "a330", label: "Airbus A330", targetExam: "type-a330" },
      { id: "b737", label: "Boeing B737", targetExam: "type-b737" },
      { id: "b777", label: "Boeing B777", targetExam: "type-b777" },
    ],
  },
  {
    id: "faa",
    label: "FAA",
    description: "International Certification Path",
    status: "coming_soon",
    goalPrompt: "",
    tooltip: "FAA learning paths are currently in development.",
    goals: [],
  },
  {
    id: "easa",
    label: "EASA",
    description: "European Airline Pathway",
    status: "coming_soon",
    goalPrompt: "",
    tooltip: "EASA learning paths are currently in development.",
    goals: [],
  },
];

/**
 * Resolves the canonical targetExam string from a pathway + goal pair.
 * Returns null (not a fallback string) on unknown combinations so callers
 * are forced to handle the error rather than silently writing a wrong profile.
 */
export function resolveTargetExam(pathwayId: string, goalId: string): string | null {
  const path = TRAINING_PATHS.find(p => p.id === pathwayId);
  if (!path) {
    console.error(`[trainingPaths] Unknown pathway id: "${pathwayId}". No targetExam resolved.`);
    return null;
  }
  const goal = path.goals.find(g => g.id === goalId);
  if (!goal) {
    console.error(`[trainingPaths] Unknown goal id: "${goalId}" for pathway "${pathwayId}". No targetExam resolved.`);
    return null;
  }
  return goal.targetExam;
}
