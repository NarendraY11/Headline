import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getUserPlanState } from "@/src/lib/subscription";

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

describe("getUserPlanState", () => {
  it("returns 'none' for a null user", () => {
    expect(getUserPlanState(null)).toEqual({ state: "none", daysLeft: 0 });
  });

  it("lifetime is always active", () => {
    expect(getUserPlanState({ plan: "lifetime" })).toEqual({ state: "active", daysLeft: 0 });
  });

  it("active trial reports remaining days (ceil)", () => {
    const r = getUserPlanState({ plan: "trial", trialEndsAt: future(2.2) });
    expect(r.state).toBe("trial");
    expect(r.daysLeft).toBe(3);
  });

  it("trial falls back to plan_expires_at when trialEndsAt is absent", () => {
    const r = getUserPlanState({ plan: "trial", plan_expires_at: future(1) } as any);
    expect(r.state).toBe("trial");
    expect(r.daysLeft).toBe(1);
  });

  it("expired trial reports 'expired'", () => {
    expect(getUserPlanState({ plan: "trial", trialEndsAt: past(1) })).toEqual({
      state: "expired",
      daysLeft: 0,
    });
  });

  it("trial with no end date is expired", () => {
    expect(getUserPlanState({ plan: "trial" })).toEqual({ state: "expired", daysLeft: 0 });
  });

  it("pro with no expiry is active (lifetime-style)", () => {
    expect(getUserPlanState({ plan: "pro" })).toEqual({ state: "active", daysLeft: 0 });
  });

  it("pro with future expiry is active with days left", () => {
    const r = getUserPlanState({ plan: "pro", planExpiresAt: future(10) } as any);
    expect(r.state).toBe("active");
    expect(r.daysLeft).toBe(10);
  });

  it("pro past expiry is expired", () => {
    expect(getUserPlanState({ plan: "pro", planExpiresAt: past(1) } as any)).toEqual({
      state: "expired",
      daysLeft: 0,
    });
  });

  it("honours planStatus==='expired' for non plan-typed users", () => {
    expect(getUserPlanState({ planStatus: "expired" } as any)).toEqual({
      state: "expired",
      daysLeft: 0,
    });
  });

  it("falls through to 'none' for a free/unknown user", () => {
    expect(getUserPlanState({ plan: "free" } as any)).toEqual({ state: "none", daysLeft: 0 });
    expect(getUserPlanState({})).toEqual({ state: "none", daysLeft: 0 });
  });
});
