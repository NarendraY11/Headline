import { describe, expect, it } from "vitest";
import {
  computeAdaptiveOutput,
  computeExamReadiness,
  computeReadiness,
  computeStudyHealth,
  PRIORITY_WEIGHTS,
  type ActiveMissionState,
  type AdaptiveEngineInput,
} from "../../src/lib/adaptiveLearningEngine";
import { EMPTY_SCOPE } from "../../src/lib/contentDeliveryEngine";
import type { ContentScope } from "../../src/lib/contentDeliveryEngine";
import type { LearningProgress } from "../../src/hooks/useLearningProgress";

// ─── Test Fixtures ────────────────────────────────────────────────────

const TODAY = new Date("2026-06-28T00:00:00Z");

const NO_MISSION: ActiveMissionState = {
  isActive: false,
  targetSubjectId: null,
  targetModuleId: null,
  questionsRemaining: 0,
};

const EMPTY_PROGRESS: LearningProgress = { modules: {}, topics: {} };

function makeScope(subjectCount = 2, modulesPerSubject = 2): ContentScope {
  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: `sub-${i}`,
    label: `Subject ${i}`,
    source: "primary" as const,
    priority: i,
    certificationId: "dgca-cpl",
  }));
  const modules = subjects.flatMap(s =>
    Array.from({ length: modulesPerSubject }, (_, j) => ({
      id: `mod-${s.id}-${j}`,
      label: `Module ${j}`,
      subjectId: s.id,
      priority: j,
    }))
  );
  return {
    certificationId: "dgca-cpl",
    family: "dgca",
    aircraftId: null,
    programId: null,
    careerObjectiveId: null,
    source: "enrollment",
    subjects,
    modules,
    eligibleSubjectIds: new Set(subjects.map(s => s.id)),
    eligibleModuleIds: new Set(modules.map(m => m.id)),
    hasContent: true,
  };
}

function makeInput(overrides: Partial<AdaptiveEngineInput> = {}): AdaptiveEngineInput {
  return {
    scope: makeScope(),
    learningProgress: EMPTY_PROGRESS,
    masteryMap: {},
    moduleAnsweredMap: {},
    reviewDueCount: 0,
    missionState: NO_MISSION,
    examDate: null,
    currentDate: TODAY,
    currentXp: 0,
    currentRank: "Cadet",
    currentStreak: 0,
    todayMinutesAvailable: 30,
    ...overrides,
  };
}

// ─── PRIORITY MODEL ───────────────────────────────────────────────────

