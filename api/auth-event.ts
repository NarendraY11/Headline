import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkFormRateLimit, getClientIdentity } from "./_lib/utils";
import { logSecurityEvent, type Severity } from "./_lib/securityLog";

// Public breadcrumb endpoint for client-side auth attempts. Supabase GoTrue
// runs auth in the browser, so the server never sees login attempts directly;
// the client reports them here and the SERVER stamps IP / user-agent / time.
//
// This is intentionally unauthenticated (a failed login has no session). It is
// a detection aid, not an authorization control — a spoofed event can only
// create alert noise, never grant access. Per-IP rate limiting caps log flood.
//
// The login feeds the suspicious-activity sweep (failed-login bursts, password
// reset floods, new-IP-for-user). Passwords are NEVER sent here — only the
// email (account identifier) and the outcome.

const ALLOWED: Record<string, Severity> = {
  login_success: "info",
  login_failed: "warn",
  signup: "info",
  password_reset_requested: "info",
  logout: "info",
};

const EMAIL_RE = /^[^\s@]{1,200}@[^\s@]{1,200}\.[^\s@]{1,20}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ip = getClientIdentity(req);
  // 30 events/min/IP is generous for a human but throttles a flooder.
  if (!checkFormRateLimit("auth-event", ip, 30, 60_000)) {
    return res.status(204).end(); // silently drop; never reveal throttling here
  }

  const type = typeof req.body?.type === "string" ? req.body.type : "";
  const severity = ALLOWED[type];
  if (!severity) {
    return res.status(204).end(); // ignore unknown types; this is best-effort
  }

  const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const email = EMAIL_RE.test(rawEmail) ? rawEmail : null;

  await logSecurityEvent({
    req,
    eventType: `auth.${type}`,
    severity,
    actorEmail: email,
    metadata: { provider: typeof req.body?.provider === "string" ? req.body.provider.slice(0, 30) : "password" },
  });

  return res.status(204).end();
}
