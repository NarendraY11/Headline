import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validatePasswordStrength,
  tooManyPasswordAttempts,
  isPwnedPassword,
} from "@/src/lib/passwordSecurity";

describe("validatePasswordStrength", () => {
  it("rejects empty and too-short passwords", () => {
    expect(validatePasswordStrength("")).toMatch(/at least 8/);
    expect(validatePasswordStrength("short")).toMatch(/at least 8/);
    expect(validatePasswordStrength("1234567")).toMatch(/at least 8/);
  });

  it("accepts a password exactly at the 8-char floor", () => {
    expect(validatePasswordStrength("12345678")).toBeNull();
  });

  it("accepts long passphrases without complexity requirements", () => {
    expect(validatePasswordStrength("correct horse battery staple")).toBeNull();
  });

  it("rejects absurdly long inputs (DoS guard at 200)", () => {
    expect(validatePasswordStrength("a".repeat(200))).toBeNull();
    expect(validatePasswordStrength("a".repeat(201))).toMatch(/not exceed 200/);
  });
});

describe("tooManyPasswordAttempts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit then blocks the next attempt", () => {
    const key = "user-a@example.com";
    // default limit 5: first 5 allowed, 6th blocked
    for (let i = 0; i < 5; i++) {
      expect(tooManyPasswordAttempts(key)).toBe(false);
    }
    expect(tooManyPasswordAttempts(key)).toBe(true);
  });

  it("is keyed per identity — one user cannot lock another", () => {
    const a = "a@example.com";
    const b = "b@example.com";
    for (let i = 0; i < 5; i++) tooManyPasswordAttempts(a);
    expect(tooManyPasswordAttempts(a)).toBe(true);
    // b is untouched
    expect(tooManyPasswordAttempts(b)).toBe(false);
  });

  it("resets after the rolling window elapses", () => {
    const key = "windowed@example.com";
    for (let i = 0; i < 5; i++) tooManyPasswordAttempts(key);
    expect(tooManyPasswordAttempts(key)).toBe(true);
    // advance past the 60s window
    vi.advanceTimersByTime(61_000);
    expect(tooManyPasswordAttempts(key)).toBe(false);
  });

  it("respects a custom limit", () => {
    const key = "custom@example.com";
    expect(tooManyPasswordAttempts(key, 2)).toBe(false);
    expect(tooManyPasswordAttempts(key, 2)).toBe(false);
    expect(tooManyPasswordAttempts(key, 2)).toBe(true);
  });
});

describe("isPwnedPassword (fails open)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns true when the HIBP range response contains the hash suffix", async () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix 5BAA6, suffix 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    const suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => `00000000000000000000000000000000000:3\n${suffix}:99999`,
      }))
    );
    expect(await isPwnedPassword("password")).toBe(true);
  });

  it("returns false when the suffix is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => "ABCDEF0000000000000000000000000000000:1" }))
    );
    expect(await isPwnedPassword("a-very-unique-passphrase-xyz")).toBe(false);
  });

  it("fails open (returns false) on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, text: async () => "" })));
    expect(await isPwnedPassword("password")).toBe(false);
  });

  it("fails open (returns false) when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    expect(await isPwnedPassword("password")).toBe(false);
  });
});