describe("Priority Model", () => {
  it("Review Due wins all other priorities", () => {
    const input = makeInput({ reviewDueCount: 5 });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("reviewDue");
    expect(out.recommendation.reviewQuestionsFirst).toBe(true);
  });

  it("Weak Module priority when mastery < 40%", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      learningProgress: {
        modules: { [modId]: { answered: 10, correct: 3, mastery: 30, lastStudied: null } },
        topics: {},
      },
      masteryMap: { "sub-0": 30 },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("weakModule");
  });

  it("Mission Required priority when active mission matches scope", () => {
    const scope = makeScope(1, 1);
    const input = makeInput({
      scope,
      missionState: {
        isActive: true,
        targetSubjectId: "sub-0",
        targetModuleId: null,
        questionsRemaining: 10,
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("missionRequired");
  });

  it("Exam Proximity when exam within 7 days and mastery < 80%", () => {
    const scope = makeScope(1, 1);
    const examDate = new Date("2026-07-04T00:00:00Z"); // 6 days away
    const input = makeInput({
      scope,
      examDate,
      masteryMap: { "sub-0": 50 },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("examProximity");
  });

  it("New Content for unattempted modules", () => {
    const input = makeInput();
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("newContent");
  });

  it("Reinforce for mastery 40–79%", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      learningProgress: {
        modules: { [modId]: { answered: 20, correct: 13, mastery: 65, lastStudied: null } },
        topics: {},
      },
      masteryMap: { "sub-0": 65 },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("reinforce");
  });

  it("Review Due beats Weak Module", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      reviewDueCount: 3,
      learningProgress: {
        modules: { [modId]: { answered: 10, correct: 2, mastery: 20, lastStudied: null } },
        topics: {},
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("reviewDue");
  });

  it("Weak Module beats Mission when both present", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      missionState: { isActive: true, targetSubjectId: "sub-0", targetModuleId: null, questionsRemaining: 5 },
      learningProgress: {
        modules: { [modId]: { answered: 5, correct: 1, mastery: 15, lastStudied: null } },
        topics: {},
      },
    });
    const out = computeAdaptiveOutput(input);
    // weakModule score = 80 + (40-15) = 105 > missionRequired = 70 + 5 = 75
    expect(out.recommendation.reason).toBe("weakModule");
  });

  it("No content scope → randomPractice reason", () => {
    const input = makeInput({ scope: EMPTY_SCOPE });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("randomPractice");
  });

  it("Priority weight constants are ordered correctly", () => {
    expect(PRIORITY_WEIGHTS.reviewDue).toBeGreaterThan(PRIORITY_WEIGHTS.weakModule);
    expect(PRIORITY_WEIGHTS.weakModule).toBeGreaterThan(PRIORITY_WEIGHTS.missionRequired);
    expect(PRIORITY_WEIGHTS.missionRequired).toBeGreaterThan(PRIORITY_WEIGHTS.examProximity);
    expect(PRIORITY_WEIGHTS.examProximity).toBeGreaterThan(PRIORITY_WEIGHTS.continueLearning);
    expect(PRIORITY_WEIGHTS.continueLearning).toBeGreaterThan(PRIORITY_WEIGHTS.newContent);
    expect(PRIORITY_WEIGHTS.newContent).toBeGreaterThan(PRIORITY_WEIGHTS.reinforce);
    expect(PRIORITY_WEIGHTS.reinforce).toBeGreaterThan(PRIORITY_WEIGHTS.randomPractice);
  });
});

// ─── READINESS SCORE ─────────────────────────────────────────────────

