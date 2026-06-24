import { describe, it, expect } from "vitest";
import { computeQuizQuestionXp, XP_VALUES, computeRank, didRankUp, RANKS } from "../../src/lib/xpValues";

describe("computeQuizQuestionXp", () => {
  it("rewards correct more than wrong, but every answer earns", () => {
    // 8 correct, 2 wrong of 10
    expect(computeQuizQuestionXp(8, 10)).toBe(8 * XP_VALUES.questionCorrect + 2 * XP_VALUES.questionWrong);
  });

  it("all correct", () => {
    expect(computeQuizQuestionXp(10, 10)).toBe(10 * XP_VALUES.questionCorrect);
  });

  it("all wrong still earns participation XP", () => {
    expect(computeQuizQuestionXp(0, 10)).toBe(10 * XP_VALUES.questionWrong);
  });

  it("clamps correct to total (never negative wrong, never over-credit)", () => {
    expect(computeQuizQuestionXp(15, 10)).toBe(10 * XP_VALUES.questionCorrect);
    expect(computeQuizQuestionXp(-3, 10)).toBe(10 * XP_VALUES.questionWrong);
  });

  it("zero questions = zero XP", () => {
    expect(computeQuizQuestionXp(0, 0)).toBe(0);
  });

  it("XP values are all positive (DB CHECK amount > 0)", () => {
    for (const v of Object.values(XP_VALUES)) expect(v).toBeGreaterThan(0);
  });
});

describe("computeRank", () => {
  it("0 XP = Student Pilot, full progress fraction toward next", () => {
    const r = computeRank(0);
    expect(r.rank.name).toBe("Student Pilot");
    expect(r.index).toBe(0);
    expect(r.next?.name).toBe("Solo Endorsed");
    expect(r.xpRemaining).toBe(250);
    expect(r.progress).toBe(0);
    expect(r.isMax).toBe(false);
  });

  it("exact threshold lands on the new rank (inclusive)", () => {
    expect(computeRank(250).rank.name).toBe("Solo Endorsed");
    expect(computeRank(750).rank.name).toBe("PPL Rated");
    expect(computeRank(2000).rank.name).toBe("CPL Candidate");
    expect(computeRank(5000).rank.name).toBe("ATPL Candidate");
    expect(computeRank(10000).rank.name).toBe("ATPL Holder");
  });

  it("mid-tier progress is the fraction into the current band", () => {
    // 1375 = halfway between 750 (PPL Rated) and 2000 (CPL Candidate)
    const r = computeRank(1375);
    expect(r.rank.name).toBe("PPL Rated");
    expect(r.xpIntoRank).toBe(625);
    expect(r.xpForNext).toBe(1250);
    expect(r.progress).toBeCloseTo(0.5, 5);
    expect(r.xpRemaining).toBe(625);
  });

  it("top rank: no next, progress pinned to 1, isMax", () => {
    const r = computeRank(99999);
    expect(r.rank.name).toBe("ATPL Holder");
    expect(r.next).toBeNull();
    expect(r.isMax).toBe(true);
    expect(r.progress).toBe(1);
    expect(r.xpRemaining).toBe(0);
  });

  it("negative / fractional XP clamps to Student Pilot", () => {
    expect(computeRank(-100).rank.name).toBe("Student Pilot");
    expect(computeRank(249.9).rank.name).toBe("Student Pilot");
  });

  it("RANKS are strictly ascending and start at 0", () => {
    expect(RANKS[0].threshold).toBe(0);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].threshold).toBeGreaterThan(RANKS[i - 1].threshold);
    }
  });
});

describe("didRankUp", () => {
  it("returns the new rank when a threshold is crossed", () => {
    expect(didRankUp(240, 260)?.name).toBe("Solo Endorsed");
    expect(didRankUp(0, 800)?.name).toBe("PPL Rated"); // skips through a tier
  });

  it("returns null when staying within the same rank", () => {
    expect(didRankUp(10, 50)).toBeNull();
    expect(didRankUp(300, 400)).toBeNull();
  });

  it("returns null when XP did not increase (idempotent re-finish)", () => {
    expect(didRankUp(500, 500)).toBeNull();
    expect(didRankUp(500, 400)).toBeNull();
  });

  it("landing exactly on a threshold counts as a rank-up", () => {
    expect(didRankUp(249, 250)?.name).toBe("Solo Endorsed");
  });
});
