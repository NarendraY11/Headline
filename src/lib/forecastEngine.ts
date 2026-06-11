// =====================================================================
// M11B: Forecast Engine — pure computation, no side effects
//
// Algorithms:
//   projectReadinessTimeline   — N-week readiness score projection + confidence band
//   projectSuccessProbability  — N-week pass probability timeline
//   computeStudyHourPrediction — weekly study hours needed to reach exam-ready
//   computeWeakSubjectForecast — per-subject mastery trajectory for 4 weeks
//   computeMasteryTrendProjection — linear extrapolation on historical weekly data
//
// All inputs are plain numbers from existing hooks. No external calls.
// =====================================================================

import type { MasterySnapshot } from "./masterySnapshot.js";
import type { ExamReadinessResult } from "./examReadiness.js";
import type { MasteryHistoryPoint } from "../hooks/useMasteryHistory.js";
import { computePassProbability } from "./predictiveIntelligence.js";

// ── Shared ────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ── Readiness Timeline Projection ────────────────────────────────────────────

export interface ReadinessTimelinePoint {
  weekOffset: number;    // 0 = now, 1 = next week, etc.
  weekLabel: string;
  projected: number;     // 0-100 score
  optimistic: number;    // upper confidence bound
  pessimistic: number;   // lower confidence bound
  isHistory: boolean;    // true = past data point
}

/**
 * Projects readiness score forward `weeks` weeks.
 * Uses velocity + historical variance to build ±1σ confidence bands.
 *
 * `historicalScores`: past weekly readiness scores, oldest → newest (at least 2 for variance).
 */
export function projectReadinessTimeline(
  currentScore: number,
  velocityPerWeek: number,
  historicalScores: number[],
  weeks = 8
): ReadinessTimelinePoint[] {
  // Compute historical std-dev as confidence band width
  let stdDev = 5; // fallback ±5 pts
  if (historicalScores.length >= 2) {
    const mean = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length;
    const variance = historicalScores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / historicalScores.length;
    stdDev = Math.sqrt(variance);
  }

  // Historical points (last 4 only, oldest → newest)
  const histPts: ReadinessTimelinePoint[] = historicalScores.slice(-4).map((score, i, arr) => {
    const weekOffset = i - arr.length; // negative offsets: -3, -2, -1, 0
    return {
      weekOffset,
      weekLabel: weekOffset === 0 ? "Now" : `${Math.abs(weekOffset)}w ago`,
      projected: score,
      optimistic: score,
      pessimistic: score,
      isHistory: true,
    };
  });

  // Forward projection
  const fwdPts: ReadinessTimelinePoint[] = [];
  for (let w = 1; w <= weeks; w++) {
    const projected = clamp(currentScore + velocityPerWeek * w, 0, 100);
    // Band widens with time (uncertainty grows)
    const bandWidth = stdDev * (1 + w * 0.25);
    fwdPts.push({
      weekOffset: w,
      weekLabel: `+${w}w`,
      projected: Math.round(projected),
      optimistic: Math.round(clamp(projected + bandWidth, 0, 100)),
      pessimistic: Math.round(clamp(projected - bandWidth, 0, 100)),
      isHistory: false,
    });
  }

  return [...histPts, ...fwdPts];
}

// ── Success Probability Timeline ──────────────────────────────────────────────

export interface SuccessProbabilityPoint {
  weekOffset: number;
  weekLabel: string;
  probability: number;    // 0-100
  band: "strong" | "moderate" | "marginal" | "at_risk";
}

/**
 * Projects pass probability forward `weeks` weeks by projecting readiness
 * then re-running computePassProbability at each step.
 */
export function projectSuccessProbability(
  readiness: ExamReadinessResult,
  snapshots: MasterySnapshot[],
  velocityPerWeek: number,
  weeks = 8
): SuccessProbabilityPoint[] {
  const points: SuccessProbabilityPoint[] = [];

  for (let w = 0; w <= weeks; w++) {
    const projectedScore = clamp(readiness.score + velocityPerWeek * w, 0, 100);
    // Project readiness components proportionally
    const scaleFactor = projectedScore / Math.max(1, readiness.score);
    const projectedReadiness: ExamReadinessResult = {
      score: Math.round(projectedScore),
      band: readiness.band,
      components: {
        mastery:     clamp(readiness.components.mastery * (1 + (scaleFactor - 1) * 0.6), 0, 1),
        coverage:    clamp(readiness.components.coverage * (1 + (scaleFactor - 1) * 0.2), 0, 1),
        consistency: clamp(readiness.components.consistency * (1 + (scaleFactor - 1) * 0.1), 0, 1),
        recency:     readiness.components.recency,
      },
    };

    const pp = computePassProbability(projectedReadiness, snapshots);
    points.push({
      weekOffset: w,
      weekLabel: w === 0 ? "Now" : `+${w}w`,
      probability: pp.probability,
      band: pp.band,
    });
  }

  return points;
}

