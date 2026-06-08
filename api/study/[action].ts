import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin, isFeatureEnabled, screenSubmission } from "../_lib/utils.js";
import { validateStudyPlan, expandPlanToMissions } from "../_lib/studyPlan.js";

// Consolidated study-scheduler endpoint (Phase M1). One dynamic Serverless
// Function serves /api/study/{action} to stay under the platform function
// limit. Currently the only action is `materialize`.
//
// The whole feature is gated behind the `aiStudyScheduler` flag, which ships
// false — so every call returns 403 until an operator turns it on.

// Expand the caller's ACTIVE plan into study_missions. Idempotent: clears
// future pending plan-missions, then re-inserts. Completed / in-progress /
// skipped / manual rows are never touched.
async function materialize(req: VercelRequest, res: VercelResponse, userId: string) {
  const admin = getSupabaseAdmin();

  const { data: planRow, error: planErr } = await admin
    .from("study_plans")
    .select("id, plan")
    .eq("user_id", userId)
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
    userId,
    baseDate,
  });

  // Idempotent replace of future pending plan-missions for this plan.
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const actionParam = req.query.action;
  const action = Array.isArray(actionParam) ? actionParam[0] : actionParam;
  if (action !== "materialize") {
    return res.status(404).json({ error: "Not Found" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  // Feature gate — OFF by default, so this short-circuits in production.
  if (!(await isFeatureEnabled("aiStudyScheduler"))) {
    return res.status(403).json({ error: "This feature is currently disabled." });
  }

  const screen = await screenSubmission({
    formId: `study:${action}`,
    identity: user.id,
    body: req.body,
    req,
  });
  if (!screen.ok) {
    return res.status(screen.status).json({ error: screen.error });
  }

  try {
    return await materialize(req, res, user.id);
  } catch (error) {
    console.error("Error in study/materialize handler:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to process request." });
    }
    return res.end();
  }
}
