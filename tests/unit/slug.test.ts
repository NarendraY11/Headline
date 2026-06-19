import { describe, it, expect } from "vitest";
import { normalizeSlug } from "@/src/lib/slug";

describe("normalizeSlug", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeSlug(null)).toBe("");
    expect(normalizeSlug(undefined)).toBe("");
    expect(normalizeSlug("")).toBe("");
  });

  it("lowercases", () => {
    expect(normalizeSlug("AirNav")).toBe("airnav");
  });

  it("strips separators, punctuation, and whitespace", () => {
    expect(normalizeSlug("air-nav_01")).toBe("airnav01");
    expect(normalizeSlug("Air Navigation!")).toBe("airnavigation");
    expect(normalizeSlug("a/b\\c.d")).toBe("abcd");
  });

  it("matches ids differing only in casing/separators (the core use case)", () => {
    expect(normalizeSlug("DGCA-CPL")).toBe(normalizeSlug("dgca_cpl"));
    expect(normalizeSlug("A320 Type-Rating")).toBe(normalizeSlug("a320typerating"));
  });

  it("keeps alphanumerics across unicode boundaries it understands", () => {
    expect(normalizeSlug("Topic 42")).toBe("topic42");
  });
});
