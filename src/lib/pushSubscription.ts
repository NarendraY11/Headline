// M13: Push subscription — VAPID subscribe + save to DB

import { supabase } from "./supabase.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
    console.warn("VITE_VAPID_PUBLIC_KEY not set — push subscribe skipped.");
    return null;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (e) {
    console.warn("Push subscribe failed:", e);
    return null;
  }
}

export async function savePushSubscription(
  userId: string,
  sub: PushSubscription
): Promise<void> {
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) console.warn("savePushSubscription failed:", error.message);
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
