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
// FIX #7: derive a stable 32-bit integer from a UUID for use as a Postgres
// advisory lock key. Different users get different keys; same user always gets
// the same key. Uses djb2 hash over the first 16 hex chars of the UUID.
function advisoryLockKey(userId: string): number {
  const hex = userId.replace(/-/g, "").slice(0, 16);
  let h = 5381;
  for (let i = 0; i < hex.length; i++) {
    h = ((h << 5) + h) ^ hex.charCodeAt(i);
    h = h >>> 0; // keep as unsigned 32-bit
  }
  return h;
}

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

  // FIX #7: The delete-then-insert pattern is not atomic. Two concurrent
  // materialize calls for the same user could both execute the delete, then
  // both execute the insert, creating duplicate missions.
  //
  // Use a per-user Postgres advisory lock (pg_try_advisory_lock) so only one
  // materialize call proceeds at a time per user. pg_try_advisory_lock returns
  // false (non-blocking) if the lock is already held; we 409 the second caller.
  // The lock is session-scoped and released explicitly with pg_advisory_unlock.
  const lockKey = advisoryLockKey(user.id);
  const { data: lockData, error: lockErr } = await admin.rpc("pg_try_advisory_lock", { key: lockKey });
  if (lockErr) {
    // Advisory lock RPC unavailable — log but continue (degraded, not blocked).
    console.warn("materialize: advisory lock unavailable:", lockErr.message);
  } else if (!lockData) {
    // Another request for this user is already materializing.
    return res.status(409).json({ error: "Materialization already in progress for this user." });
  }

  try {
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
  } finally {
    // Release the advisory lock regardless of success or failure so subsequent
    // calls for this user are not permanently blocked.
    if (!lockErr && lockData) {
      // PostgrestFilterBuilder does not extend Promise — use try/catch, not .catch().
      try {
        await admin.rpc("pg_advisory_unlock", { key: lockKey });
      } catch (e: unknown) {
        console.warn("materialize: advisory unlock failed:", e);
      }
    }
  }
}

// ---- /api/system?fn=study-metrics ------------------------------------------

async function studyMetrics(req: VercelRequest, res: VercelResponse) {
  const admin = getSupabaseAdmin();
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const { data: isAdmin } = await admin.rpc("is_admin", { uid: user.id });
  if (!isAdmin) return res.status(403).json({ error: "Admin only." });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [plansResult, missionsResult] = await Promise.all([
    admin.from("study_plans").select("id, status, user_id, generated_at").limit(1000),
    admin.from("study_missions").select("id, status, source, scheduled_date, user_id").gte("scheduled_date", thirtyDaysAgo).limit(5000),
  ]);

  const plans = (plansResult.data ?? []) as { id: string; status: string; user_id: string }[];
  const missions = (missionsResult.data ?? []) as { id: string; status: string; source: string; scheduled_date: string; user_id: string }[];

  const activePlans = plans.filter((p) => p.status === "active").length;
  const usersWithPlan = new Set(plans.filter((p) => p.status === "active").map((p) => p.user_id)).size;

  const planMissions = missions.filter((m) => m.source === "plan");
  const completedMissions = planMissions.filter((m) => m.status === "completed").length;
  const totalMissions = planMissions.length;

  const recentUsers = new Set(
    planMissions.filter((m) => m.scheduled_date >= sevenDaysAgo).map((m) => m.user_id)
  );

  return res.status(200).json({
    activePlans,
    usersWithPlan,
    missionCompletionRate: totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0,
    completedMissions,
    totalMissions,
    dailyActivePlanners7d: recentUsers.size,
    asOf: now.toISOString(),
  });
}

// ── Trigger thresholds (M8D) ─────────────────────────────────────────────────
const DRIFT_THRESHOLD     = -8;
const RECOVERY_THRESHOLD  = 80;
const STALENESS_DAYS      = 21;
const CRITICAL_THRESHOLD  = 50;
const MIN_ANSWERS_FOR_NEW_CRITICAL = 5;
const AUTO_REGEN_COOLDOWN_MS  = 3 * 24 * 60 * 60 * 1000;
const MAX_AUTO_REGENS_PER_7D  = 3;

// ---- /api/system?fn=study-mastery-check ------------------------------------

