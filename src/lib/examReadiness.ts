// =====================================================================
// M8B: Exam Readiness Score — pure computation
//
// ExamReadinessScore (0-100) is a composite metric with four
// weighted components:
//
//   mastery      0.45  — proportion of subjects at DEVELOPING+ (≥65%)
//   coverage     0.25  — proportion of subjects ever attempted
//   consistency  0.20  — study streak (14-day = full score)
//   recency      0.10  — how recently the user studied
//
// All inputs are plain numbers — no hooks, no side effects.
// =====================================================================

export type ReadinessBand = "poor" | "developing" | "ready" | "exam_ready";

export interface ExamReadinessComponents {
  mastery: number;      // 0..1
  coverage: number;     // 0..1
  consistency: number;  // 0..1
  recency: number;      // 0..1
}

export interface ExamReadinessResult {
  score: number;                    // 0-100 integer
  band: ReadinessBand;
  components: ExamReadinessComponents;
}

// ── computeExamReadiness ──────────────────────────────────────────────────

export interface ExamReadinessInput {
  /** mastery % (0-100) keyed by subject_id */
  subjectMasteries: Record<string, number>;
  /** answers_total per subject_id — 0 when falling back from useUserProgress */
  answersTotals: Record<string, number>;
  /** Number of published exam subjects (subjectsList.length) */
  totalExamSubjects: number;
  /** progressStats.streakCount or userData.streakCount */
  streakCount: number;
  /** YYYY-MM-DD string from userData.lastActivityDate or empty string */
  lastActivityDate: string;
}

export function computeExamReadiness(input: ExamReadinessInput): ExamReadinessResult {
  const {
    subjectMasteries,
    answersTotals,
    totalExamSubjects,
    streakCount,
    lastActivityDate,
  } = input;

  const total = Math.max(totalExamSubjects, 1);

  // ── mastery component (0..1) ─────────────────────────────────────────
  // Proportion of subjects at DEVELOPING or better (≥65%)
  const masteredCount = Object.values(subjectMasteries).filter(m => m >= 65).length;
  const masteryComponent = masteredCount / total;

  // ── coverage component (0..1) ────────────────────────────────────────
  // Subjects with at least 1 answer. When answersTotals is unavailable
  // (fallback path), use mastery > 0 as proxy.
  const coveredCount = Object.entries(subjectMasteries).filter(([subjectId, mastery]) => {
    const answers = answersTotals[subjectId] ?? 0;
    return answers > 0 || mastery > 0;
  }).length;
  const coverageComponent = coveredCount / total;

  // ── consistency component (0..1) ─────────────────────────────────────
  // 14-day consecutive streak = full score; scales linearly below.
  const consistencyComponent = Math.min(streakCount / 14, 1.0);

  // ── recency component (0..1) ─────────────────────────────────────────
  let recencyComponent = 0.0;
  if (lastActivityDate) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const lastDate = new Date(lastActivityDate);
    const diffMs = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (lastActivityDate === todayStr) recencyComponent = 1.0;
    else if (lastActivityDate === yesterdayStr) recencyComponent = 0.8;
    else if (diffDays <= 7) recencyComponent = 0.5;
    else if (diffDays <= 30) recencyComponent = 0.2;
    else recencyComponent = 0.0;
  }

  // ── composite score ───────────────────────────────────────────────────
  const raw =
    masteryComponent    * 0.45 +
    coverageComponent   * 0.25 +
    consistencyComponent * 0.20 +
    recencyComponent    * 0.10;

  const score = Math.floor(raw * 100);

  const band = readinessBand(score);

  return {
    score,
    band,
    components: {
      mastery: masteryComponent,
      coverage: coverageComponent,
      consistency: consistencyComponent,
      recency: recencyComponent,
    },
  };
}

// ── readinessBand ─────────────────────────────────────────────────────────

export function readinessBand(score: number): ReadinessBand {
  if (score >= 80) return "exam_ready";
  if (score >= 65) return "ready";
  if (score >= 40) return "developing";
  return "poor";
}

export const BAND_LABEL: Record<ReadinessBand, string> = {
  poor:      "Not Ready",
  developing: "Developing",
  ready:     "On Track",
  exam_ready: "Exam Ready",
};

export const BAND_COLOR: Record<ReadinessBand, string> = {
  poor:      "#e33a2e",   // signal red
  developing: "#e5a93c",  // amber
  ready:     "#4ade80",   // mint
  exam_ready: "#16a34a",  // dark green
};

// ── urgencyScore ──────────────────────────────────────────────────────────

/**
 * Workload urgency for a subject.
 * Used by RecommendedFocus to rank subjects worth studying next.
 */
export function urgencyScore(mastery: number, confidence: number): number {
  const multiplier =
    mastery < 50 ? 2.0 :
    mastery < 65 ? 1.5 :
    mastery < 80 ? 1.0 :
    0.3;
  return (100 - mastery) * multiplier * Math.max(0.5, confidence);
}

// ── computeETA (M9D) ──────────────────────────────────────────────────────────

/**
 * Estimate weeks until ExamReadinessScore reaches the exam_ready band (≥80).
 *
 * @param currentScore  current readiness score 0-100
 * @param velocityPerWeek  avg score delta per week (from useMasteryHistory)
 * @returns weeks (positive integer) or null when:
 *   - already at exam_ready (score >= 80)
 *   - velocity <= 0 (not improving)
 *   - < 2 weeks of history (unreliable)
 */
export function computeETA(
  currentScore: number,
  velocityPerWeek: number
): number | null {
  if (currentScore >= 80) return null;
  if (velocityPerWeek <= 0) return null;
  const weeksNeeded = Math.ceil((80 - currentScore) / velocityPerWeek);
  if (weeksNeeded > 52) return null;  // > 1 year = not useful
  return weeksNeeded;
}
