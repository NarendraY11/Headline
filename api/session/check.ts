import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin, getClientIdentity, ipNetworkPrefix } from "../_lib/utils.js";
import { logSecurityEvent } from "../_lib/securityLog.js";

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
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
  const ip = getClientIdentity(req); // first X-Forwarded-For IP, else "anonymous"

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from("active_sessions")
      .select("session_id, ip_address, device_info")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !row) {
      return res.status(200).json({ valid: true }); // nothing to compare yet
    }

    // A newer session from another device superseded this one — but tolerate
    // the same physical device (installed PWA vs browser keep separate session
    // ids in separate storage yet share a user-agent).
    const sameDevice = !!row.device_info && !!ua && row.device_info === ua;
    if (sessionId && row.session_id && row.session_id !== sessionId && !sameDevice) {
      void logSecurityEvent({
        req,
        eventType: "session.superseded",
        severity: "info",
        userId: user.id,
        actorEmail: user.email,
        metadata: { reason: "newer_device_session" },
      });
      return res.status(200).json({ valid: false, reason: "superseded" });
    }

    // Bind on first observation.
    if (!row.ip_address) {
      await admin.from("active_sessions").update({ ip_address: ip }).eq("user_id", user.id);
      return res.status(200).json({ valid: true, bound: true });
    }

    // Network change on an established session. Mobile networks (cellular
    // CGNAT, Wi-Fi handoff) legitimately rotate the public IP — often mid-
    // session — so this is ADVISORY ONLY: log it for forensics but NEVER evict
    // on IP alone, or installed mobile PWAs get logged out again and again.
    // Single-device takeover is still enforced above via the session_id
    // supersede check, which is the real anti-hijack signal.
    if (ipNetworkPrefix(row.ip_address) !== ipNetworkPrefix(ip)) {
      void logSecurityEvent({
        req,
        eventType: "session.ip_changed",
        severity: "warn",
        userId: user.id,
        actorEmail: user.email,
        metadata: { from_prefix: ipNetworkPrefix(row.ip_address), to_prefix: ipNetworkPrefix(ip) },
      });
    }

    return res.status(200).json({ valid: true });
  } catch (e) {
    console.warn("session/check failed (fail-open):", e);
    return res.status(200).json({ valid: true });
  }
}
