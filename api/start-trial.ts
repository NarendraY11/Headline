import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin, screenSubmission } from "./_lib/utils";

const TRIAL_DAYS = 7;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const screen = await screenSubmission({
    formId: "start-trial",
    identity: user.id,
    body: req.body,
  });
  if (!screen.ok) {
    return res.status(screen.status).json({ error: screen.error });
  }

  try {
    const admin = getSupabaseAdmin();

    // Feature flag gate.
    const { data: settingsRow } = await admin
      .from("app_settings")
      .select("flags")
      .eq("id", 1)
      .single();
    if (settingsRow?.flags && settingsRow.flags.freeTrial === false) {
      return res.status(403).json({ error: "Free trial is currently disabled." });
    }

    const { data: profile, error: readErr } = await admin
      .from("profiles")
      .select("plan, plan_started_at, trial_used, settings")
      .eq("id", user.id)
      .single();

    if (readErr || !profile) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const alreadyUsed = profile.trial_used === true || profile.settings?.trialUsed === true;
    if (alreadyUsed) {
      return res.status(400).json({ error: "Trial has already been used." });
    }
    if (profile.plan !== "free") {
      return res.status(400).json({ error: "Trial is only available on the free plan." });
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

    const mergedSettings = {
      ...(profile.settings || {}),
      trialUsed: true,
      trialStartedAt: startedAt.toISOString(),
    };

    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        plan: "trial",
        plan_status: "active",
        plan_started_at: startedAt.toISOString(),
        plan_expires_at: expiresAt.toISOString(),
        trial_used: true,
        trial_started_at: startedAt.toISOString(),
        trial_ends_at: expiresAt.toISOString(),
        settings: mergedSettings,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error(`Failed to grant trial for user ${user.id}:`, updateErr);
      return res.status(500).json({ error: "Failed to grant trial." });
    }

    try {
      await admin.from("plan_changes").insert({
        user_id: user.id,
        old_plan: "free",
        new_plan: "trial",
        expires_at: expiresAt.toISOString(),
        note: `${TRIAL_DAYS}-day free trial`,
      });
    } catch (auditErr) {
      console.warn("plan_changes audit insert failed:", auditErr);
    }

    console.log(`Granted ${TRIAL_DAYS}-day trial to user ${user.id}`);
    return res.status(200).json({
      success: true,
      plan: "trial",
      plan_expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Trial start failed:", error);
    return res.status(500).json({ error: error.message || "Failed to start trial." });
  }
}