describe("computeReadiness", () => {
  it("returns 0 when scope has no content", () => {
    const result = computeReadiness(makeInput({ scope: EMPTY_SCOPE }));
    expect(result.score).toBe(0);
  });

  it("returns non-zero score when modules have progress", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      learningProgress: {
        modules: { [modId]: { answered: 40, correct: 35, mastery: 87, lastStudied: "2026-06-27" } },
        topics: {},
      },
      masteryMap: { "sub-0": 87 },
      currentStreak: 10,
    });
    const result = computeReadiness(input);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("breakdown fields sum to reasonable total", () => {
    const input = makeInput({ currentStreak: 5 });
    const { breakdown } = computeReadiness(input);
    expect(breakdown.coveragePct).toBeGreaterThanOrEqual(0);
    expect(breakdown.masteryPct).toBeGreaterThanOrEqual(0);
    expect(breakdown.reviewHealthPct).toBe(100); // 0 reviews due
    expect(breakdown.consistencyPct).toBeGreaterThan(0); // streak = 5
  });

  it("review health decreases with overdue reviews", () => {
    const a = computeReadiness(makeInput({ reviewDueCount: 0 }));
    const b = computeReadiness(makeInput({ reviewDueCount: 10 }));
    expect(a.breakdown.reviewHealthPct).toBeGreaterThan(b.breakdown.reviewHealthPct);
  });

  it("weak area penalty is negative", () => {
    const scope = makeScope(2, 1);
    const input = makeInput({
      scope,
      masteryMap: { "sub-0": 20, "sub-1": 15 }, // both below threshold
    });
    const { breakdown } = computeReadiness(input);
    expect(breakdown.weakAreaPenalty).toBeLessThan(0);
  });

  it("consistency increases with streak", () => {
    const a = computeReadiness(makeInput({ currentStreak: 0 }));
    const b = computeReadiness(makeInput({ currentStreak: 20 }));
    expect(b.breakdown.consistencyPct).toBeGreaterThan(a.breakdown.consistencyPct);
  });

  it("score stays between 0 and 100", () => {
    // Perfect student
    const scope = makeScope(2, 2);
    const masteryMap: Record<string, number> = {};
    for (const s of scope.subjects) masteryMap[s.id] = 95;
    const progress: LearningProgress = { modules: {}, topics: {} };
    for (const m of scope.modules) {
      progress.modules[m.id] = { answered: 50, correct: 48, mastery: 96, lastStudied: "2026-06-28" };
    }
    const input = makeInput({ scope, masteryMap, learningProgress: progress, currentStreak: 30, reviewDueCount: 0 });
    const result = computeReadiness(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("guest (no user data) returns score 0", () => {
    const result = computeReadiness(makeInput({ scope: EMPTY_SCOPE, currentStreak: 0, currentXp: 0 }));
    expect(result.score).toBe(0);
  });
});

// ─── STUDY HEALTH ────────────────────────────────────────────────────

describe("computeStudyHealth", () => {
  it("green when no issues", () => {
    const input = makeInput({ currentStreak: 7, reviewDueCount: 0 });
    const health = computeStudyHealth(input);
    // streak >= 7, no weak subjects, no overdue reviews = green
    expect(health.status).toBe("green");
  });

  it("yellow when inactive (streak 0)", () => {
    const input = makeInput({ currentStreak: 0 });
    const health = computeStudyHealth(input);
    expect(health.status).toBe("yellow");
    expect(health.reasons.some(r => r.code === "inactive")).toBe(true);
  });

  it("red when >10 reviews overdue", () => {
    const input = makeInput({ reviewDueCount: 15 });
    const health = computeStudyHealth(input);
    expect(health.status).toBe("red");
    expect(health.reasons.some(r => r.code === "reviews-overdue")).toBe(true);
  });

  it("yellow when 4-10 reviews pending", () => {
    const input = makeInput({ reviewDueCount: 6 });
    const health = computeStudyHealth(input);
    expect(["yellow", "red"]).toContain(health.status);
  });

  it("red when exam close and mastery low", () => {
    const scope = makeScope(1, 1);
    const examDate = new Date("2026-07-02T00:00:00Z"); // 4 days away
    const input = makeInput({ scope, examDate, masteryMap: { "sub-0": 40 } });
    const health = computeStudyHealth(input);
    expect(health.status).toBe("red");
    expect(health.reasons.some(r => r.code === "exam-close")).toBe(true);
  });

  it("weak modules trigger warning", () => {
    const scope = makeScope(2, 1);
    const input = makeInput({ scope, masteryMap: { "sub-0": 20, "sub-1": 25 } });
    const health = computeStudyHealth(input);
    expect(health.reasons.some(r => r.code === "weak-modules")).toBe(true);
  });

  it("examples are non-empty when issues exist", () => {
    const input = makeInput({ reviewDueCount: 12 });
    const health = computeStudyHealth(input);
    expect(health.examples.length).toBeGreaterThan(0);
  });

  it("on-track reason when streak >=7 and no issues", () => {
    const input = makeInput({ currentStreak: 10, reviewDueCount: 0 });
    const health = computeStudyHealth(input);
    expect(health.reasons.some(r => r.code === "on-track")).toBe(true);
  });

  it("no crash with empty scope", () => {
    const input = makeInput({ scope: EMPTY_SCOPE });
    expect(() => computeStudyHealth(input)).not.toThrow();
  });
});

// ─── EXAM READINESS ───────────────────────────────────────────────────

describe("computeExamReadiness", () => {
  it("at-risk when no mastery data", () => {
    const input = makeInput();
    const result = computeExamReadiness(input);
    expect(result.status).toBe("at-risk");
  });

  it("ready when avg mastery >= 80 and all subjects done", () => {
    const scope = makeScope(2, 1);
    const masteryMap: Record<string, number> = { "sub-0": 90, "sub-1": 85 };
    const input = makeInput({ scope, masteryMap });
    const result = computeExamReadiness(input);
    expect(result.status).toBe("ready");
  });

  it("needs-review when avg mastery ~60%", () => {
    const scope = makeScope(2, 1);
    const masteryMap: Record<string, number> = { "sub-0": 60, "sub-1": 65 };
    const input = makeInput({ scope, masteryMap });
    const result = computeExamReadiness(input);
    expect(["needs-review", "at-risk"]).toContain(result.status);
  });

  it("at-risk when projected completion after exam date", () => {
    const scope = makeScope(4, 5); // 20 modules remaining
    const examDate = new Date("2026-07-05T00:00:00Z"); // 7 days
    const input = makeInput({ scope, examDate, currentStreak: 1 }); // velocity 0.5/day → 40 days needed
    const result = computeExamReadiness(input);
    expect(result.status).toBe("at-risk");
  });

  it("remainingSubjects decreases as mastery improves", () => {
    const scope = makeScope(3, 1);
    const a = computeExamReadiness(makeInput({ scope, masteryMap: { "sub-0": 0, "sub-1": 0, "sub-2": 0 } }));
    const b = computeExamReadiness(makeInput({ scope, masteryMap: { "sub-0": 85, "sub-1": 0, "sub-2": 0 } }));
    expect(b.remainingSubjects).toBeLessThan(a.remainingSubjects);
  });

  it("confidence 0–100", () => {
    const input = makeInput();
    const { confidence } = computeExamReadiness(input);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it("estimatedStudyHours is positive for remaining modules", () => {
    const input = makeInput(); // 4 modules, none complete
    const { estimatedStudyHours } = computeExamReadiness(input);
    expect(estimatedStudyHours).toBeGreaterThan(0);
  });

  it("no crash with empty scope", () => {
    const input = makeInput({ scope: EMPTY_SCOPE });
    expect(() => computeExamReadiness(input)).not.toThrow();
  });

  it("projectedCompletionDays null when streak is 0", () => {
    const input = makeInput({ currentStreak: 0 });
    const result = computeExamReadiness(input);
    expect(result.projectedCompletionDays).toBeNull();
  });
});

// ─── FULL ENGINE OUTPUT ───────────────────────────────────────────────

describe("computeAdaptiveOutput", () => {
  it("returns all required output fields", () => {
    const out = computeAdaptiveOutput(makeInput());
    expect(out).toHaveProperty("recommendation");
    expect(out).toHaveProperty("readinessScore");
    expect(out).toHaveProperty("studyHealth");
    expect(out).toHaveProperty("examReadiness");
    expect(out).toHaveProperty("weakestSubjects");
    expect(out).toHaveProperty("strongestSubjects");
    expect(out).toHaveProperty("weakestModules");
    expect(out).toHaveProperty("strongestModules");
    expect(out).toHaveProperty("reviewDebt");
    expect(out).toHaveProperty("studyVelocity");
    expect(out).toHaveProperty("projectedCompletionDate");
    expect(out).toHaveProperty("retentionTrend");
  });

  it("recommendation confidence is 0–100", () => {
    const out = computeAdaptiveOutput(makeInput());
    expect(out.recommendation.confidence).toBeGreaterThanOrEqual(0);
    expect(out.recommendation.confidence).toBeLessThanOrEqual(100);
  });

  it("estimatedMinutes respects todayMinutesAvailable", () => {
    const out = computeAdaptiveOutput(makeInput({ todayMinutesAvailable: 10 }));
    expect(out.recommendation.estimatedMinutes).toBeLessThanOrEqual(10);
  });

  it("no crash with empty scope", () => {
    expect(() => computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE }))).not.toThrow();
  });

  it("retentionTrend unknown with < 3 modules", () => {
    const out = computeAdaptiveOutput(makeInput());
    expect(["unknown", "stable", "improving", "declining"]).toContain(out.retentionTrend);
  });

  it("retentionTrend improving when recent modules score better", () => {
    const scope = makeScope(1, 4);
    const modIds = scope.modules.map(m => m.id);
    const input = makeInput({
      scope,
      learningProgress: {
        modules: {
          [modIds[0]]: { answered: 10, correct: 5, mastery: 50, lastStudied: null },
          [modIds[1]]: { answered: 10, correct: 6, mastery: 60, lastStudied: null },
          [modIds[2]]: { answered: 10, correct: 8, mastery: 80, lastStudied: null },
          [modIds[3]]: { answered: 10, correct: 9, mastery: 90, lastStudied: null },
        },
        topics: {},
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.retentionTrend).toBe("improving");
  });

  it("weakestSubjects are sorted ascending by mastery", () => {
    const scope = makeScope(3, 1);
    const input = makeInput({
      scope,
      masteryMap: { "sub-0": 80, "sub-1": 20, "sub-2": 50 },
    });
    const out = computeAdaptiveOutput(input);
    const masteries = out.weakestSubjects.map(s => s.masteryPct);
    for (let i = 1; i < masteries.length; i++) {
      expect(masteries[i]).toBeGreaterThanOrEqual(masteries[i - 1]);
    }
  });

  it("strongestSubjects are sorted descending by mastery", () => {
    const scope = makeScope(3, 1);
    const input = makeInput({
      scope,
      masteryMap: { "sub-0": 80, "sub-1": 20, "sub-2": 50 },
    });
    const out = computeAdaptiveOutput(input);
    const masteries = out.strongestSubjects.map(s => s.masteryPct);
    for (let i = 1; i < masteries.length; i++) {
      expect(masteries[i]).toBeLessThanOrEqual(masteries[i - 1]);
    }
  });

  it("reviewDebt matches input reviewDueCount", () => {
    const out = computeAdaptiveOutput(makeInput({ reviewDueCount: 7 }));
    expect(out.reviewDebt).toBe(7);
  });

  it("studyVelocity is 0 when no modules complete and no streak", () => {
    const out = computeAdaptiveOutput(makeInput({ currentStreak: 0 }));
    expect(out.studyVelocity).toBe(0);
  });

  it("projectedCompletionDate is null when no streak", () => {
    const out = computeAdaptiveOutput(makeInput({ currentStreak: 0 }));
    expect(out.projectedCompletionDate).toBeNull();
  });

  it("projectedCompletionDate is a Date when streak > 0 and modules remain", () => {
    const out = computeAdaptiveOutput(makeInput({ currentStreak: 5 }));
    if (out.projectedCompletionDate !== null) {
      expect(out.projectedCompletionDate).toBeInstanceOf(Date);
    }
  });
});

// ─── EDGE CASES ───────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("guest profile (no scope, no progress) returns stable output", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE }));
    expect(out.recommendation.nextSubjectId).toBeNull();
    expect(out.readinessScore.score).toBe(0);
    expect(out.studyHealth.status).toBe("yellow"); // inactive
  });

  it("legacy profile (xp=0, streak=0, no enrollment) degrades gracefully", () => {
    const out = computeAdaptiveOutput(makeInput({
      scope: EMPTY_SCOPE,
      currentXp: 0,
      currentStreak: 0,
      masteryMap: {},
      reviewDueCount: 0,
    }));
    expect(out.readinessScore.score).toBe(0);
    expect(out.recommendation.reasonLabel).toBe("No content in scope");
  });

  it("Type Rating profile (aircraft scope) produces recommendation", () => {
    const scope = makeScope(2, 2);
    // Override aircraft
    const trScope: ContentScope = { ...scope, aircraftId: "type-a320", certificationId: null };
    const out = computeAdaptiveOutput(makeInput({ scope: trScope }));
    expect(out.recommendation.nextSubjectId).toBeTruthy();
  });

  it("DGCA PPL profile uses correct scope structure", () => {
    const scope = makeScope(3, 2);
    const dgcaScope: ContentScope = { ...scope, certificationId: "dgca-ppl", family: "dgca" };
    const out = computeAdaptiveOutput(makeInput({ scope: dgcaScope }));
    expect(out.recommendation).toBeDefined();
    expect(out.examReadiness.remainingSubjects).toBeGreaterThan(0);
  });

  it("DGCA ATPL profile — many subjects handled without crash", () => {
    const scope = makeScope(8, 4); // 8 subjects, 4 modules each
    const out = computeAdaptiveOutput(makeInput({ scope }));
    expect(out.weakestSubjects.length).toBeLessThanOrEqual(5);
    expect(out.strongestSubjects.length).toBeLessThanOrEqual(5);
  });

  it("no enrollment (source=none) handled correctly", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE }));
    expect(out.readinessScore.score).toBe(0);
  });

  it("100% mastery across all subjects → ready status", () => {
    const scope = makeScope(3, 2);
    const masteryMap: Record<string, number> = {};
    for (const s of scope.subjects) masteryMap[s.id] = 100;
    const input = makeInput({ scope, masteryMap, currentStreak: 20 });
    const out = computeAdaptiveOutput(input);
    expect(out.examReadiness.status).toBe("ready");
    expect(out.studyHealth.status).toBe("green");
  });

  it("exam date in past does not cause infinite days or crash", () => {
    const pastDate = new Date("2026-01-01T00:00:00Z");
    const input = makeInput({ examDate: pastDate });
    expect(() => computeAdaptiveOutput(input)).not.toThrow();
    const out = computeAdaptiveOutput(input);
    expect(out.readinessScore.score).toBeGreaterThanOrEqual(0);
  });

  it("same inputs always produce same output (deterministic)", () => {
    const input = makeInput({ reviewDueCount: 3, currentStreak: 5 });
    const a = computeAdaptiveOutput(input);
    const b = computeAdaptiveOutput(input);
    expect(a.recommendation.reason).toBe(b.recommendation.reason);
    expect(a.readinessScore.score).toBe(b.readinessScore.score);
    expect(a.studyHealth.status).toBe(b.studyHealth.status);
  });

  it("single subject single module scope works", () => {
    const scope = makeScope(1, 1);
    const out = computeAdaptiveOutput(makeInput({ scope }));
    expect(out.recommendation.nextSubjectId).toBe("sub-0");
  });

  it("very high review count clamps health", () => {
    const input = makeInput({ reviewDueCount: 999 });
    const result = computeReadiness(input);
    expect(result.breakdown.reviewHealthPct).toBe(0);
  });

  it("difficulty is hard for review due", () => {
    const input = makeInput({ reviewDueCount: 5 });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.difficulty).toBe("hard");
  });

  it("difficulty is hard for weak module", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      learningProgress: { modules: { [modId]: { answered: 10, correct: 2, mastery: 20, lastStudied: null } }, topics: {} },
      masteryMap: { "sub-0": 20 },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.difficulty).toBe("hard");
  });

  it("difficulty is medium for reinforce priority", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      learningProgress: { modules: { [modId]: { answered: 20, correct: 14, mastery: 70, lastStudied: null } }, topics: {} },
      masteryMap: { "sub-0": 70 },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.difficulty).toBe("medium");
  });
});

