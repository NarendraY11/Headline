import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_lib/utils";
import { logSecurityEvent } from "../_lib/securityLog";

const PRIMARY_OWNER_EMAIL = "narendray112050@gmail.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const email = user.email;
    if (email !== PRIMARY_OWNER_EMAIL) {
      void logSecurityEvent({
        req,
        eventType: "authz.denied",
        severity: "critical",
        userId: user.id,
        actorEmail: email,
        statusCode: 403,
        metadata: { action: "admin.init_owner", note: "non-owner attempted owner bootstrap" },
      });
      return res.status(403).json({ error: "Not primary owner" });
    }

    const admin = getSupabaseAdmin();
    const { error: insertErr } = await admin.from("admins").insert({ email });
    // 23505 = unique violation (already seeded) -> treat as success.
    if (insertErr && insertErr.code !== "23505") {
      console.error("Failed to seed admin:", insertErr);
      return res.status(500).json({ error: insertErr.message });
    }

    // The admins INSERT is itself audited by the DB trigger (admin.grant).
    void logSecurityEvent({
      req,
      eventType: "admin.bootstrap",
      severity: "critical",
      userId: user.id,
      actorEmail: email,
      statusCode: 200,
      metadata: { alreadySeeded: insertErr?.code === "23505" },
    });
    return res.status(200).json({ success: true, email });
  } catch (e: any) {
    console.error("Owner init error:", e);
    return res.status(500).json({ error: e.message });
  }
}