// ── Study Hour Prediction ─────────────────────────────────────────────────────

export interface StudyHourPrediction {
  hoursPerWeek: number;
  totalHoursNeeded: number;
  weeksToPrepare: number;
  breakdown: { subjectId: string; masteryGap: number; hoursNeeded: number }[];
  feasible: boolean;   // false when target is unreachable at current pace
}

const QUESTIONS_PER_HOUR = 30;
const MASTERY_GAIN_PER_QUESTION = 0.4; // ~0.4% mastery per correctly answered question

/**
 * Estimates weekly study hours needed for weak subjects to reach 75% mastery.
 * Uses mastery gap + empirical questions-per-hour rate.
 */
export function computeStudyHourPrediction(
  snapshots: MasterySnapshot[],
  velocityPerWeek: number,
  etaWeeks: number | null
): StudyHourPrediction {
  const TARGET = 75; // minimum comfortable mastery per subject
  const weeksAvailable = etaWeeks ?? 12;

  const weakSubjects = snapshots.filter(s => s.mastery < TARGET);

  const breakdown = weakSubjects.map(s => {
    const masteryGap = TARGET - s.mastery;
    const questionsNeeded = masteryGap / MASTERY_GAIN_PER_QUESTION;
    const hoursNeeded = Math.ceil(questionsNeeded / QUESTIONS_PER_HOUR);
    return { subjectId: s.subject_id, masteryGap, hoursNeeded };
  });

  const totalHoursNeeded = breakdown.reduce((sum, s) => sum + s.hoursNeeded, 0);
  const hoursPerWeek = weeksAvailable > 0
    ? Math.ceil(totalHoursNeeded / weeksAvailable)
    : totalHoursNeeded;

  const feasible = velocityPerWeek > 0 || hoursPerWeek <= 20;

  return {
    hoursPerWeek,
    totalHoursNeeded,
    weeksToPrepare: weeksAvailable,
    breakdown,
    feasible,
  };
}

// ── Weak Subject Forecast ─────────────────────────────────────────────────────

export interface WeakSubjectForecastPoint {
  subjectId: string;
  currentMastery: number;
  projections: number[];        // mastery at week 1..4
  crossesThresholdAt: number | null;  // week index when mastery ≥ 65
  classification: "CRITICAL" | "WEAK" | "DEVELOPING" | "STRONG";
  trend: MasterySnapshot["trend"];
}

const TREND_DELTA: Record<MasterySnapshot["trend"], number> = {
  IMPROVING:   +4.5,
  PROGRESSING: +2.0,
  STABLE:       0.0,
  REGRESSING:  -2.5,
  DECLINING:   -5.0,
};

/**
 * Projects mastery trajectory for each weak/critical subject over 4 weeks.
 * Uses per-subject trend delta as weekly rate.
 */
export function computeWeakSubjectForecast(
  snapshots: MasterySnapshot[]
): WeakSubjectForecastPoint[] {
  const atRisk = snapshots.filter(
    s => s.classification === "CRITICAL" || s.classification === "WEAK"
  );

  return atRisk.map(s => {
    const delta = TREND_DELTA[s.trend];
    const projections = [1, 2, 3, 4].map(w =>
      Math.round(clamp(s.mastery + delta * w, 0, 100))
    );
    const crossesAt = projections.findIndex(p => p >= 65);
    return {
      subjectId: s.subject_id,
      currentMastery: s.mastery,
      projections,
      crossesThresholdAt: crossesAt >= 0 ? crossesAt + 1 : null,
      classification: s.classification,
      trend: s.trend,
    };
  }).sort((a, b) => a.currentMastery - b.currentMastery);
}

// ── Mastery Trend Projection ──────────────────────────────────────────────────

export interface MasteryTrendProjectionPoint {
  weekLabel: string;
  weekOffset: number;   // negative = history, positive = projection
  avgAccuracy: number;  // across all subjects
  isProjection: boolean;
}

/**
 * Linear extrapolation from historical weekly average accuracy.
 * Uses least-squares slope on weeks with data.
 * Projects `forwardWeeks` into future.
 */
