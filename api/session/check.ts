import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin, getClientIdentity } from "../_lib/utils";

// Server-side IP binding for active sessions. The browser cannot read its own
// public IP, so this endpoint captures it from X-Forwarded-For and binds it to
// the user's active session on first call. A later call from a different IP
// returns { valid: false, reason: "ip_changed" } so the client can force a
// logout (session hijack / token replay signal).
//
// Fails OPEN: any lookup/update error (incl. the ip_address column not yet
// existing) returns valid:true so the check never locks users out on error.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const sessionId = typeof req.body?.session_id === "string" ? req.body.session_id : "";
  const ip = getClientIdentity(req); // first X-Forwarded-For IP, else "anonymous"

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from("active_sessions")
      .select("session_id, ip_address")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !row) {
      return res.status(200).json({ valid: true }); // nothing to compare yet
    }

    // A newer session from another device superseded this one.
    if (sessionId && row.session_id && row.session_id !== sessionId) {
      return res.status(200).json({ valid: false, reason: "superseded" });
    }

    // Bind on first observation.
    if (!row.ip_address) {
      await admin.from("active_sessions").update({ ip_address: ip }).eq("user_id", user.id);
      return res.status(200).json({ valid: true, bound: true });
    }

    if (row.ip_address !== ip) {
      return res.status(200).json({ valid: false, reason: "ip_changed" });
    }

    return res.status(200).json({ valid: true });
  } catch (e) {
    console.warn("session/check failed (fail-open):", e);
    return res.status(200).json({ valid: true });
  }
}