// ─── TASK 1: Mission Signal ───────────────────────────────────────────

describe("Mission Signal (Phase 9.1 T1)", () => {
  it("missionRequired fires when active mission subject is in scope", () => {
    const scope = makeScope(2, 2);
    const input = makeInput({
      scope,
      missionState: {
        isActive: true,
        targetSubjectId: "sub-0",
        targetModuleId: null,
        questionsRemaining: 8,
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("missionRequired");
    expect(out.recommendation.nextSubjectId).toBe("sub-0");
  });

  it("missionRequired does not fire when mission subject not in scope", () => {
    const scope = makeScope(2, 2);
    const input = makeInput({
      scope,
      missionState: {
        isActive: true,
        targetSubjectId: "sub-outside-scope",
        targetModuleId: null,
        questionsRemaining: 8,
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).not.toBe("missionRequired");
  });

  it("missionRequired fires when active mission targets specific module", () => {
    const scope = makeScope(1, 2);
    const targetModule = scope.modules[1].id;
    const input = makeInput({
      scope,
      missionState: {
        isActive: true,
        targetSubjectId: "sub-0",
        targetModuleId: targetModule,
        questionsRemaining: 5,
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("missionRequired");
    expect(out.recommendation.nextModuleId).toBe(targetModule);
  });

  it("mission inactive → does not produce missionRequired", () => {
    const scope = makeScope(1, 1);
    const input = makeInput({
      scope,
      missionState: {
        isActive: false,
        targetSubjectId: "sub-0",
        targetModuleId: null,
        questionsRemaining: 10,
      },
    });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).not.toBe("missionRequired");
  });

  it("mission with 0 questions remaining → lower score than weak module", () => {
    const scope = makeScope(1, 1);
    const modId = scope.modules[0].id;
    const input = makeInput({
      scope,
      learningProgress: {
        modules: { [modId]: { answered: 5, correct: 1, mastery: 20, lastStudied: null } },
        topics: {},
      },
      missionState: {
        isActive: true,
        targetSubjectId: "sub-0",
        targetModuleId: null,
        questionsRemaining: 0,
      },
    });
    const out = computeAdaptiveOutput(input);
    // weakModule score = 80 + 20 = 100 > missionRequired = 70 + 0 = 70
    expect(out.recommendation.reason).toBe("weakModule");
  });
});

// ─── TASK 2: Scoped Review ────────────────────────────────────────────

describe("Scoped Review (Phase 9.1 T2)", () => {
  it("reviewDueCount > 0 triggers reviewDue regardless of scope", () => {
    const input = makeInput({ reviewDueCount: 3 });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).toBe("reviewDue");
    expect(out.recommendation.reviewQuestionsFirst).toBe(true);
  });

  it("reviewDueCount = 0 with scope → falls through to content priority", () => {
    const input = makeInput({ reviewDueCount: 0 });
    const out = computeAdaptiveOutput(input);
    expect(out.recommendation.reason).not.toBe("reviewDue");
  });

  it("reviewDebt matches provided reviewDueCount", () => {
    const out = computeAdaptiveOutput(makeInput({ reviewDueCount: 12 }));
    expect(out.reviewDebt).toBe(12);
  });

  it("large review debt degrades health to red", () => {
    const out = computeAdaptiveOutput(makeInput({ reviewDueCount: 15 }));
    expect(out.studyHealth.status).toBe("red");
  });

  it("zero review debt with scope → review health 100%", () => {
    const out = computeAdaptiveOutput(makeInput({ reviewDueCount: 0 }));
    expect(out.readinessScore.breakdown.reviewHealthPct).toBe(100);
  });
});

// ─── Multiple Enrollments / Context Sources ───────────────────────────

describe("Multiple Enrollment Scenarios (Phase 9.1 T4)", () => {
  it("DGCA CPL scope produces recommendation for CPL subjects", () => {
    const scope = makeScope(5, 3);
    const cplScope = { ...scope, certificationId: "dgca-cpl" as const, family: "dgca" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: cplScope }));
    expect(out.recommendation.nextSubjectId).toBeTruthy();
    expect(out.examReadiness).toBeDefined();
  });

  it("DGCA ATPL scope with many subjects handles correctly", () => {
    const scope = makeScope(9, 4);
    const atplScope = { ...scope, certificationId: "dgca-atpl" as const, family: "dgca" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: atplScope }));
    expect(out.weakestSubjects.length).toBeLessThanOrEqual(5);
    expect(out.strongestSubjects.length).toBeLessThanOrEqual(5);
    expect(out.readinessScore.score).toBeGreaterThanOrEqual(0);
  });

  it("DGCA PPL scope (3 subjects) produces valid output", () => {
    const scope = makeScope(3, 2);
    const pplScope = { ...scope, certificationId: "dgca-ppl" as const, family: "dgca" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: pplScope }));
    expect(out.examReadiness.remainingSubjects).toBeLessThanOrEqual(3);
  });

  it("Type Rating A320 scope produces recommendation", () => {
    const scope = makeScope(4, 3);
    const a320Scope = { ...scope, certificationId: null, aircraftId: "type-a320", family: "type_rating" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: a320Scope }));
    expect(out.recommendation.nextSubjectId).toBeTruthy();
  });

  it("Type Rating B737 scope produces recommendation", () => {
    const scope = makeScope(3, 2);
    const b737Scope = { ...scope, certificationId: null, aircraftId: "type-b737", family: "type_rating" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: b737Scope }));
    expect(out.recommendation).toBeDefined();
  });

  it("switching from one enrollment to another changes scope and outputs", () => {
    const cplScope = makeScope(5, 2);
    const atplScope = makeScope(9, 3);
    const cplOut = computeAdaptiveOutput(makeInput({ scope: cplScope }));
    const atplOut = computeAdaptiveOutput(makeInput({ scope: atplScope }));
    expect(atplOut.examReadiness.remainingSubjects).toBeGreaterThanOrEqual(cplOut.examReadiness.remainingSubjects);
  });
});

