import { describe, it, expect } from "vitest";
import { computeMissionStreak } from "../../src/lib/missionStreak";

const TODAY = "2026-06-24";

describe("computeMissionStreak", () => {
  it("empty → 0", () => {
    expect(computeMissionStreak([], TODAY)).toBe(0);
  });

  it("today only → 1", () => {
    expect(computeMissionStreak(["2026-06-24"], TODAY)).toBe(1);
  });

  it("3 consecutive days ending today → 3", () => {
    expect(computeMissionStreak(["2026-06-22", "2026-06-23", "2026-06-24"], TODAY)).toBe(3);
  });

  it("streak ending yesterday still counts (today not yet done)", () => {
    expect(computeMissionStreak(["2026-06-22", "2026-06-23"], TODAY)).toBe(2);
  });

  it("gap before today → 0 (stale streak)", () => {
    // last completion was 2 days ago, not today/yesterday
    expect(computeMissionStreak(["2026-06-21", "2026-06-22"], TODAY)).toBe(0);
  });

  it("stops at the first gap", () => {
    // today + yesterday present, then a gap; older days don't extend it
    expect(computeMissionStreak(["2026-06-20", "2026-06-23", "2026-06-24"], TODAY)).toBe(2);
  });

  it("duplicate dates don't inflate", () => {
    expect(computeMissionStreak(["2026-06-24", "2026-06-24", "2026-06-23"], TODAY)).toBe(2);
  });

  it("unordered input handled", () => {
    expect(computeMissionStreak(["2026-06-24", "2026-06-22", "2026-06-23"], TODAY)).toBe(3);
  });
});
