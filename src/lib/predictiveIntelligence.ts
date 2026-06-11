// =====================================================================
// M11: Predictive Intelligence Engine — pure computation, no side effects
//
// Algorithms:
//   computePassProbability   — 0-100% pass chance from readiness + mastery trends
//   computeSubjectRisks      — per-subject HIGH/MEDIUM/LOW risk classification
//   computeFailureRisk       — global failure risk with contributing factors
//   computeSuccessForecast   — ETA weeks + confidence band
//   computeRecommendedActions — priority-ordered action list
//
// No external AI calls. All inputs are plain numbers from existing hooks.
// =====================================================================

import type { MasterySnapshot } from "./masterySnapshot.js";
import type { ExamReadinessResult } from "./examReadiness.js";

// ── Shared types ──────────────────────────────────────────────────────────────

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type ForecastConfidence = "high" | "medium" | "low";

// ── Pass Probability ──────────────────────────────────────────────────────────

export interface PassProbabilityResult {
  probability: number;        // 0-100 integer
  label: string;              // "84%" etc
  band: "strong" | "moderate" | "marginal" | "at_risk";
  trendMultiplier: number;    // how trend shifted base score
}

/**
 * Weighted pass probability from readiness + mastery trend signals.
 *
 * Base = readiness.score (0-100).
 * Trend lift/penalty: net average trend across all snapshots.
 * Coverage penalty when < 60% subjects ever attempted.
 */
export function computePassProbability(
  readiness: ExamReadinessResult,
  snapshots: MasterySnapshot[]
): PassProbabilityResult {
  let base = readiness.score / 100;

  // Trend multiplier: average across all snapshots
  const TREND_WEIGHT: Record<MasterySnapshot["trend"], number> = {
    IMPROVING:   1.12,
    PROGRESSING: 1.05,
    STABLE:      1.00,
    REGRESSING:  0.90,
    DECLINING:   0.78,
  };
  let trendMultiplier = 1.0;
  if (snapshots.length > 0) {
    const avgWeight =
      snapshots.reduce((sum, s) => sum + TREND_WEIGHT[s.trend], 0) / snapshots.length;
    trendMultiplier = avgWeight;
  }

  // Coverage penalty when < 60% subjects attempted
  const coverageFactor = readiness.components.coverage >= 0.6
    ? 1.0
    : 0.65 + readiness.components.coverage * 0.58;

  const raw = Math.min(1.0, base * trendMultiplier * coverageFactor);
  const probability = Math.round(raw * 100);

  const band: PassProbabilityResult["band"] =
    probability >= 75 ? "strong" :
    probability >= 55 ? "moderate" :
    probability >= 35 ? "marginal" : "at_risk";

  return { probability, label: `${probability}%`, band, trendMultiplier };
}

// ── Subject Risk Forecasting ──────────────────────────────────────────────────

export interface SubjectRisk {
  subjectId: string;
  risk: RiskLevel;
  mastery: number;
  trend: MasterySnapshot["trend"];
  /** Short reason phrase */
  reason: string;
}

export function computeSubjectRisks(
  snapshots: MasterySnapshot[],
  subjectTitles: Record<string, string>
): SubjectRisk[] {
  return snapshots.map((s): SubjectRisk => {
    let risk: RiskLevel;
    let reason: string;

    const declining = s.trend === "DECLINING" || s.trend === "REGRESSING";

    if (s.mastery < 50) {
      risk = "HIGH";
      reason = "Critical mastery gap";
    } else if (s.mastery < 65 && declining) {
      risk = "HIGH";
      reason = "Weak and declining";
    } else if (s.mastery < 65) {
      risk = "MEDIUM";
      reason = "Below passing threshold";
    } else if (s.mastery < 75 && declining) {
      risk = "MEDIUM";
      reason = "Regressing from passing zone";
    } else if (declining) {
      risk = "MEDIUM";
      reason = "Declining trend detected";
    } else {
      risk = "LOW";
      reason = "On track";
    }

    return {
      subjectId: s.subject_id,
      risk,
      mastery: s.mastery,
      trend: s.trend,
      reason,
    };
  }).sort((a, b) => {
    const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return ORDER[a.risk] - ORDER[b.risk] || a.mastery - b.mastery;
  });
}

// ── Failure Risk Detection ────────────────────────────────────────────────────

export interface FailureRiskResult {
  level: RiskLevel;
  factors: string[];
  criticalCount: number;
  weakCount: number;
  decliningCount: number;
}

export function computeFailureRisk(
  readiness: ExamReadinessResult,
  snapshots: MasterySnapshot[]
): FailureRiskResult {
  const criticalCount = snapshots.filter(s => s.classification === "CRITICAL").length;
  const weakCount = snapshots.filter(s => s.classification === "WEAK").length;
  const decliningCount = snapshots.filter(
    s => s.trend === "DECLINING" || s.trend === "REGRESSING"
  ).length;

  const factors: string[] = [];

  if (criticalCount > 0) factors.push(`${criticalCount} subject${criticalCount > 1 ? "s" : ""} below 50% mastery`);
  if (weakCount > 0) factors.push(`${weakCount} subject${weakCount > 1 ? "s" : ""} below passing threshold`);
  if (decliningCount > 0) factors.push(`${decliningCount} subject${decliningCount > 1 ? "s" : ""} with declining trend`);
  if (readiness.components.consistency < 0.3) factors.push("Study consistency is low");
  if (readiness.components.coverage < 0.5) factors.push("Less than half of subjects attempted");
  if (readiness.components.recency === 0) factors.push("No recent study activity");

  let level: RiskLevel;
  if (criticalCount >= 2 || readiness.score < 25 || (criticalCount >= 1 && decliningCount >= 2)) {
    level = "HIGH";
  } else if (criticalCount >= 1 || weakCount >= 3 || readiness.score < 45) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return { level, factors, criticalCount, weakCount, decliningCount };
}

