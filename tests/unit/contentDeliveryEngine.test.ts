// Phase 5 — Content Delivery Engine unit tests
//
// Run: npx vitest run src/lib/contentDeliveryEngine.test.ts
//
// Covers: resolver, carry-over, aircraft, eligibility, helpers.
// No DB, no supabase — pure function tests only.

import { describe, it, expect } from "vitest";
import {
  resolveContentScope,
  filterToScope,
  getEligibleMissionSubjects,
  getTotalExamSubjectCount,
  EMPTY_SCOPE,
} from "../../src/lib/contentDeliveryEngine";
import type { ActiveLearningContext } from "../../src/lib/learningContext";

// ── Fixtures ────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ActiveLearningContext> = {}): ActiveLearningContext {
  return {
    source: "legacy",
    enrollmentId: null,
    programId: null,
    certificationId: null,
    aircraftId: null,
    family: null,
    careerObjectiveId: null,
    subjectScope: [],
    ...overrides,
  };
}

// ── resolveContentScope ──────────────────────────────────────────────

describe("resolveContentScope", () => {
  it("returns EMPTY_SCOPE shape for unknown context", () => {
    const scope = resolveContentScope(makeCtx());
    expect(scope.hasContent).toBe(false);
    expect(scope.subjects).toHaveLength(0);
    expect(scope.eligibleSubjectIds.size).toBe(0);
  });

  it("DGCA PPL — 3 subjects", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-ppl", family: "dgca" })
    );
    expect(scope.hasContent).toBe(true);
    expect(scope.subjects).toHaveLength(3);
    expect(scope.eligibleSubjectIds.has("air-navigation")).toBe(true);
    expect(scope.eligibleSubjectIds.has("meteorology")).toBe(true);
    expect(scope.eligibleSubjectIds.has("air-regulation")).toBe(true);
  });

  it("DGCA CPL — 6 subjects (PPL + 3 new)", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    expect(scope.subjects.length).toBe(6);
    // PPL subjects are present
    expect(scope.eligibleSubjectIds.has("air-navigation")).toBe(true);
    // CPL-only subjects are present
    expect(scope.eligibleSubjectIds.has("dgca-tech-general")).toBe(true);
    expect(scope.eligibleSubjectIds.has("dgca-tech-specific")).toBe(true);
    expect(scope.eligibleSubjectIds.has("dgca-rtr")).toBe(true);
  });

  it("DGCA ATPL — superset of CPL (10 subjects)", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-atpl", family: "dgca" })
    );
    expect(scope.subjects.length).toBe(10);
    expect(scope.eligibleSubjectIds.has("air-navigation")).toBe(true);
    expect(scope.eligibleSubjectIds.has("dgca-tech-general")).toBe(true);
    expect(scope.eligibleSubjectIds.has("dgca-aircraft-performance")).toBe(true);
    expect(scope.eligibleSubjectIds.has("dgca-human-performance")).toBe(true);
  });

  it("ATPL includes all CPL subjects (carry-over)", () => {
    const cpl = resolveContentScope(makeCtx({ certificationId: "dgca-cpl", family: "dgca" }));
    const atpl = resolveContentScope(makeCtx({ certificationId: "dgca-atpl", family: "dgca" }));
    for (const s of cpl.subjects) {
      expect(atpl.eligibleSubjectIds.has(s.id), `ATPL missing CPL subject: ${s.id}`).toBe(true);
    }
  });

  it("DGCA RTR — single RTR subject", () => {
    const scope = resolveContentScope(makeCtx({ certificationId: "dgca-rtr", family: "dgca" }));
    expect(scope.subjects).toHaveLength(1);
    expect(scope.eligibleSubjectIds.has("dgca-rtr")).toBe(true);
  });

  it("Type rating (A320) — aircraft subjects", () => {
    const scope = resolveContentScope(
      makeCtx({
        certificationId: "type-a320",
        aircraftId: "a320",
        family: "type_rating",
      })
    );
    expect(scope.hasContent).toBe(true);
    expect(scope.eligibleSubjectIds.has("a320-systems")).toBe(true);
    expect(scope.eligibleSubjectIds.has("a320-hydraulics")).toBe(true);
  });

  it("Type rating (B737) — b737ng aircraft subjects", () => {
    const scope = resolveContentScope(
      makeCtx({
        certificationId: "type-b737",
        aircraftId: "b737ng",
        family: "type_rating",
      })
    );
    expect(scope.eligibleSubjectIds.has("b737-systems")).toBe(true);
    expect(scope.eligibleSubjectIds.has("b737-hydraulics")).toBe(true);
    // Should NOT include A320 subjects
    expect(scope.eligibleSubjectIds.has("a320-systems")).toBe(false);
  });

  it("EASA ATPL — 13 subjects", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "easa-atpl", family: "easa" })
    );
    expect(scope.subjects.length).toBe(13);
    expect(scope.eligibleSubjectIds.has("principles-of-flight")).toBe(true);
    expect(scope.eligibleSubjectIds.has("easa-air-law")).toBe(true);
  });

  it("Airline recruitment — 3 recruitment subjects", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "airline-recruitment", family: "airline" })
    );
    expect(scope.eligibleSubjectIds.has("recruitment-aptitude")).toBe(true);
    expect(scope.eligibleSubjectIds.has("recruitment-technical")).toBe(true);
    expect(scope.eligibleSubjectIds.has("recruitment-hr")).toBe(true);
  });

  it("modules populated for subjects with known static modules", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    expect(scope.modules.length).toBeGreaterThan(0);
    expect(scope.eligibleModuleIds.has("nav-gen")).toBe(true);
    expect(scope.eligibleModuleIds.has("met-1")).toBe(true);
  });

  it("no modules for subjects with no static modules", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "airline-recruitment", family: "airline" })
    );
    // Recruitment subjects have no static modules defined
    expect(scope.modules).toHaveLength(0);
  });
});

