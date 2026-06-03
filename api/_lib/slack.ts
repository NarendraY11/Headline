// ---------------------------------------------------------------------------
// Instant Slack pings from the serverless API layer.
//
// Mirrors the DB-side public.notify_slack(), but fires on the request path so
// revenue/ops events land in Slack immediately instead of waiting for the
// 5-minute pg_cron sweep. Channel → env webhook, falling back to the security
// webhook, then no-op. Best-effort: a Slack failure must never break the API.
//
// Required Vercel env. Set per-channel hooks to split, or just SLACK_WEBHOOK_URL
// to send everything to one channel:
//   SLACK_WEBHOOK_REVENUE  SLACK_WEBHOOK_OPS  SLACK_WEBHOOK_SECURITY
//   SLACK_WEBHOOK_URL  (global fallback for any channel without its own hook)
// ---------------------------------------------------------------------------
export type SlackChannel = "revenue" | "ops" | "security";

function webhookFor(channel: SlackChannel): string | undefined {
  const map: Record<SlackChannel, string | undefined> = {
    revenue: process.env.SLACK_WEBHOOK_REVENUE,
    ops: process.env.SLACK_WEBHOOK_OPS,
    security: process.env.SLACK_WEBHOOK_SECURITY,
  };
  // Per-channel hook → security hook → single global SLACK_WEBHOOK_URL. So a
  // missing channel hook degrades to "everything in one channel", not dropped.
  return map[channel] || process.env.SLACK_WEBHOOK_SECURITY || process.env.SLACK_WEBHOOK_URL;
}

// Posts a message to Slack. Never throws.
export async function notifySlack(text: string, channel: SlackChannel = "security"): Promise<void> {
  try {
    const url = webhookFor(channel);
    if (!url) return; // not configured; no-op
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("[slack] notify failed:", (e as any)?.message ?? e);
  }
}

// Formats paise (Razorpay's integer amount) as a rupee string, e.g. 49900 → "499".
export function formatRupees(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