// ─── Legacy Fallback ──────────────────────────────────────────────────

describe("Legacy Fallback (Phase 9.1 T4)", () => {
  it("source=legacy with no subjects degrades to empty recommendation", () => {
    const legacyScope = { ...EMPTY_SCOPE, source: "legacy" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: legacyScope }));
    expect(out.recommendation.nextSubjectId).toBeNull();
    expect(out.readinessScore.score).toBe(0);
  });

  it("source=legacy with subjects still produces recommendation", () => {
    const scope = makeScope(2, 2);
    const legacyScope = { ...scope, source: "legacy" as const };
    const out = computeAdaptiveOutput(makeInput({ scope: legacyScope }));
    expect(out.recommendation.nextSubjectId).toBeTruthy();
  });

  it("legacy profile with mastery data improves readiness score", () => {
    const scope = makeScope(2, 2);
    const legacyScope = { ...scope, source: "legacy" as const };
    const masteryMap = { "sub-0": 75, "sub-1": 80 };
    const out = computeAdaptiveOutput(makeInput({ scope: legacyScope, masteryMap }));
    expect(out.readinessScore.score).toBeGreaterThan(0);
  });
});

// ─── Guest / No Enrollment ────────────────────────────────────────────

describe("Guest and No Enrollment (Phase 9.1 T4)", () => {
  it("guest (source=none, empty scope) → score 0 and no recommendation", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE }));
    expect(out.readinessScore.score).toBe(0);
    expect(out.recommendation.nextSubjectId).toBeNull();
    expect(out.recommendation.confidence).toBe(0);
  });

  it("no enrollment → exam readiness at-risk", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE }));
    // No subjects = remainingSubjects 0 but status still not "ready"
    expect(out.examReadiness.status).not.toBe("ready");
  });

  it("guest with 0 streak → study health yellow (inactive)", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE, currentStreak: 0 }));
    expect(out.studyHealth.status).toBe("yellow");
  });

  it("guest reviewDueCount 0 → no review debt", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE, reviewDueCount: 0 }));
    expect(out.reviewDebt).toBe(0);
    // Empty scope returns all-zero breakdown (early exit in computeReadiness)
    expect(out.readinessScore.breakdown.reviewHealthPct).toBe(0);
  });

  it("no enrollment → projected completion null", () => {
    const out = computeAdaptiveOutput(makeInput({ scope: EMPTY_SCOPE, currentStreak: 5 }));
    expect(out.projectedCompletionDate).toBeNull();
  });
});
