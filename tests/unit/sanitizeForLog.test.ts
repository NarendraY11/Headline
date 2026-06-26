import { describe, it, expect } from "vitest";
import { sanitizeForLog } from "../../api/_lib/utils";

describe("sanitizeForLog", () => {
  it("strips CR/LF/TAB so log lines can't be forged", () => {
    expect(sanitizeForLog("admin\n[abuse] forged=true")).toBe("admin [abuse] forged=true");
    expect(sanitizeForLog("a\r\nb\tc")).toBe("a  b c");
  });

  it("truncates to the max length", () => {
    expect(sanitizeForLog("x".repeat(500)).length).toBe(200);
    expect(sanitizeForLog("xyz", 2)).toBe("xy");
  });

  it("coerces non-strings without throwing", () => {
    expect(sanitizeForLog(42)).toBe("42");
    expect(sanitizeForLog(undefined)).toBe("undefined");
    expect(sanitizeForLog(null)).toBe("null");
  });

  it("leaves a percent sign inert (passed as data, not a format directive)", () => {
    expect(sanitizeForLog("%s%d")).toBe("%s%d");
  });
});
