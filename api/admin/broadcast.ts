import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin, validateBroadcastPayload, screenSubmission } from "../_lib/utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const admin = getSupabaseAdmin();

    // Authorize: caller must be in the admins roster.
    const { data: adminRow } = await admin
      .from("admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();
    if (!adminRow) return res.status(403).json({ error: "Admins only." });

    const screen = await screenSubmission({
      formId: "admin:broadcast",
      identity: user.id,
      body: req.body,
      structuredFields: ["title", "type"],
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
    return res.status(200).json({ success: true, sent });
  } catch (e: any) {
    console.error("Broadcast failed:", e);
    return res.status(500).json({ error: e.message || "Broadcast failed." });
  }
}
