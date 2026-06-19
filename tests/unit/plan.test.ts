import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isPaidActive, daysLeft, planLabel, TRIAL_DAYS } from "@/src/lib/plan";

// Access control + billing labels. Time-dependent, so the clock is pinned to a
// fixed "now" and expiries are expressed relative to it.
const NOW = new Date("2026-06-19T12:00:00.000Z");
const future = (days: number) => new Date(NOW.getTime() + days * 864e5).toISOString();
const past = (days: number) => new Date(NOW.getTime() - days * 864e5).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("isPaidActive", () => {
  it("returns false for null/undefined user", () => {
    expect(isPaidActive(null)).toBe(false);
    expect(isPaidActive(undefined)).toBe(false);
  });

  it("treats lifetime as always active", () => {
    expect(isPaidActive({ plan: "lifetime" })).toBe(true);
    // lifetime ignores any expiry that may be present
    expect(isPaidActive({ plan: "lifetime", planExpiresAt: past(100) })).toBe(true);
  });

  it("pro with no expiry is active (lifetime-style grants/legacy)", () => {
    expect(isPaidActive({ plan: "pro" })).toBe(true);
    expect(isPaidActive({ plan: "pro", planExpiresAt: null })).toBe(true);
  });

  it("pro with future expiry is active, past expiry is not", () => {
    expect(isPaidActive({ plan: "pro", planExpiresAt: future(1) })).toBe(true);
    expect(isPaidActive({ plan: "pro", planExpiresAt: past(1) })).toBe(false);
  });

  it("reads the snake_case plan_expires_at fallback", () => {
    expect(isPaidActive({ plan: "pro", plan_expires_at: future(5) })).toBe(true);
    expect(isPaidActive({ plan: "pro", plan_expires_at: past(5) })).toBe(false);
  });

  it("trial requires a future expiry — no expiry means NOT active", () => {
    expect(isPaidActive({ plan: "trial" })).toBe(false);
    expect(isPaidActive({ plan: "trial", planExpiresAt: future(2) })).toBe(true);
    expect(isPaidActive({ plan: "trial", planExpiresAt: past(2) })).toBe(false);
  });

  it("free / unknown plans are never paid", () => {
    expect(isPaidActive({ plan: "free" })).toBe(false);
    expect(isPaidActive({ plan: undefined })).toBe(false);
    expect(isPaidActive({ plan: "garbage" })).toBe(false);
  });

  it("treats an expiry exactly at now as expired (strictly-greater boundary)", () => {
    expect(isPaidActive({ plan: "pro", planExpiresAt: NOW.toISOString() })).toBe(false);
  });
});

describe("daysLeft", () => {
  it("returns null for null user, lifetime, and free", () => {
    expect(daysLeft(null)).toBeNull();
    expect(daysLeft({ plan: "lifetime" })).toBeNull();
    expect(daysLeft({ plan: "free" })).toBeNull();
  });

  it("returns null when a pro/trial plan has no expiry", () => {
    expect(daysLeft({ plan: "pro" })).toBeNull();
    expect(daysLeft({ plan: "trial" })).toBeNull();
  });

  it("ceils partial days remaining", () => {
    // 2.5 days out -> ceil -> 3
    const expiry = new Date(NOW.getTime() + 2.5 * 864e5).toISOString();
    expect(daysLeft({ plan: "pro", planExpiresAt: expiry })).toBe(3);
  });

  it("returns 0 for an already-expired plan", () => {
    expect(daysLeft({ plan: "trial", planExpiresAt: past(3) })).toBe(0);
  });
});

describe("planLabel", () => {
  it("labels free and missing users as FREE", () => {
    expect(planLabel(null)).toBe("FREE");
    expect(planLabel({ plan: "free" })).toBe("FREE");
    expect(planLabel({})).toBe("FREE");
  });

  it("labels lifetime distinctly", () => {
    expect(planLabel({ plan: "lifetime" })).toBe("PRO · LIFETIME");
  });

  it("labels an expired pro plan as EXPIRED", () => {
    expect(planLabel({ plan: "pro", planExpiresAt: past(1) })).toBe("EXPIRED");
  });

  it("labels an active pro plan with the expiry date", () => {
    const label = planLabel({ plan: "pro", planExpiresAt: future(30) });
    expect(label.startsWith("PRO · expires ")).toBe(true);
  });

  it("labels active trial with day count and correct pluralization", () => {
    expect(planLabel({ plan: "trial", planExpiresAt: future(3) })).toBe("TRIAL · 3 days left");
    // ~0.5 day -> ceil -> 1 day (singular)
    const oneDay = new Date(NOW.getTime() + 0.5 * 864e5).toISOString();
    expect(planLabel({ plan: "trial", planExpiresAt: oneDay })).toBe("TRIAL · 1 day left");
  });

  it("labels an expired trial as TRIAL EXPIRED", () => {
    expect(planLabel({ plan: "trial", planExpiresAt: past(1) })).toBe("TRIAL EXPIRED");
  });
});

describe("constants", () => {
  it("TRIAL_DAYS is 7", () => {
    expect(TRIAL_DAYS).toBe(7);
  });
});
