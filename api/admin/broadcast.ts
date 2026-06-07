import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, validateBroadcastPayload, screenSubmission } from "../_lib/utils.js";
import { logSecurityEvent, logAudit } from "../_lib/securityLog.js";
import { authorizeRequest, requireAdmin } from "../_lib/guards.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Universal guard: authenticate (401) + authorize as admin (403) + log the
  // denied attempt. Replaces the manual admins lookup + inline 403 + log.
  const user = await authorizeRequest(req, res, {
    action: "admin.broadcast",
    authorize: requireAdmin,
  });
  if (!user) return;

  try {
    const admin = getSupabaseAdmin();

    const screen = await screenSubmission({
      formId: "admin:broadcast",
      identity: user.id,
      body: req.body,
      structuredFields: ["title", "type"],
      req,
    });
    if (!screen.ok) {
      return res.status(screen.status).json({ error: screen.error });
    }

    const validationError = validateBroadcastPayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const { title, message, type } = req.body || {};

    // Fan-out runs entirely in Postgres (one INSERT…SELECT) so a 100k-user
    // broadcast can't exceed the serverless function timeout. Returns the row
    // count inserted.
    const { data: sent, error } = await admin.rpc("broadcast_notification", {
      p_title: title,
      p_message: message,
      p_type: type || "system",
    });
    if (error) throw error;

    // Bulk-access signal for the alert sweep.
    if ((sent ?? 0) > 100) {
      void logSecurityEvent({
        req,
        eventType: "data.bulk_access",
        severity: "info",
        userId: user.id,
        actorEmail: user.email,
        metadata: { count: sent, table: "profiles", via: "admin.broadcast" },
      });
    }

    console.log(`Broadcast sent to ${sent} users by ${user.email}`);
    void logAudit({
      req,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "admin.broadcast",
      tableName: "notifications",
      source: "api",
      newValue: { title: String(title).slice(0, 200), type: type || "system", recipients: sent },
    });
    return res.status(200).json({ success: true, sent });
  } catch (e: any) {
    console.error("Broadcast failed:", e);
    return res.status(500).json({ error: e.message || "Broadcast failed." });
  }
}
