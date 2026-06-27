import { describe, it, expect } from "vitest";
import {
  resolveContentId,
  normalizeTargetExam,
  familyOf,
  aircraftOf,
  resolveLearningScope,
} from "../../src/lib/contentRegistry";
import { getPrimaryTrackFamily } from "../../src/data/trainingPaths";

describe("resolveContentId — canonical id resolution", () => {
  it("passes through canonical tokens", () => {
    expect(resolveContentId("dgca-cpl")).toBe("dgca-cpl");
    expect(resolveContentId("type-a320")).toBe("type-a320");
  });

  it("normalizes human LABELS to tokens (the historic bug)", () => {
    expect(resolveContentId("DGCA CPL")).toBe("dgca-cpl");
    expect(resolveContentId("DGCA ATPL")).toBe("dgca-atpl");
    expect(resolveContentId("dgca cpl")).toBe("dgca-cpl");
  });

  it("resolves bare aircraft + manufacturer forms to type ratings", () => {
    expect(resolveContentId("A320")).toBe("type-a320");
    expect(resolveContentId("a320")).toBe("type-a320");
    expect(resolveContentId("Boeing 737")).toBe("type-b737");
    expect(resolveContentId("b737max")).toBe("type-b737");
    expect(resolveContentId("ATR 72")).toBe("type-atr72");
  });

  it("returns null for unknown / legacy junk", () => {
    expect(resolveContentId("General Study")).toBeNull();
    expect(resolveContentId("")).toBeNull();
    expect(resolveContentId(null)).toBeNull();
    expect(resolveContentId(undefined)).toBeNull();
  });

  it("normalizeTargetExam is the same resolver", () => {
    expect(normalizeTargetExam("DGCA CPL")).toBe(resolveContentId("DGCA CPL"));
  });
});

describe("familyOf", () => {
  it("maps canonical ids and labels to families", () => {
    expect(familyOf("dgca-cpl")).toBe("dgca");
    expect(familyOf("DGCA CPL")).toBe("dgca");
    expect(familyOf("type-a320")).toBe("type_rating");
    expect(familyOf("A320")).toBe("type_rating");
    expect(familyOf("faa-ppl")).toBe("faa");
    expect(familyOf("easa-atpl")).toBe("easa");
    expect(familyOf("airline-recruitment")).toBe("airline");
    expect(familyOf("nope")).toBeNull();
  });
});

describe("getPrimaryTrackFamily — REGRESSION: label vs token bug", () => {
  it("the signup-default LABEL now resolves (was null before)", () => {
    // Before Phase 1 the default 'DGCA CPL' label failed startsWith('dgca-').
    expect(getPrimaryTrackFamily("DGCA CPL")).toBe("dgca");
  });

  it("still resolves tokens identically", () => {
    expect(getPrimaryTrackFamily("dgca-cpl")).toBe("dgca");
    expect(getPrimaryTrackFamily("type-a320")).toBe("type_rating");
    expect(getPrimaryTrackFamily("faa-ppl")).toBe("faa");
    expect(getPrimaryTrackFamily("easa-atpl")).toBe("easa");
  });

  it("preserves contract: airline recruitment is NOT a target_exam family", () => {
    // recruitment rides on careerObjective; target_exam family stays null.
    expect(getPrimaryTrackFamily("airline-recruitment")).toBeNull();
  });

  it("returns null for empty/unknown", () => {
    expect(getPrimaryTrackFamily(null)).toBeNull();
    expect(getPrimaryTrackFamily("General Study")).toBeNull();
  });
});

describe("aircraftOf", () => {
  it("maps type ratings to canonical aircraft", () => {
    expect(aircraftOf("type-a320")).toBe("a320");
    expect(aircraftOf("type-b737")).toBe("b737ng");
    expect(aircraftOf("A330")).toBe("a330");
  });
  it("is null for non-type tracks", () => {
    expect(aircraftOf("dgca-cpl")).toBeNull();
    expect(aircraftOf(null)).toBeNull();
  });
});

describe("resolveLearningScope", () => {
  it("resolves a DGCA CPL label into a full scope", () => {
    const scope = resolveLearningScope({ targetExam: "DGCA CPL" });
    expect(scope.certificationId).toBe("dgca-cpl");
    expect(scope.family).toBe("dgca");
    expect(scope.programId).toBe("dgca");
    expect(scope.aircraftId).toBeNull();
    expect(scope.subjectScope).toContain("dgca-air-navigation");
  });

  it("resolves a type rating with aircraft", () => {
    const scope = resolveLearningScope({ targetExam: "A320" });
    expect(scope.certificationId).toBe("type-a320");
    expect(scope.family).toBe("type_rating");
    expect(scope.programId).toBe("type-rating");
    expect(scope.aircraftId).toBe("a320");
  });

  it("layers a career objective independently of the track", () => {
    const scope = resolveLearningScope({
      targetExam: "dgca-cpl",
      careerObjective: "airline-recruitment",
    });
    expect(scope.certificationId).toBe("dgca-cpl");
    expect(scope.careerObjectiveId).toBe("airline-recruitment");
  });

  it("degrades gracefully on unknown input", () => {
    const scope = resolveLearningScope({ targetExam: "General Study" });
    expect(scope.certificationId).toBeNull();
    expect(scope.family).toBeNull();
    expect(scope.subjectScope).toEqual([]);
  });
});