export function computeMasteryTrendProjection(
  historicalWeeks: MasteryHistoryPoint[],
  subjects: string[],
  forwardWeeks = 4
): MasteryTrendProjectionPoint[] {
  if (subjects.length === 0 || historicalWeeks.length === 0) return [];

  // Build (index, avgAccuracy) pairs for weeks with data
  const avgPerWeek: { idx: number; avg: number; label: string }[] = [];
  historicalWeeks.forEach((w, idx) => {
    const vals = subjects
      .map(s => w[s])
      .filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      avgPerWeek.push({
        idx,
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        label: w.weekLabel,
      });
    }
  });

  if (avgPerWeek.length === 0) return [];

  // Least-squares linear regression: y = slope*x + intercept
  const n = avgPerWeek.length;
  const sumX = avgPerWeek.reduce((s, p) => s + p.idx, 0);
  const sumY = avgPerWeek.reduce((s, p) => s + p.avg, 0);
  const sumXY = avgPerWeek.reduce((s, p) => s + p.idx * p.avg, 0);
  const sumX2 = avgPerWeek.reduce((s, p) => s + p.idx * p.idx, 0);
  const slope = (n * sumXY - sumX * sumY) / Math.max(1, n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Historical points
  const histPts: MasteryTrendProjectionPoint[] = avgPerWeek.map(p => ({
    weekLabel: p.label,
    weekOffset: p.idx - (historicalWeeks.length - 1),
    avgAccuracy: Math.round(p.avg),
    isProjection: false,
  }));

  // Forward projections
  const lastIdx = historicalWeeks.length - 1;
  const fwdPts: MasteryTrendProjectionPoint[] = Array.from({ length: forwardWeeks }, (_, i) => {
    const idx = lastIdx + i + 1;
    const projected = clamp(intercept + slope * idx, 0, 100);
    return {
      weekLabel: `+${i + 1}w`,
      weekOffset: i + 1,
      avgAccuracy: Math.round(projected),
      isProjection: true,
    };
  });

  return [...histPts, ...fwdPts];
}

// ── Combined M11B result ──────────────────────────────────────────────────────

export interface ForecastEngineResult {
  readinessTimeline: ReadinessTimelinePoint[];
  successProbabilityTimeline: SuccessProbabilityPoint[];
  studyHourPrediction: StudyHourPrediction;
  weakSubjectForecast: WeakSubjectForecastPoint[];
  masteryTrendProjection: MasteryTrendProjectionPoint[];
  projectedExamScore: number;   // estimated exam score % at current velocity after 8 weeks
  projectedExamScoreWeeks: number;
}

export function computeForecastEngine(
  readiness: ExamReadinessResult,
  snapshots: MasterySnapshot[],
  historicalWeeks: MasteryHistoryPoint[],
  subjects: string[],
  velocityPerWeek: number,
  etaWeeks: number | null
): ForecastEngineResult {
  // Historical readiness proxy: use average-of-subjects per week
  const historicalScores: number[] = historicalWeeks.map(w => {
    const vals = subjects.map(s => w[s]).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return readiness.score;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    // Approximate readiness from avg mastery (mastery is 45% weight)
    return Math.round(avg * 0.45 + readiness.score * 0.55);
  });

  const readinessTimeline = projectReadinessTimeline(
    readiness.score, velocityPerWeek, historicalScores, 8
  );

  const successProbabilityTimeline = projectSuccessProbability(
    readiness, snapshots, velocityPerWeek, 8
  );

  const studyHourPrediction = computeStudyHourPrediction(
    snapshots, velocityPerWeek, etaWeeks
  );

  const weakSubjectForecast = computeWeakSubjectForecast(snapshots);

  const masteryTrendProjection = computeMasteryTrendProjection(
    historicalWeeks, subjects, 4
  );

  // Projected exam score at +8 weeks (average mastery for "strong" subjects)
  const projectedWeeks = 8;
  const projectedScore = clamp(
    Math.round(
      snapshots.reduce((sum, s) => {
        const delta = TREND_DELTA[s.trend];
        return sum + clamp(s.mastery + delta * projectedWeeks, 0, 100);
      }, 0) / Math.max(1, snapshots.length)
    ),
    0, 100
  );

  return {
    readinessTimeline,
    successProbabilityTimeline,
    studyHourPrediction,
    weakSubjectForecast,
    masteryTrendProjection,
    projectedExamScore: projectedScore,
    projectedExamScoreWeeks: projectedWeeks,
  };
}
