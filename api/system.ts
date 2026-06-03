import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, checkFormRateLimit, getClientIdentity } from "./_lib/utils";
import { logSecurityEvent, type Severity } from "./_lib/securityLog";

// Consolidated public "system" function. Serves /api/health and /api/auth-event
// from ONE serverless function to stay under the Hobby-plan 12-function cap
// (vercel.json rewrites both public paths here with ?fn=...). Client URLs are
// unchanged. server.ts (dev) keeps its own routes for these paths.

// ---- /api/health -----------------------------------------------------------
async function health(_req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();
  let db = false;
  try {
    const { error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("id", { head: true, count: "estimated" })
      .limit(1);
    db = !error;
  } catch {
    db = false;
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(db ? 200 : 503).json({
    status: db ? "ok" : "degraded",
    db,
    dbLatencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}

// ---- /api/auth-event --------------------------------------------------------
const AUTH_EVENTS: Record<string, Severity> = {
  login_success: "info",
  login_failed: "warn",
  signup: "info",
  password_reset_requested: "info",
  logout: "info",
};
const EMAIL_RE = /^[^\s@]{1,200}@[^\s@]{1,200}\.[^\s@]{1,20}$/;

async function authEvent(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIdentity(req);
  if (!checkFormRateLimit("auth-event", ip, 30, 60_000)) {
    return res.status(204).end();
  }
  const type = typeof req.body?.type === "string" ? req.body.type : "";
  const severity = AUTH_EVENTS[type];
  if (!severity) return res.status(204).end();

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fnParam = req.query.fn;
  const fn = Array.isArray(fnParam) ? fnParam[0] : fnParam;

  if (fn === "health") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    return health(req, res);
  }

  if (fn === "auth-event") {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    return authEvent(req, res);
  }

  return res.status(404).json({ error: "Not Found" });
}
