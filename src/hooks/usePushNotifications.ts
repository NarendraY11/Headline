// M13: usePushNotifications — VAPID permission + subscription lifecycle

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import {
  requestPushPermission,
  subscribePush,
  savePushSubscription,
  removePushSubscription,
} from "../lib/pushSubscription";

export interface UsePushNotificationsState {
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  loading: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsState {
  const enabled = useFeature("pushNotifications");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Read current SW subscription state on mount
  useEffect(() => {
    if (!enabled) return;
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    setPermission(Notification.permission);

    async function checkExisting() {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;
      const sub = await reg.pushManager?.getSubscription().catch(() => null);
      setSubscribed(!!sub);
    }
    void checkExisting();
  }, [enabled]);

  const enable = useCallback(async () => {
    if (!enabled || !userId) return;
    setLoading(true);
    try {
      const perm = await requestPushPermission();
      setPermission(perm);
      if (perm !== "granted") return;
      const sub = await subscribePush();
      if (!sub) return;
      await savePushSubscription(userId, sub);
      setSubscribed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId]);

  const disable = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker?.ready.catch(() => null);
      const sub = await reg?.pushManager?.getSubscription().catch(() => null);
      if (sub) await removePushSubscription(userId, sub.endpoint);
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { permission, subscribed, loading, enable, disable };
}
