// send-push — deliver a Web Push notification to one or more users (PWA Tier 3).
//
// Called after the admin broadcast inserts rows into `notifications` (see
// views/admin/NotificationsManager.tsx). Verifies the caller is an admin, loads
// the target users' push subscriptions with the service role, and sends each
// via VAPID. Subscriptions the push service reports as gone (404/410) are
// pruned.
//
// Required edge-function secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:support@heading.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// Deploy (gated — run only when ready):
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
  notification: { title: string; body?: string; url?: string; tag?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@heading.com";

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID keys not configured" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // --- Authn/Authz: caller must be a signed-in admin. ---
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr || isAdmin !== true) return json({ error: "forbidden" }, 403);

  // --- Parse payload ---
  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const userIds = Array.from(new Set((payload.userIds || []).filter(Boolean)));
  const note = payload.notification;
  if (userIds.length === 0 || !note?.title) {
    return json({ error: "userIds and notification.title required" }, 400);
  }

  // --- Load subscriptions with the service role (bypasses RLS) ---
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsErr) return json({ error: subsErr.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, pruned: 0 });

  const body = JSON.stringify({
    title: note.title,
    body: note.body || "",
    url: note.url || "/",
    tag: note.tag,
  });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
      }
    })
  );

  if (gone.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", gone);
  }

  return json({ sent, pruned: gone.length });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
