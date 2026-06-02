// Password security helpers shared by signup and password-change forms.
// Policy: length matters more than arbitrary complexity (no forced symbols /
// mixed case). NIST 800-63B aligned — minimum length + breached-password check.

const MIN_LENGTH = 8;
const MAX_LENGTH = 200; // guard against absurd inputs / DoS on hashing

// (1)(3) Length floor, no complexity rules. Returns an error string or null.
export function validatePasswordStrength(pw: string): string | null {
  if (!pw || pw.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters long.`;
  }
  if (pw.length > MAX_LENGTH) {
    return `Password must not exceed ${MAX_LENGTH} characters.`;
  }
  return null;
}

// (2) Breached-password check via the HaveIBeenPwned range API (k-anonymity:
// only the first 5 chars of the SHA-1 hash leave the browser; the full
// password is never sent). Fails OPEN — if the service is unreachable we allow
// the password rather than block a legitimate signup.
export async function isPwnedPassword(pw: string): Promise<boolean> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return false;
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => line.split(":")[0].trim() === suffix);
  } catch (e) {
    // Never log the password; only the failure.
    console.warn("Breached-password check unavailable, allowing:", e);
    return false;
  }
}

// (4) Client-side attempt limiter: 5 submissions per minute per key (e.g.
// email). Best-effort only — real brute-force protection lives in Supabase
// Auth rate limits + CAPTCHA. Keyed per identity so one user can't lock others.
const attemptLog = new Map<string, number[]>();

export function tooManyPasswordAttempts(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (attemptLog.get(key) || []).filter((t) => t > cutoff);
  if (arr.length >= limit) {
    attemptLog.set(key, arr);
    return true;
  }
  arr.push(now);
  attemptLog.set(key, arr);
  return false;
}