async function studyMasteryCheck(req: VercelRequest, res: VercelResponse) {
  const admin = getSupabaseAdmin();
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  if (!(await isFeatureEnabled("adaptiveRegen"))) {
    return res.status(403).json({ error: "Adaptive regen not enabled." });
  }

  const { data: planRow, error: planErr } = await admin
    .from("study_plans")
    .select("id, plan, generated_at, last_regen_at, regen_count, auto_regen_enabled")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (planErr) return res.status(500).json({ error: "Failed to load plan." });
  if (!planRow) return res.status(404).json({ error: "No active study plan." });

  const { data: snapRows } = await admin
    .from("mastery_snapshots")
    .select("subject_id, mastery, baseline_mastery, answers_total, correct_7d, total_7d")
    .eq("user_id", user.id);

  const snapshots = (snapRows ?? []) as {
    subject_id: string;
    mastery: number;
    baseline_mastery: number;
    answers_total: number;
    correct_7d: number;
    total_7d: number;
  }[];

  const now = Date.now();
  const planAge = planRow.generated_at ? now - new Date(planRow.generated_at).getTime() : 0;
  const lastRegenAt = planRow.last_regen_at ? new Date(planRow.last_regen_at).getTime() : null;
  const cooldownRemaining = lastRegenAt
    ? Math.max(0, AUTO_REGEN_COOLDOWN_MS - (now - lastRegenAt))
    : 0;

  const planWeakAreaIds = new Set<string>(
    ((planRow.plan as { weakAreas?: { subjectId: string }[] })?.weakAreas ?? []).map((a) => a.subjectId)
  );

  type TriggerType = "mastery_drift" | "recovery" | "staleness" | "new_critical" | null;
  let triggerReason: TriggerType = null;

  const subjectDetails: {
    subjectId: string;
    currentMastery: number;
    baselineMastery: number;
    delta: number;
    trend: string;
    classification: string;
  }[] = [];

  for (const s of snapshots) {
    const delta = s.mastery - s.baseline_mastery;
    const recentAcc = s.total_7d >= 5 ? s.correct_7d / s.total_7d : null;

    let trend = "STABLE";
    if (delta >= 10) trend = "IMPROVING";
    else if (delta >= 3) trend = "PROGRESSING";
    else if (delta > -3) trend = "STABLE";
    else if (delta > -10) trend = "REGRESSING";
    else trend = "DECLINING";
    if (recentAcc !== null && recentAcc < 0.5 && (trend === "STABLE" || trend === "PROGRESSING")) trend = "REGRESSING";

    const classification =
      s.mastery < 50 ? "CRITICAL"
      : s.mastery < 65 ? "WEAK"
      : s.mastery < 80 ? "DEVELOPING"
      : "STRONG";

    subjectDetails.push({ subjectId: s.subject_id, currentMastery: s.mastery, baselineMastery: s.baseline_mastery, delta, trend, classification });

    if (!triggerReason) {
      if (delta <= DRIFT_THRESHOLD) triggerReason = "mastery_drift";
      else if (s.mastery >= RECOVERY_THRESHOLD && planWeakAreaIds.has(s.subject_id)) triggerReason = "recovery";
      else if (!planWeakAreaIds.has(s.subject_id) && s.mastery < CRITICAL_THRESHOLD && s.answers_total >= MIN_ANSWERS_FOR_NEW_CRITICAL) triggerReason = "new_critical";
    }
  }

  if (!triggerReason && planAge > STALENESS_DAYS * 864e5) triggerReason = "staleness";

  const onCooldown = cooldownRemaining > 0;
  const autoRegenDisabled = planRow.auto_regen_enabled === false;
  const shouldRegen = !!triggerReason && !onCooldown && !autoRegenDisabled;

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    shouldRegen,
    reason: shouldRegen ? triggerReason : null,
    cooldownRemaining: Math.round(cooldownRemaining / 1000),
    autoRegenEnabled: planRow.auto_regen_enabled !== false,
    subjects: subjectDetails,
    lastRegenAt: planRow.last_regen_at ?? null,
    regenCount: planRow.regen_count ?? 0,
    planId: planRow.id,
  });
}

// ---- /api/system?fn=study-adaptive-regen -----------------------------------

