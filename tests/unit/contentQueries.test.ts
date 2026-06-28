// Phase 6 — Content Queries unit tests
//
// Tests the scope-aware resolver layer in src/lib/contentQueries.ts.
// All functions are pure (sync helpers) or wrap fetch functions we mock.
// No DB, no Supabase.

import { describe, it, expect } from "vitest";
import {
  getEligibleSubjects,
  getEligibleModules,
  getEligibleExams,
  intersectWithScope,
} from "../../src/lib/contentQueries";
import type { ContentScope } from "../../src/lib/contentDeliveryEngine";
import { EMPTY_SCOPE } from "../../src/lib/contentDeliveryEngine";
import type { SubjectItem } from "../../src/data/topics";

// ── Fixtures ────────────────────────────────────────────────────────

function makeScope(subjectIds: string[], moduleIds: string[] = []): ContentScope {
  return {
    ...EMPTY_SCOPE,
    subjects: subjectIds.map((id, i) => ({
      id,
      label: id,
      source: "primary" as const,
      priority: i + 1,
      certificationId: "dgca-cpl",
    })),
    modules: moduleIds.map((id) => ({
      id,
      label: id,
      subjectId: subjectIds[0] ?? "",
      priority: 1,
    })),
    eligibleSubjectIds: new Set(subjectIds),
    eligibleModuleIds: new Set(moduleIds),
    hasContent: subjectIds.length > 0,
    certificationId: "dgca-cpl",
    family: "dgca",
    aircraftId: null,
    programId: null,
    careerObjectiveId: null,
    source: "enrollment",
  };
}

function makeSubject(id: string): SubjectItem {
  return {
    id,
    num: "01",
    title: id,
    questionCount: 10,
    mastery: 0,
    hue: "navy",
    blurb: "",
    status: "active",
    tags: [],
    subTopics: [],
  } as unknown as SubjectItem;
}

// ── getEligibleSubjects ──────────────────────────────────────────────

describe("getEligibleSubjects", () => {
  const subjects = [
    makeSubject("air-navigation"),
    makeSubject("meteorology"),
    makeSubject("air-regulation"),
    makeSubject("a320-systems"),
  ];

  it("returns all subjects when scope is empty", () => {
    expect(getEligibleSubjects(EMPTY_SCOPE, subjects)).toEqual(subjects);
  });

  it("filters to scope's eligible subject ids", () => {
    const scope = makeScope(["air-navigation", "meteorology"]);
    const result = getEligibleSubjects(scope, subjects);
    expect(result.map((s) => s.id)).toEqual(["air-navigation", "meteorology"]);
  });

  it("returns empty array when no subjects match scope", () => {
    const scope = makeScope(["unknown-subject"]);
    expect(getEligibleSubjects(scope, subjects)).toHaveLength(0);
  });

  it("returns all when scope has hasContent=false even with non-empty eligibleSubjectIds", () => {
    // Defensive: EMPTY_SCOPE has hasContent=false, should always return all
    expect(getEligibleSubjects(EMPTY_SCOPE, subjects)).toHaveLength(4);
  });
});

// ── getEligibleModules ───────────────────────────────────────────────

describe("getEligibleModules", () => {
  const modules = [
    { id: "nav-gen" },
    { id: "nav-rad" },
    { id: "met-1" },
  ];

  it("returns all modules when scope is empty", () => {
    expect(getEligibleModules(EMPTY_SCOPE, modules)).toEqual(modules);
  });

  it("filters modules to eligibleModuleIds", () => {
    const scope = makeScope(["air-navigation"], ["nav-gen", "nav-rad"]);
    expect(getEligibleModules(scope, modules).map((m) => m.id)).toEqual(["nav-gen", "nav-rad"]);
  });

  it("returns empty when no modules match", () => {
    const scope = makeScope(["air-navigation"], ["nonexistent"]);
    expect(getEligibleModules(scope, modules)).toHaveLength(0);
  });
});

// ── getEligibleExams ─────────────────────────────────────────────────

describe("getEligibleExams", () => {
  const exams = [
    { id: "dgca-cpl-mock",    subject_ids: ["air-navigation", "meteorology", "air-regulation"] },
    { id: "a320-mock",        subject_ids: ["a320-systems"] },
    { id: "airline-recruit",  subject_ids: ["recruitment-aptitude"] },
  ];

  it("returns all exams when scope is empty", () => {
    expect(getEligibleExams(EMPTY_SCOPE, exams)).toHaveLength(3);
  });

  it("returns only exams with at least one subject in scope", () => {
    const scope = makeScope(["air-navigation", "meteorology"]);
    const result = getEligibleExams(scope, exams);
    expect(result.map((e) => e.id)).toEqual(["dgca-cpl-mock"]);
  });

  it("handles exam with undefined subject_ids gracefully", () => {
    const withUndefined = [{ id: "no-subjects" }] as any[];
    const scope = makeScope(["air-navigation"]);
    expect(getEligibleExams(scope, withUndefined)).toHaveLength(0);
  });

  it("shows aircraft exam for type-rating scope", () => {
    const scope = makeScope(["a320-systems"]);
    const result = getEligibleExams(scope, exams);
    expect(result.map((e) => e.id)).toEqual(["a320-mock"]);
  });
});

// ── intersectWithScope ───────────────────────────────────────────────

describe("intersectWithScope", () => {
  it("returns full list when scope is empty", () => {
    const ids = ["air-navigation", "meteorology"];
    expect(intersectWithScope(EMPTY_SCOPE, ids)).toEqual(ids);
  });

  it("returns only IDs in scope", () => {
    const scope = makeScope(["air-navigation"]);
    expect(intersectWithScope(scope, ["air-navigation", "meteorology"])).toEqual(["air-navigation"]);
  });

  it("returns empty array when nothing intersects", () => {
    const scope = makeScope(["a320-systems"]);
    expect(intersectWithScope(scope, ["air-navigation", "meteorology"])).toHaveLength(0);
  });

  it("handles empty input array", () => {
    const scope = makeScope(["air-navigation"]);
    expect(intersectWithScope(scope, [])).toEqual([]);
  });
});

// ── Backward compatibility — EMPTY_SCOPE fallthrough ────────────────

describe("fallthrough on EMPTY_SCOPE", () => {
  it("all sync helpers return full data on EMPTY_SCOPE", () => {
    const subjects = [makeSubject("air-navigation"), makeSubject("meteorology")];
    const modules = [{ id: "nav-gen" }, { id: "met-1" }];
    const exams = [{ id: "dgca", subject_ids: ["air-navigation"] }];

    expect(getEligibleSubjects(EMPTY_SCOPE, subjects)).toHaveLength(2);
    expect(getEligibleModules(EMPTY_SCOPE, modules)).toHaveLength(2);
    expect(getEligibleExams(EMPTY_SCOPE, exams)).toHaveLength(1);
    expect(intersectWithScope(EMPTY_SCOPE, ["a", "b"])).toEqual(["a", "b"]);
  });
});