// ── Carry-over source tagging ────────────────────────────────────────

describe("carry-over source tagging", () => {
  it("PPL subjects in CPL scope are tagged 'carryover'", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    const nav = scope.subjects.find((s) => s.id === "air-navigation");
    expect(nav?.source).toBe("carryover");
  });

  it("CPL-only subjects in CPL scope are tagged 'primary'", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    const tech = scope.subjects.find((s) => s.id === "dgca-tech-general");
    expect(tech?.source).toBe("primary");
  });

  it("aircraft subjects in type-rating scope are tagged 'aircraft'", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "type-a320", aircraftId: "a320", family: "type_rating" })
    );
    const sys = scope.subjects.find((s) => s.id === "a320-systems");
    expect(sys?.source).toBe("aircraft");
  });
});

// ── filterToScope ────────────────────────────────────────────────────

describe("filterToScope", () => {
  it("filters items to eligible subject ids", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-ppl", family: "dgca" })
    );
    const items = [
      { id: "air-navigation", title: "Nav" },
      { id: "a320-systems", title: "A320" },
      { id: "meteorology", title: "Met" },
    ];
    const filtered = filterToScope(items, scope);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((i) => i.id)).toContain("air-navigation");
    expect(filtered.map((i) => i.id)).toContain("meteorology");
  });

  it("returns all items when scope has no content", () => {
    const items = [{ id: "air-navigation" }, { id: "a320-systems" }];
    const filtered = filterToScope(items, EMPTY_SCOPE);
    expect(filtered).toHaveLength(2);
  });
});

// ── getEligibleMissionSubjects ───────────────────────────────────────

describe("getEligibleMissionSubjects", () => {
  it("returns subjects that have a question bank", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    const available = new Set(["air-navigation", "meteorology", "air-regulation"]);
    const eligible = getEligibleMissionSubjects(scope, available);
    expect(eligible.length).toBe(3);
    expect(eligible.every((s) => available.has(s.id))).toBe(true);
  });

  it("excludes coming-soon subjects with no bank", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    // Only air-navigation has a bank
    const available = new Set(["air-navigation"]);
    const eligible = getEligibleMissionSubjects(scope, available);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].id).toBe("air-navigation");
  });

  it("returns empty when no subjects in scope have a bank", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "airline-recruitment", family: "airline" })
    );
    const available = new Set(["air-navigation"]);
    const eligible = getEligibleMissionSubjects(scope, available);
    expect(eligible).toHaveLength(0);
  });

  it("results are sorted by priority", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-cpl", family: "dgca" })
    );
    const available = new Set(["air-navigation", "meteorology", "air-regulation"]);
    const eligible = getEligibleMissionSubjects(scope, available);
    for (let i = 1; i < eligible.length; i++) {
      expect(eligible[i].priority).toBeGreaterThanOrEqual(eligible[i - 1].priority);
    }
  });
});

// ── getTotalExamSubjectCount ─────────────────────────────────────────

describe("getTotalExamSubjectCount", () => {
  it("counts only primary (non-carryover) subjects for ATPL", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-atpl", family: "dgca" })
    );
    const count = getTotalExamSubjectCount(scope);
    // ATPL-only subjects (not carryover from CPL/PPL)
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(scope.subjects.length);
  });

  it("counts all subjects for PPL (none are carryover)", () => {
    const scope = resolveContentScope(
      makeCtx({ certificationId: "dgca-ppl", family: "dgca" })
    );
    const count = getTotalExamSubjectCount(scope);
    expect(count).toBe(scope.subjects.length);
  });

  it("returns 0 for empty scope", () => {
    expect(getTotalExamSubjectCount(EMPTY_SCOPE)).toBe(0);
  });
});

// ── Backward compatibility — all existing trackFamily paths still work ──

describe("backward compatibility", () => {
  const legacyCases: Array<{ cert: string; family: string; expectSubjects: string[] }> = [
    { cert: "dgca-cpl", family: "dgca", expectSubjects: ["air-navigation", "meteorology"] },
    { cert: "faa-cpl",  family: "faa",  expectSubjects: ["air-navigation", "meteorology"] },
    { cert: "easa-atpl", family: "easa", expectSubjects: ["principles-of-flight"] },
    { cert: "type-a320", family: "type_rating", expectSubjects: ["a320-systems"] },
    { cert: "airline-recruitment", family: "airline", expectSubjects: ["recruitment-aptitude"] },
  ];

  for (const tc of legacyCases) {
    it(`${tc.cert} resolves expected subjects`, () => {
      const scope = resolveContentScope(
        makeCtx({ certificationId: tc.cert as any, family: tc.family as any,
          aircraftId: tc.cert === "type-a320" ? "a320" : null })
      );
      for (const id of tc.expectSubjects) {
        expect(scope.eligibleSubjectIds.has(id)).toBe(true);
      }
    });
  }
});
