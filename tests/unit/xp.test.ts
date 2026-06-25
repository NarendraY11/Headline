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

// =====================================================================
// Phase 7.4 — didRankUp: achievement XP inclusion scenarios
//
// These cases mirror the five finishQuiz test cases from the spec.
// The rank-up call now happens AFTER achievement XP is accumulated, so
// the combined delta (quiz + achievement) must be tested here.
// =====================================================================

describe("didRankUp — Phase 7.4 achievement XP inclusion", () => {
  // Case A: quiz XP alone, no threshold crossed → null
  it("Case A: no rank-up — quiz XP stays in same band", () => {
    // user at 100 XP earns 40 (qXp 30 + quiz 10) → 140, stays Student Pilot
    expect(didRankUp(100, 100 + 40)).toBeNull();
  });

  // Case B: quiz/mission XP alone crosses threshold
  it("Case B: normal rank-up from quiz+mission XP", () => {
    // user at 230 XP earns 25 (qXp 15 + quiz 10) → 255, crosses 250 Solo Endorsed
    expect(didRankUp(230, 230 + 25)?.name).toBe("Solo Endorsed");
  });

  // Case C: achievement XP is what crosses the threshold
  it("Case C: rank-up ONLY because achievement XP is included in total delta", () => {
    // user at 230 XP, quiz earns 10 → 240 (below 250, no rank-up from quiz alone)
    expect(didRankUp(230, 230 + 10)).toBeNull();
    // same user, quiz (10) + achievement_unlock (50) → total awarded 60 → 290
    // now crosses 250 threshold
    expect(didRankUp(230, 230 + 60)?.name).toBe("Solo Endorsed");
  });

  // Case D: retry / double-submit → awarded = 0 → no phantom
  it("Case D: idempotent re-finish — awarded 0 means didRankUp is not called (guard check)", () => {
    // When awarded = 0, the guard `xpEarnedThisFinish > 0` skips didRankUp.
    // Verify didRankUp(x, x) returns null — same balance = no cross.
    expect(didRankUp(500, 500)).toBeNull();
    expect(didRankUp(250, 250)).toBeNull(); // already at Solo Endorsed, no new cross
  });

  // Case E: achievement already unlocked (wasNew=false) — no XP, no phantom rank-up
  it("Case E: duplicate achievement — wasNew=false means 0 achievement XP added", () => {
    // If achievement was already unlocked (wasNew=false), xpEarnedThisFinish
    // only has quiz XP. Verify quiz-only delta that does not cross is null.
    const quizOnlyAwarded = 10; // quiz_completed flat, no new achievement XP
    const xpBefore = 230;
    expect(didRankUp(xpBefore, xpBefore + quizOnlyAwarded)).toBeNull();
  });
});