// ── Success Forecast ──────────────────────────────────────────────────────────

export interface SuccessForecastResult {
  etaWeeks: number | null;
  etaLabel: string;
  confidence: ForecastConfidence;
  velocityPerWeek: number;
  alreadyReady: boolean;
}

export function computeSuccessForecast(
  readiness: ExamReadinessResult,
  velocityPerWeek: number
): SuccessForecastResult {
  const alreadyReady = readiness.score >= 80;

  if (alreadyReady) {
    return {
      etaWeeks: null,
      etaLabel: "Exam ready now",
      confidence: "high",
      velocityPerWeek,
      alreadyReady: true,
    };
  }

  if (velocityPerWeek <= 0) {
    return {
      etaWeeks: null,
      etaLabel: velocityPerWeek < 0 ? "Declining — review focus needed" : "Insufficient data",
      confidence: "low",
      velocityPerWeek,
      alreadyReady: false,
    };
  }

  const weeksNeeded = Math.ceil((80 - readiness.score) / velocityPerWeek);
  if (weeksNeeded > 52) {
    return {
      etaWeeks: null,
      etaLabel: "More than a year at current pace",
      confidence: "low",
      velocityPerWeek,
      alreadyReady: false,
    };
  }

  const confidence: ForecastConfidence =
    velocityPerWeek >= 3 ? "high" :
    velocityPerWeek >= 1 ? "medium" : "low";

  const etaLabel = `~${weeksNeeded} week${weeksNeeded !== 1 ? "s" : ""} to exam ready`;

  return { etaWeeks: weeksNeeded, etaLabel, confidence, velocityPerWeek, alreadyReady: false };
}

// ── Recommended Actions ───────────────────────────────────────────────────────

export interface RecommendedAction {
  priority: number;     // 1 = highest
  type: "drill" | "review" | "firstAttempt" | "streak" | "studyToday" | "mock";
  title: string;
  description: string;
  subjectId?: string;
}

export function computeRecommendedActions(
  snapshots: MasterySnapshot[],
  subjectTitles: Record<string, string>,
  readiness: ExamReadinessResult,
  subjectRisks: SubjectRisk[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  let priority = 1;

  // 1. CRITICAL subjects → immediate drill
  const criticalSubjects = subjectRisks.filter(r => r.risk === "HIGH").slice(0, 2);
  for (const sub of criticalSubjects) {
    actions.push({
      priority: priority++,
      type: "drill",
      title: `Drill ${subjectTitles[sub.subjectId] ?? sub.subjectId}`,
      description: `${sub.reason}. Current mastery: ${sub.mastery}%.`,
      subjectId: sub.subjectId,
    });
  }

  // 2. Declining subjects → targeted review
  const decliningSnapshots = snapshots
    .filter(s => (s.trend === "DECLINING" || s.trend === "REGRESSING") && !criticalSubjects.find(c => c.subjectId === s.subject_id))
    .slice(0, 1);
  for (const s of decliningSnapshots) {
    actions.push({
      priority: priority++,
      type: "review",
      title: `Review ${subjectTitles[s.subject_id] ?? s.subject_id}`,
      description: `Trend is ${s.trend.toLowerCase()}. Reinforce weak areas before they degrade further.`,
      subjectId: s.subject_id,
    });
  }

  // 3. Uncovered subjects → first attempt
  if (readiness.components.coverage < 0.7) {
    actions.push({
      priority: priority++,
      type: "firstAttempt",
      title: "Attempt uncovered subjects",
      description: `Only ${Math.round(readiness.components.coverage * 100)}% of subjects have been attempted. Cover more ground to improve readiness.`,
    });
  }

  // 4. Low consistency → study streak
  if (readiness.components.consistency < 0.4) {
    actions.push({
      priority: priority++,
      type: "streak",
      title: "Build a study streak",
      description: "Daily study sessions improve consistency scores. Even 10 questions per day maintains momentum.",
    });
  }

  // 5. Stale → study today
  if (readiness.components.recency < 0.5) {
    actions.push({
      priority: priority++,
      type: "studyToday",
      title: "Study today",
      description: "No recent activity detected. A quick session today will boost your recency score.",
    });
  }

  // 6. Ready but no mock → take mock exam
  if (readiness.score >= 60 && criticalSubjects.length === 0) {
    actions.push({
      priority: priority++,
      type: "mock",
      title: "Take a mock exam",
      description: "Your scores are strong. A full mock exam will reveal exam-day readiness and expose any remaining gaps.",
    });
  }

  return actions.slice(0, 4); // cap at 4 actions
}

// ── Combined result ───────────────────────────────────────────────────────────

export interface PredictiveIntelligenceResult {
  passProbability: PassProbabilityResult;
  subjectRisks: SubjectRisk[];
  failureRisk: FailureRiskResult;
  successForecast: SuccessForecastResult;
  recommendations: RecommendedAction[];
}

export function computePredictiveIntelligence(
  readiness: ExamReadinessResult,
  snapshots: MasterySnapshot[],
  subjectTitles: Record<string, string>,
  velocityPerWeek: number
): PredictiveIntelligenceResult {
  const passProbability = computePassProbability(readiness, snapshots);
  const subjectRisks = computeSubjectRisks(snapshots, subjectTitles);
  const failureRisk = computeFailureRisk(readiness, snapshots);
  const successForecast = computeSuccessForecast(readiness, velocityPerWeek);
  const recommendations = computeRecommendedActions(
    snapshots,
    subjectTitles,
    readiness,
    subjectRisks
  );

  return { passProbability, subjectRisks, failureRisk, successForecast, recommendations };
}
