// send-push — production-grade Web Push delivery (M13 upgraded).
//
// Supports: TTL, icon/badge, click URL, action buttons with per-action URLs,
// tag grouping, renotify, requireInteraction, silent mode, per-delivery analytics.
//
// Required Supabase secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy:
//   supabase functions deploy send-push
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationAction {
  /** Matches event.action in notificationclick */
  action: string;
  title: string;
  icon?: string;
  /** URL to open when this action is clicked (stored in SW data.actionUrls) */
  url?: string;
}

type NotificationType = "broadcast" | "reminder" | "exam" | "streak" | "test" | "system";

interface PushPayload {
  /** Target user IDs. Pass ["*"] to send to all subscribed users. */
  userIds: string[];
  notification: {
    title: string;
    body?: string;
    /** Click URL (default: /today) */
    url?: string;
    /** Notification icon (default: /pwa-192x192.png) */
    icon?: string;
    /** Badge icon shown in status bar (default: /badge-72x72.png) */
    badge?: string;
    /** Groups notifications — same tag replaces previous */
    tag?: string;
    /** Re-show notification even when same tag exists */
    renotify?: boolean;
    /** Keep notification on screen until user interacts (important alerts) */
    requireInteraction?: boolean;
    /** Deliver silently — no sound/vibration */
    silent?: boolean;
    /** Action buttons (Chrome desktop / Android) */
    actions?: NotificationAction[];
    /** Category for delivery analytics */
    type?: NotificationType;
  };
  /**
   * Time-to-live in seconds. Push service discards undelivered notification after TTL.
   *   0 = deliver immediately or drop (no retry)
   *   86400 = try for 24 hours (default)
   *   604800 = 7 days
   */
  ttl?: number;
  /** Opaque ID for tracking (stored in delivery log + sent to SW for click analytics) */
  notificationId?: string;
}

interface DeliveryLogRow {
  notification_id: string | null;
  notification_type: string;
  user_id: string;
  endpoint_hash: string;
  success: boolean;
  status_code: number | null;
  error_message: string | null;
  ttl: number;
  sent_at: string;
}

interface DeliveryResult {
  userId: string;
  endpointPrefix: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const DEFAULT_TTL     = 86400;  // 24 hours
const DEFAULT_ICON    = "/pwa-192x192.png";
const DEFAULT_BADGE   = "/badge-72x72.png";
const DEFAULT_TAG     = "heading-push";
const DEFAULT_URL     = "/today";

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // ── VAPID setup ────────────────────────────────────────────────────────────
  const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC    = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE   = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT   = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@heading.com";

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error("[send-push] VAPID keys not configured");
    return json({ error: "VAPID keys not configured" }, 500);
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("[send-push] setVapidDetails failed:", e);
    return json({ error: "invalid VAPID configuration" }, 500);
  }

  // ── Auth: signed-in admin OR server-to-server call ────────────────────────
  // Server calls (Inngest, QStash) pass X-Internal-Secret = SUPABASE_SERVICE_ROLE_KEY.
  // This avoids needing a user JWT for server-originated push jobs.
  const internalSecret = req.headers.get("X-Internal-Secret");
  const isServerCall = internalSecret && internalSecret === SERVICE_ROLE;

  if (!isServerCall) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || isAdmin !== true) return json({ error: "forbidden" }, 403);
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: PushPayload;
  try { payload = await req.json(); }
  catch { return json({ error: "invalid json" }, 400); }

  const note     = payload.notification;
  const rawIds   = payload.userIds ?? [];
  const broadcastAll = rawIds.includes("*");
  const ttl      = Math.max(0, Math.min(payload.ttl ?? DEFAULT_TTL, 2419200)); // max 28 days

  if (!note?.title) return json({ error: "notification.title required" }, 400);
  if (rawIds.length === 0) return json({ error: "userIds required (or [\"*\"] for all)" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Load subscriptions ─────────────────────────────────────────────────────
  let subsQuery = admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (!broadcastAll) {
    const userIds = Array.from(new Set(rawIds.filter(Boolean)));
    subsQuery = subsQuery.in("user_id", userIds);
  }

  const { data: subs, error: subsErr } = await subsQuery;
  if (subsErr) {
    console.error("[send-push] subscription load failed:", subsErr.message);
    return json({ error: subsErr.message }, 500);
  }
  if (!subs || subs.length === 0) {
    console.log("[send-push] no subscriptions found");
    return json({ sent: 0, failed: 0, pruned: 0, total: 0, results: [] });
  }

  // ── Build SW payload ───────────────────────────────────────────────────────
  const actions = note.actions ?? [];
  const actionUrls: Record<string, string> = {};
  for (const a of actions) {
    if (a.url) actionUrls[a.action] = a.url;
  }

  const swPayload = JSON.stringify({
    title:              note.title,
    body:               note.body              ?? "",
    url:                note.url               ?? DEFAULT_URL,
    icon:               note.icon              ?? DEFAULT_ICON,
    badge:              note.badge             ?? DEFAULT_BADGE,
    tag:                note.tag               ?? DEFAULT_TAG,
    renotify:           note.renotify          ?? false,
    requireInteraction: note.requireInteraction ?? false,
    silent:             note.silent            ?? false,
    actions:            actions.map(({ action, title, icon }) => ({ action, title, icon })),
    actionUrls,
    notificationId:     payload.notificationId ?? null,
  });

  // ── Send in parallel ───────────────────────────────────────────────────────
  let sent = 0, failed = 0;
  const gone: string[]           = [];
  const results: DeliveryResult[] = [];
  const logRows: DeliveryLogRow[] = [];
  const now = new Date().toISOString();

  await Promise.all(
    subs.map(async (s) => {
      const endpointHash   = await sha256hex(s.endpoint);
      const endpointPrefix = s.endpoint.slice(0, 60) + "…";
      const result: DeliveryResult = { userId: s.user_id, endpointPrefix, success: false };

      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          swPayload,
          { TTL: ttl }
        );
        sent++;
        result.success = true;
        console.log("[send-push] ✓ delivered to", s.user_id);
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number })?.statusCode;
        result.statusCode = code;
        result.error      = String(err).slice(0, 200);
        if (code === 404 || code === 410) {
          gone.push(s.endpoint);
          console.warn("[send-push] ✗ expired subscription pruned:", s.user_id);
        } else {
          console.warn("[send-push] ✗ delivery failed for", s.user_id, "status:", code);
        }
      }

      results.push(result);
      logRows.push({
        notification_id:   payload.notificationId ?? null,
        notification_type: note.type ?? "broadcast",
        user_id:           s.user_id,
        endpoint_hash:     endpointHash,
        success:           result.success,
        status_code:       result.statusCode ?? null,
        error_message:     result.error ?? null,
        ttl,
        sent_at:           now,
      });
    })
  );

  // ── Prune expired subscriptions ────────────────────────────────────────────
  if (gone.length > 0) {
    const { error: pruneErr } = await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", gone);
    if (pruneErr) console.warn("[send-push] prune failed:", pruneErr.message);
  }

  // ── Write delivery analytics ───────────────────────────────────────────────
  if (logRows.length > 0) {
    const { error: logErr } = await admin
      .from("push_delivery_log")
      .insert(logRows);
    if (logErr) console.warn("[send-push] delivery log insert failed:", logErr.message);
  }

  const response = { sent, failed, pruned: gone.length, total: subs.length, results };
  console.log("[send-push] summary:", JSON.stringify({ sent, failed, pruned: gone.length, total: subs.length }));
  return json(response);
});
