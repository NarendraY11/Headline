import { describe, it, expect, vi } from "vitest";

// spacedRepetition.ts imports the real supabase client at module load. The pure
// scheduling functions under test never touch it, so stub the module to keep
// the unit boundary clean and offline.
vi.mock("@/src/lib/supabase", () => ({ supabase: {} }));

import {
  calculateNextReview,
  deriveQuality,
  calculateNextReviewSM2,
} from "@/src/lib/spacedRepetition";

describe("calculateNextReview (SM-lite)", () => {
  it("a wrong answer resets the interval to 0 and lowers ease", () => {
    const r = calculateNextReview({ seen_count: 3, ease: 2.5, interval: 7 }, false);
    expect(r.interval).toBe(0);
    expect(r.ease).toBeCloseTo(2.3, 5);
    expect(r.correct).toBe(false);
  });

  it("ease never drops below the 1.3 floor", () => {
    const r = calculateNextReview({ seen_count: 1, ease: 1.3, interval: 0 }, false);
    expect(r.ease).toBe(1.3);
  });

  it("correct answers ramp the interval 1 -> 3 -> 7 -> 21 by seen_count", () => {
    expect(calculateNextReview({ seen_count: 0 }, true).interval).toBe(1);
    expect(calculateNextReview({ seen_count: 1 }, true).interval).toBe(3);
    expect(calculateNextReview({ seen_count: 2 }, true).interval).toBe(7);
    expect(calculateNextReview({ seen_count: 3 }, true).interval).toBe(21);
    expect(calculateNextReview({ seen_count: 10 }, true).interval).toBe(21);
  });

  it("ease is capped at 2.8 on repeated correct answers", () => {
    const r = calculateNextReview({ seen_count: 3, ease: 2.8 }, true);
    expect(r.ease).toBe(2.8);
  });

  it("defaults a null progress record to ease 2.5 and first interval", () => {
    const r = calculateNextReview(null, true);
    expect(r.seen_count).toBe(1);
    expect(r.interval).toBe(1);
    expect(r.ease).toBeCloseTo(2.6, 5);
  });

  it("sets next_review_at interval days into the future", () => {
    const r = calculateNextReview({ seen_count: 2 }, true); // interval 7
    const delta = new Date(r.next_review_at).getTime() - new Date(r.last_seen_at).getTime();
    expect(Math.round(delta / 864e5)).toBe(7);
  });
});

describe("deriveQuality (SM-2 timing)", () => {
  it("wrong answer -> 1, wrong with show-answer (time 0) -> 0", () => {
    expect(deriveQuality(false, 12, 20)).toBe(1);
    expect(deriveQuality(false, 0, 20)).toBe(0);
  });

  it("defaults to 4 when timing is unavailable", () => {
    expect(deriveQuality(true, 0, 20)).toBe(4);
    expect(deriveQuality(true, 10, 0)).toBe(4);
  });

  it("fast correct (<60% median) -> 5", () => {
    expect(deriveQuality(true, 10, 20)).toBe(5);
  });

  it("normal correct (60-140% median) -> 4", () => {
    expect(deriveQuality(true, 20, 20)).toBe(4);
  });

  it("slow correct (>140% median) -> 3", () => {
    expect(deriveQuality(true, 30, 20)).toBe(3);
  });
});

describe("calculateNextReviewSM2", () => {
  it("first correct review -> interval 1 day", () => {
    const r = calculateNextReviewSM2(null, 4);
    expect(r.interval).toBe(1);
    expect(r.review_count).toBe(1);
  });

  it("second correct review -> 3 days", () => {
    const r = calculateNextReviewSM2({ review_count: 1, interval: 1, ease: 2.5 }, 4);
    expect(r.interval).toBe(3);
  });

  it("third+ review multiplies the previous interval by ease and rounds", () => {
    const r = calculateNextReviewSM2({ review_count: 2, interval: 3, ease: 2.5 }, 5);
    // round(3 * ease'), ease' grows slightly at q=5
    expect(r.interval).toBeGreaterThanOrEqual(7);
  });

  it("a failing quality (<3) resets the interval to 0", () => {
    const r = calculateNextReviewSM2({ review_count: 5, interval: 30, ease: 2.5 }, 1);
    expect(r.interval).toBe(0);
    expect(r.correct).toBe(false);
  });

  it("ease stays within [1.3, 2.8]", () => {
    const lowered = calculateNextReviewSM2({ ease: 1.3, review_count: 0 }, 0);
    expect(lowered.ease).toBeGreaterThanOrEqual(1.3);
    const raised = calculateNextReviewSM2({ ease: 2.8, review_count: 2, interval: 10 }, 5);
    expect(raised.ease).toBeLessThanOrEqual(2.8);
  });

  it("quality >= 3 is treated as correct", () => {
    expect(calculateNextReviewSM2(null, 3).correct).toBe(true);
    expect(calculateNextReviewSM2(null, 2).correct).toBe(false);
  });
});
