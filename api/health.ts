import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "./_lib/utils";

// Lightweight health probe for uptime monitors (UptimeRobot / Better Stack /
// Vercel) and status pages. Public, but leaks nothing: just liveness + a DB
// round-trip. Returns 200 when healthy, 503 when the DB is unreachable, so a
// monitor can alert (and a slow response time flags resource exhaustion / DDoS).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();
  let db = false;

  try {
    // Cheap, RLS-safe round-trip: app_settings has exactly one public row.
    const { error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("id", { head: true, count: "estimated" })
      .limit(1);
    db = !error;
  } catch {
    db = false;
  }

  const dbLatencyMs = Date.now() - startedAt;
  const ok = db;

  res.setHeader("Cache-Control", "no-store");
  return res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    db,
    dbLatencyMs,
    timestamp: new Date().toISOString(),
  });
}
