// UX-Nav Phase 1: lock the sidebar IA reduction so removed/renamed items can't
// silently creep back in.
import { describe, it, expect } from "vitest";
import { buildNavItems, buildBottomNavItems } from "../../src/config/navigationConfig";

const opts = {
  targetExam: "type-a320",            // type_rating family
  careerObjective: "airline-recruitment",
  enabledFlags: { mockExams: true, aiStudyScheduler: true, a320Systems: true },
  isAdmin: false,
};

describe("buildNavItems — UX-Nav Phase 1", () => {
  const labels = buildNavItems(opts).map((i) => i.label);

  it("removes items demoted out of primary nav", () => {
    expect(labels).not.toContain("Learning Context");
    expect(labels).not.toContain("A320 systems");
    expect(labels).not.toContain("Refer & earn");
  });

  it("hides Interview Prep until content is live", () => {
    expect(labels).not.toContain("Interview Prep");
  });

  it("renames Flashcards → Review and Flight Schedule → Planner", () => {
    expect(labels).toContain("Review");
    expect(labels).toContain("Planner");
    expect(labels).not.toContain("Flashcards");
    expect(labels).not.toContain("Flight Schedule");
  });

  it("keeps core destinations", () => {
    expect(labels).toContain("Today");
    expect(labels).toContain("Question bank");
    expect(labels).toContain("Progress");
    expect(labels).toContain("Profile");
  });
});

describe("buildBottomNavItems — UX-Nav Phase 1", () => {
  const items = buildBottomNavItems(opts);

  it("caps at 5 unique tabs", () => {
    expect(items.length).toBeLessThanOrEqual(5);
    expect(new Set(items.map((i) => i.to)).size).toBe(items.length);
  });

  it("does not surface hidden Interview Prep or de-navved A320", () => {
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("Interview Prep");
    expect(labels).not.toContain("A320 systems");
  });
});
