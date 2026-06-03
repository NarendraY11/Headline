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

    const { data: profiles, error } = await admin.from("profiles").select("id");
    if (error) throw error;

    // Server-side bulk read of the user base — feeds the bulk-access alert rule.
    if ((profiles?.length ?? 0) > 100) {
      void logSecurityEvent({
        req,
        eventType: "data.bulk_access",
        severity: "info",
        userId: user.id,
        actorEmail: user.email,
        metadata: { count: profiles!.length, table: "profiles", via: "admin.broadcast" },
      });
    }

    const rows = (profiles || []).map((p: any) => ({
      user_id: p.id,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 2000),
      type: type || "system",
      read: false,
    }));

    let sent = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error: insErr } = await admin.from("notifications").insert(chunk);
      if (insErr) throw insErr;
      sent += chunk.length;
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
