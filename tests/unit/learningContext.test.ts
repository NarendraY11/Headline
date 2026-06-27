import { describe, it, expect } from "vitest";
import {
  buildActiveLearningContext,
  pickActiveEnrollment,
  targetExamForEnrollment,
  type EnrollmentRow,
} from "../../src/lib/learningContext";

function enrollment(over: Partial<EnrollmentRow>): EnrollmentRow {
  return {
    id: "e1", user_id: "u1", program_id: "dgca", certification_id: "dgca-cpl",
    aircraft_id: null, status: "active", is_active: true, ...over,
  };
}

describe("pickActiveEnrollment", () => {
  it("returns null for empty/none-active", () => {
    expect(pickActiveEnrollment([])).toBeNull();
    expect(pickActiveEnrollment(null)).toBeNull();
    expect(pickActiveEnrollment([enrollment({ is_active: false })])).toBeNull();
  });

  it("picks the active one among many", () => {
    const a = enrollment({ id: "a", certification_id: "dgca-cpl", is_active: false });
    const b = enrollment({ id: "b", certification_id: "type-a320", is_active: true });
    expect(pickActiveEnrollment([a, b])?.id).toBe("b");
  });
});

describe("buildActiveLearningContext — single enrollment", () => {
  it("derives full context from the active enrollment", () => {
    const ctx = buildActiveLearningContext({ enrollment: enrollment({}) });
    expect(ctx.source).toBe("enrollment");
    expect(ctx.certificationId).toBe("dgca-cpl");
    expect(ctx.family).toBe("dgca");
    expect(ctx.programId).toBe("dgca");
    expect(ctx.aircraftId).toBeNull();
    expect(ctx.subjectScope).toContain("dgca-air-navigation");
    expect(ctx.enrollmentId).toBe("e1");
  });

  it("resolves aircraft for a type-rating enrollment", () => {
    const ctx = buildActiveLearningContext({
      enrollment: enrollment({ certification_id: "type-a320", program_id: "type-rating" }),
    });
    expect(ctx.family).toBe("type_rating");
    expect(ctx.aircraftId).toBe("a320");
  });
});

describe("buildActiveLearningContext — multiple + switching", () => {
  it("uses whichever enrollment is passed as active", () => {
    const list = [
      enrollment({ id: "a", certification_id: "dgca-cpl", is_active: false }),
      enrollment({ id: "b", certification_id: "type-a320", is_active: true }),
    ];
    const ctx = buildActiveLearningContext({ enrollment: pickActiveEnrollment(list)! });
    expect(ctx.certificationId).toBe("type-a320");
  });

  it("switching the active flag changes the resolved context", () => {
    const dgca = enrollment({ id: "a", certification_id: "dgca-cpl", is_active: true });
    const a320 = enrollment({ id: "b", certification_id: "type-a320", is_active: false });
    const first = buildActiveLearningContext({ enrollment: pickActiveEnrollment([dgca, a320])! });
    expect(first.certificationId).toBe("dgca-cpl");
    // flip active
    const after = buildActiveLearningContext({
      enrollment: pickActiveEnrollment([{ ...dgca, is_active: false }, { ...a320, is_active: true }])!,
    });
    expect(after.certificationId).toBe("type-a320");
  });
});

describe("buildActiveLearningContext — fallback chain", () => {
  it("uses learning profile when no enrollment", () => {
    const ctx = buildActiveLearningContext({
      profile: { preferred_certification_id: "dgca-atpl", preferred_program_id: "dgca" },
    });
    expect(ctx.source).toBe("profile");
    expect(ctx.certificationId).toBe("dgca-atpl");
    expect(ctx.subjectScope).toContain("dgca-flight-planning");
  });

  it("falls back to legacy target_exam (label form) when no enrollment/profile", () => {
    const ctx = buildActiveLearningContext({ legacy: { targetExam: "DGCA CPL" } });
    expect(ctx.source).toBe("legacy");
    expect(ctx.certificationId).toBe("dgca-cpl"); // label normalized
    expect(ctx.family).toBe("dgca");
  });

  it("returns 'none' when nothing is known", () => {
    const ctx = buildActiveLearningContext({});
    expect(ctx.source).toBe("none");
    expect(ctx.certificationId).toBeNull();
    expect(ctx.subjectScope).toEqual([]);
  });

  it("enrollment takes precedence over profile and legacy", () => {
    const ctx = buildActiveLearningContext({
      enrollment: enrollment({ certification_id: "type-a320" }),
      profile: { preferred_certification_id: "dgca-cpl" },
      legacy: { targetExam: "faa-ppl" },
    });
    expect(ctx.source).toBe("enrollment");
    expect(ctx.certificationId).toBe("type-a320");
  });
});

describe("targetExamForEnrollment — compat mirror", () => {
  it("returns the canonical cert id to sync into profiles.target_exam", () => {
    expect(targetExamForEnrollment(enrollment({ certification_id: "type-a320" }))).toBe("type-a320");
    expect(targetExamForEnrollment(null)).toBeNull();
  });
});
