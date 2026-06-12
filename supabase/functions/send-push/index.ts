// send-push — deliver Web Push notifications to one or more users (PWA Tier 3).
//
// Called by admin notification dispatch after inserting to `notifications` table.
// Verifies the caller is a signed-in admin, loads push subscriptions via service
// role, sends each via VAPID (web-push), prunes expired subscriptions, and logs
// each delivery attempt.
//
// Required Supabase Edge Function secrets:
//   VAPID_PUBLIC_KEY   — base64url-encoded uncompressed EC public key
//   VAPID_PRIVATE_KEY  — base64url-encoded EC private key
//   VAPID_SUBJECT      — mailto: or https: URI (e.g. mailto:support@heading.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
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

interface PushPayload {
  userIds: string[];
  notification: {
    title: string;
    body?: string;
    url?: string;
    tag?: string;
    icon?: string;
  };
}

interface DeliveryLog {
  userId: string;
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@heading.com";

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[send-push] VAPID keys not configured");
    return json({ error: "VAPID keys not configured" }, 500);
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.error("[send-push] setVapidDetails failed:", e);
    return json({ error: "invalid VAPID configuration" }, 500);
  }

  // ── Authn/Authz: caller must be a signed-in admin ──────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr || isAdmin !== true) return json({ error: "forbidden" }, 403);

  // ── Parse + validate payload ───────────────────────────────────────────────
  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const userIds = Array.from(new Set((payload.userIds ?? []).filter(Boolean)));
  const note = payload.notification;
  if (userIds.length === 0 || !note?.title) {
    return json({ error: "userIds and notification.title required" }, 400);
  }

  // ── Load push subscriptions ────────────────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsErr) {
    console.error("[send-push] subscription load failed:", subsErr.message);
    return json({ error: subsErr.message }, 500);
  }
  if (!subs || subs.length === 0) {
    console.log("[send-push] no subscriptions for users:", userIds);
    return json({ sent: 0, pruned: 0, skipped: userIds.length, logs: [] });
  }

  const body = JSON.stringify({
    title: note.title,
    body: note.body ?? "",
    url: note.url ?? "/today",
    icon: note.icon ?? "/pwa-192x192.png",
    badge: "/badge-72x72.png",
    tag: note.tag ?? "heading-push",
  });

  // ── Send + collect logs ────────────────────────────────────────────────────
  let sent = 0;
  const gone: string[] = [];
  const logs: DeliveryLog[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const logEntry: DeliveryLog = {
        userId: s.user_id,
        endpoint: s.endpoint.slice(0, 60) + "…",
        success: false,
      };
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
        logEntry.success = true;
        console.log("[send-push] delivered to", s.user_id);
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        logEntry.statusCode = code;
        logEntry.error = String(err).slice(0, 200);
        if (code === 404 || code === 410) {
          gone.push(s.endpoint);
          console.warn("[send-push] expired subscription pruned:", s.user_id);
        } else {
          console.warn("[send-push] delivery failed for", s.user_id, "status:", code);
        }
      }
      logs.push(logEntry);
    })
  );

  // ── Prune expired subscriptions ────────────────────────────────────────────
  if (gone.length > 0) {
    const { error: pruneErr } = await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", gone);
    if (pruneErr) {
      console.warn("[send-push] prune failed:", pruneErr.message);
    }
  }

  const result = { sent, pruned: gone.length, total: subs.length, logs };
  console.log("[send-push] result:", JSON.stringify({ sent, pruned: gone.length, total: subs.length }));
  return json(result);
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
