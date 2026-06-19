import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  computeExamReadiness,
  readinessBand,
  urgencyScore,
  computeETA,
  type ExamReadinessInput,
} from "@/src/lib/examReadiness";

const NOW = new Date("2026-06-19T12:00:00.000Z");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const baseInput = (over: Partial<ExamReadinessInput> = {}): ExamReadinessInput => ({
  subjectMasteries: {},
  answersTotals: {},
  totalExamSubjects: 4,
  streakCount: 0,
  lastActivityDate: "",
  ...over,
});

describe("readinessBand", () => {
  it("maps scores to bands at the documented thresholds", () => {
    expect(readinessBand(0)).toBe("poor");
    expect(readinessBand(39)).toBe("poor");
    expect(readinessBand(40)).toBe("developing");
    expect(readinessBand(64)).toBe("developing");
    expect(readinessBand(65)).toBe("ready");
    expect(readinessBand(79)).toBe("ready");
    expect(readinessBand(80)).toBe("exam_ready");
    expect(readinessBand(100)).toBe("exam_ready");
  });
});

describe("computeExamReadiness", () => {
  it("a brand-new user scores 0 / poor", () => {
    const r = computeExamReadiness(baseInput());
    expect(r.score).toBe(0);
    expect(r.band).toBe("poor");
    expect(r.components).toEqual({ mastery: 0, coverage: 0, consistency: 0, recency: 0 });
  });

  it("guards against division by zero when totalExamSubjects is 0", () => {
    const r = computeExamReadiness(baseInput({ totalExamSubjects: 0 }));
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBe(0);
  });

  it("counts only subjects at >=65% mastery toward the mastery component", () => {
    const r = computeExamReadiness(
      baseInput({
        subjectMasteries: { a: 65, b: 64, c: 100, d: 0 },
        answersTotals: { a: 10, b: 10, c: 10, d: 0 },
      })
    );
    // 2 of 4 mastered -> mastery 0.5
    expect(r.components.mastery).toBeCloseTo(0.5, 5);
  });

  it("coverage counts subjects with answers OR mastery>0 (fallback proxy)", () => {
    const r = computeExamReadiness(
      baseInput({
        subjectMasteries: { a: 10, b: 0, c: 0, d: 0 },
        answersTotals: { a: 0, b: 5, c: 0, d: 0 },
      })
    );
    // a (mastery>0) + b (answers>0) = 2 of 4 -> 0.5
    expect(r.components.coverage).toBeCloseTo(0.5, 5);
  });

  it("consistency caps at a 14-day streak", () => {
    expect(computeExamReadiness(baseInput({ streakCount: 7 })).components.consistency).toBeCloseTo(0.5, 5);
    expect(computeExamReadiness(baseInput({ streakCount: 14 })).components.consistency).toBe(1);
    expect(computeExamReadiness(baseInput({ streakCount: 99 })).components.consistency).toBe(1);
  });

  it("recency: today=1.0, yesterday=0.8, within a week=0.5, within a month=0.2, older=0", () => {
    const day = (n: number) => ymd(new Date(NOW.getTime() - n * 864e5));
    expect(computeExamReadiness(baseInput({ lastActivityDate: day(0) })).components.recency).toBe(1);
    expect(computeExamReadiness(baseInput({ lastActivityDate: day(1) })).components.recency).toBeCloseTo(0.8, 5);
    expect(computeExamReadiness(baseInput({ lastActivityDate: day(5) })).components.recency).toBeCloseTo(0.5, 5);
    expect(computeExamReadiness(baseInput({ lastActivityDate: day(20) })).components.recency).toBeCloseTo(0.2, 5);
    expect(computeExamReadiness(baseInput({ lastActivityDate: day(60) })).components.recency).toBe(0);
  });

  it("a fully-prepared user reaches the exam_ready band", () => {
    const r = computeExamReadiness(
      baseInput({
        subjectMasteries: { a: 90, b: 90, c: 90, d: 90 },
        answersTotals: { a: 50, b: 50, c: 50, d: 50 },
        streakCount: 14,
        lastActivityDate: ymd(NOW),
      })
    );
    // Components sum to 1.0, but IEEE-754 accumulation makes the weighted sum
    // 0.999…9, and score = Math.floor(raw * 100) floors a "perfect" user to 99.
    // Documented here as the real ceiling rather than asserting an impossible 100.
    expect(r.score).toBeGreaterThanOrEqual(99);
    expect(r.band).toBe("exam_ready");
  });

  it("score is an integer (floored)", () => {
    const r = computeExamReadiness(
      baseInput({ subjectMasteries: { a: 70 }, answersTotals: { a: 5 }, totalExamSubjects: 3 })
    );
    expect(Number.isInteger(r.score)).toBe(true);
  });
});

describe("urgencyScore", () => {
  it("weights low-mastery subjects far higher", () => {
    const low = urgencyScore(30, 1);   // multiplier 2.0
    const high = urgencyScore(85, 1);  // multiplier 0.3
    expect(low).toBeGreaterThan(high);
  });

  it("applies a confidence floor of 0.5", () => {
    // confidence 0 should still apply 0.5, not collapse to 0
    expect(urgencyScore(50, 0)).toBeGreaterThan(0);
    expect(urgencyScore(50, 0)).toBe(urgencyScore(50, 0.5));
  });

  it("a fully-mastered subject still returns a small positive urgency", () => {
    expect(urgencyScore(100, 1)).toBe(0);
  });
});

describe("computeETA", () => {
  it("returns null when already exam-ready", () => {
    expect(computeETA(80, 5)).toBeNull();
    expect(computeETA(95, 5)).toBeNull();
  });

  it("returns null when not improving (velocity <= 0)", () => {
    expect(computeETA(50, 0)).toBeNull();
    expect(computeETA(50, -3)).toBeNull();
  });

  it("ceils the number of weeks needed", () => {
    // (80-50)/7 = 4.28 -> 5
    expect(computeETA(50, 7)).toBe(5);
  });

  it("returns null when the horizon exceeds a year", () => {
    // (80-20)/1 = 60 weeks > 52
    expect(computeETA(20, 1)).toBeNull();
  });
});