async function studyAdaptiveRegen(req: VercelRequest, res: VercelResponse) {
  const admin = getSupabaseAdmin();
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  if (!(await isFeatureEnabled("adaptiveRegen"))) return res.status(403).json({ error: "Adaptive regen not enabled." });
  if (!(await isFeatureEnabled("aiStudyScheduler"))) return res.status(403).json({ error: "Study scheduler not enabled." });

  const screen = await screenSubmission({ formId: "study:adaptive-regen", identity: user.id, body: req.body, req });
  if (!screen.ok) return res.status(screen.status).json({ error: screen.error });

  const { data: planRow, error: planErr } = await admin
    .from("study_plans")
    .select("id, plan, generated_at, last_regen_at, regen_count, auto_regen_enabled")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (planErr || !planRow) return res.status(404).json({ error: "No active study plan." });

  const now = Date.now();
  const regenCount = planRow.regen_count ?? 0;

  // Cooldown enforcement
  if (planRow.last_regen_at) {
    const elapsed = now - new Date(planRow.last_regen_at).getTime();
    if (elapsed < AUTO_REGEN_COOLDOWN_MS) {
      const secs = Math.round((AUTO_REGEN_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({ error: "Regen on cooldown.", rateLimited: true, cooldownRemaining: secs });
    }
  }

  // Auto-regen rate cap: ≥3 regens → disable auto, but allow manual
  if (regenCount >= MAX_AUTO_REGENS_PER_7D && req.body?.source !== "manual") {
    await admin.from("study_plans").update({ auto_regen_enabled: false }).eq("id", planRow.id);
    return res.status(429).json({ error: "Auto-regen limit reached. Manual regen still available.", rateLimited: true });
  }

  // Build coach scores from mastery snapshots
  const { data: snapRows } = await admin
    .from("mastery_snapshots")
    .select("subject_id, mastery")
    .eq("user_id", user.id);

  const scores: Record<string, { correct: number; total: number }> = {};
  for (const s of (snapRows ?? []) as { subject_id: string; mastery: number }[]) {
    scores[s.subject_id] = { correct: s.mastery, total: 100 };
  }
  if (Object.keys(scores).length === 0) return res.status(422).json({ error: "No mastery data to regenerate plan." });

  // Generate new plan via coach (reuses existing coach infra + caching)
  const { handleCoach } = await import("./_lib/coach.js");
  const { GoogleGenAI } = await import("@google/genai");
  const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  if (!GEMINI_KEY) return res.status(503).json({ error: "AI service unavailable." });

  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
  const coachResult = await handleCoach(ai, admin, user.id, {
    scores,
    examId: (planRow.plan as { meta?: { examId?: string } })?.meta?.examId ?? null,
    targetDate: (planRow.plan as { meta?: { targetDate?: string } })?.meta?.targetDate ?? null,
  });
  if (coachResult.status !== 200) return res.status(coachResult.status).json(coachResult.body);

  const newPlanId = (coachResult.body as { planId?: string }).planId;
  if (!newPlanId) return res.status(500).json({ error: "Coach did not return plan ID." });

  // Materialize new plan inline (no HTTP round-trip)
  const { data: newPlanRow, error: newPlanErr } = await admin
    .from("study_plans").select("id, plan").eq("id", newPlanId).single();
  if (newPlanErr || !newPlanRow) return res.status(500).json({ error: "Failed to load new plan." });

  const validation = validateStudyPlan(newPlanRow.plan);
  if (!validation.ok) return res.status(422).json({ error: `Invalid plan: ${validation.error}` });

  const baseDate = new Date();
  const todayISO = baseDate.toISOString().slice(0, 10);
  const missionRows = expandPlanToMissions(validation.plan, { planId: newPlanId, userId: user.id, baseDate });

  // Delete future pending missions for OLD plan, insert new
  await admin.from("study_missions")
    .delete()
    .eq("plan_id", planRow.id)
    .eq("source", "plan")
    .eq("status", "pending")
    .gte("scheduled_date", todayISO);

  if (missionRows.length > 0) {
    const { error: insErr } = await admin.from("study_missions").insert(missionRows);
    if (insErr) return res.status(500).json({ error: "Failed to create missions after regen." });
  }

  // Re-baseline mastery snapshots: baseline_mastery = current mastery
  const rebaseRows = (snapRows ?? []).map((s: { subject_id: string; mastery: number }) => ({
    user_id: user.id,
    subject_id: s.subject_id,
    baseline_mastery: s.mastery,
    updated_at: new Date().toISOString(),
  }));
  if (rebaseRows.length > 0) {
    await admin.from("mastery_snapshots").upsert(rebaseRows, { onConflict: "user_id,subject_id" });
  }

  const daysSinceLast = planRow.last_regen_at
    ? Math.round((now - new Date(planRow.last_regen_at).getTime()) / 864e5)
    : Math.round((now - new Date(planRow.generated_at ?? 0).getTime()) / 864e5);

  await admin.from("study_plans")
    .update({ last_regen_at: new Date().toISOString(), regen_count: regenCount + 1 })
    .eq("id", newPlanId);

  return res.status(200).json({
    ok: true,
    newPlanId,
    missionsCreated: missionRows.length,
    regenCount: regenCount + 1,
    daysSinceLastRegen: daysSinceLast,
  });
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

  if (fn === "study-metrics") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    return studyMetrics(req, res);
  }

  if (fn === "study-mastery-check") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    return studyMasteryCheck(req, res);
  }

  if (fn === "study-adaptive-regen") {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    return studyAdaptiveRegen(req, res);
  }

  return res.status(404).json({ error: "Not Found" });
}
