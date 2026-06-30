import { describe, it, expect } from "vitest";
import { resolveTab, PROFILE_TABS } from "../../src/views/profile/profileTabs";

describe("resolveTab", () => {
  it("defaults to overview when no param", () => {
    expect(resolveTab(null)).toBe("overview");
    expect(resolveTab(undefined)).toBe("overview");
    expect(resolveTab("")).toBe("overview");
  });

  it("returns the tab for every valid key", () => {
    for (const t of PROFILE_TABS) {
      expect(resolveTab(t.key)).toBe(t.key);
    }
  });

  it("falls back to overview for unknown params", () => {
    expect(resolveTab("nope")).toBe("overview");
    expect(resolveTab("ENROLLMENT")).toBe("overview"); // case-sensitive
  });

  it("exposes the six workspace tabs in order", () => {
    expect(PROFILE_TABS.map((t) => t.key)).toEqual([
      "overview", "enrollment", "referral", "preferences", "membership", "account",
    ]);
  });
});
