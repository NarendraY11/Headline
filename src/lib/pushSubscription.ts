// M13: Push subscription — VAPID subscribe + save to DB

import { supabase } from "./supabase.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// Dev-only debug logger. Push subscription tracing is useful while developing
// but shouldn't ship to production consoles (noise + leaks endpoint/key shape).
// warn/error below are kept unconditionally — those are real failures.
const dlog = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

if (typeof window !== "undefined") {
  dlog("[push] VITE_VAPID_PUBLIC_KEY present:", !!VAPID_PUBLIC_KEY, "length:", VAPID_PUBLIC_KEY?.length ?? 0);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export async function subscribePush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.error("[push] VITE_VAPID_PUBLIC_KEY not set — cannot subscribe. Set it in Vercel env and redeploy.");
    return null;
  }
  if (!("serviceWorker" in navigator)) {
    console.warn("[push] ServiceWorker not supported in this browser.");
    return null;
  }
  if (!("PushManager" in window)) {
    console.warn("[push] PushManager not supported in this browser.");
    return null;
  }

  try {
    dlog("[push] Waiting for SW to be ready…");
    const reg = await navigator.serviceWorker.ready;
    dlog("[push] SW ready. Scope:", reg.scope);

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      dlog("[push] Existing subscription found — reusing.");
      return existing;
    }

    dlog("[push] Calling PushManager.subscribe()…");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    dlog("[push] Subscription created. Endpoint prefix:", sub.endpoint.slice(0, 60));
    return sub;
  } catch (e) {
    console.error("[push] PushManager.subscribe() failed:", e);
    return null;
  }
}

export async function savePushSubscription(
  userId: string,
  sub: PushSubscription
): Promise<void> {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? "";
  const auth = json.keys?.auth ?? "";
  dlog("[push] Saving subscription to DB. userId:", userId, "p256dh present:", !!p256dh, "auth present:", !!auth);
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) {
    console.error("[push] savePushSubscription DB upsert failed:", error.message, error.code);
  } else {
    dlog("[push] Subscription saved to push_subscriptions ✓");
  }
}

export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  const sub = await (await navigator.serviceWorker?.ready)?.pushManager?.getSubscription();
  if (sub) await sub.unsubscribe().catch(() => {});
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
}
