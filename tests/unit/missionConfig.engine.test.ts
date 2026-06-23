import { describe, it, expect } from "vitest";
import { deriveEngineMission, ENGINE_SUBJECTS } from "../../src/config/missionConfig";

describe("deriveEngineMission — deterministic generator", () => {
  it("same inputs → identical mission (no randomness)", () => {
    const opts = {
      targetExam: "dgca-cpl",
      mastery: { "air-navigation": 30, meteorology: 70, "air-regulation": 88 },
      dailyGoal: 20,
    };
    expect(deriveEngineMission(opts)).toEqual(deriveEngineMission(opts));
  });

  it("picks the weakest eligible subject", () => {
    const m = deriveEngineMission({
      targetExam: "dgca-cpl",
      mastery: { "air-navigation": 80, meteorology: 25, "air-regulation": 60 },
    });
    expect(m.subjectId).toBe("meteorology");
  });

  it("ties broken by fixed track order (first wins)", () => {
    const m = deriveEngineMission({
      targetExam: "dgca-cpl",
      mastery: { "air-navigation": 0, meteorology: 0, "air-regulation": 0 },
    });
    expect(m.subjectId).toBe("air-navigation");
  });

  it("difficulty scales by mastery band (on the chosen weakest subject)", () => {
    // Force air-navigation to be the weakest by keeping the others high.
    const band = (an: number) =>
      deriveEngineMission({
        targetExam: "dgca-cpl",
        mastery: { "air-navigation": an, meteorology: 99, "air-regulation": 99 },
      }).difficulty;
    expect(band(10)).toBe("standard");
    expect(band(50)).toBe("complex");
    expect(band(70)).toBe("mixed");
    expect(band(90)).toBe("extreme");
  });

  it("only generates subjects that have a question bank", () => {
    const m = deriveEngineMission({ targetExam: "type-a320", mastery: {} });
    expect(ENGINE_SUBJECTS[m.subjectId]).toBeDefined();
    expect(m.questionCount).toBeLessThanOrEqual(ENGINE_SUBJECTS[m.subjectId].questionCount);
    expect(m.route).toBe("quiz"); // always launchable into real questions
  });

  it("unknown / FAA track falls back to DGCA subjects", () => {
    const m = deriveEngineMission({ targetExam: "faa-private", mastery: {} });
    expect(["air-navigation", "meteorology", "air-regulation"]).toContain(m.subjectId);
  });
});
