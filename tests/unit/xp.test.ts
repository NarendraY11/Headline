import { describe, it, expect } from "vitest";
import { computeQuizQuestionXp, XP_VALUES } from "../../src/lib/xpValues";

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
