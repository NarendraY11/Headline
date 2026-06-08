import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, checkFormRateLimit, getClientIdentity, getAuthenticatedUser, isFeatureEnabled, screenSubmission } from "./_lib/utils.js";
import { logSecurityEvent, type Severity } from "./_lib/securityLog.js";
import { validateStudyPlan, expandPlanToMissions } from "./_lib/studyPlan.js";

// Consolidated "system" function. Serves /api/health, /api/auth-event and
// /api/study/materialize from ONE serverless function to stay under the
// Hobby-plan 12-function cap (vercel.json rewrites those paths here with
// ?fn=...). Client URLs are unchanged. server.ts (dev) keeps its own routes.

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
  if (!(await checkFormRateLimit("auth-event", ip, 30, 60_000))) {
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

// ---- /api/study/materialize -------------------------------------------------
// Expand the caller's ACTIVE study plan into study_missions. Service-role,
// idempotent (clears future pending plan-missions, then re-inserts). Gated
// behind `aiStudyScheduler` (OFF by default) so it 403s until enabled.
async function studyMaterialize(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  if (!(await isFeatureEnabled("aiStudyScheduler"))) {
    return res.status(403).json({ error: "This feature is currently disabled." });
  }

  const screen = await screenSubmission({
    formId: "study:materialize",
    identity: user.id,
    body: req.body,
    req,
  });
  if (!screen.ok) {
    return res.status(screen.status).json({ error: screen.error });
  }

  const admin = getSupabaseAdmin();
  const { data: planRow, error: planErr } = await admin
    .from("study_plans")
    .select("id, plan")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (planErr) {
    console.error("materialize: plan lookup failed:", planErr.message);
    return res.status(500).json({ error: "Failed to load study plan." });
  }
  if (!planRow) {
    return res.status(404).json({ error: "No active study plan to materialize." });
  }

  const validation = validateStudyPlan(planRow.plan);
  if (!validation.ok) {
    return res.status(422).json({ error: `Invalid study plan: ${validation.error}` });
  }

  // "Today" computed server-side (UTC, matching project timezone) so the
  // schedule never anchors to a client clock.
  const baseDate = new Date();
  const rows = expandPlanToMissions(validation.plan, {
    planId: planRow.id,
    userId: user.id,
    baseDate,
  });

  const todayISO = baseDate.toISOString().slice(0, 10);
  const { error: delErr } = await admin
    .from("study_missions")
    .delete()
    .eq("plan_id", planRow.id)
    .eq("source", "plan")
    .eq("status", "pending")
    .gte("scheduled_date", todayISO);
  if (delErr) {
    console.error("materialize: clear-pending failed:", delErr.message);
    return res.status(500).json({ error: "Failed to refresh missions." });
  }

  if (rows.length > 0) {
    const { error: insErr } = await admin.from("study_missions").insert(rows);
    if (insErr) {
      console.error("materialize: insert failed:", insErr.message);
      return res.status(500).json({ error: "Failed to create missions." });
    }
  }

  return res.status(200).json({ success: true, planId: planRow.id, missions: rows.length });
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

  if (fn === "study-materialize") {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    return studyMaterialize(req, res);
  }

  return res.status(404).json({ error: "Not Found" });
}
