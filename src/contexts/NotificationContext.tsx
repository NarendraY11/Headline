import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export interface NotificationItem {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: "milestone" | "reminder" | "system" | "countdown";
  read: boolean;
  created_at: string;
}

interface NotificationContextProps {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  addNotification: (title: string, body: string, type: "milestone" | "reminder" | "system" | "countdown") => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Abort flag: set to true to cancel an in-flight refreshNotifications call
  // when the user changes or the component unmounts.
  const refreshAbortRef = useRef(false);

  const getLocalNotifications = useCallback((): NotificationItem[] => {
    try {
      const saved = localStorage.getItem("heading_notifications_local");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse local notifications:", e);
    }
    return [];
  }, []);

  const saveLocalNotifications = useCallback((list: NotificationItem[]) => {
    try {
      localStorage.setItem("heading_notifications_local", JSON.stringify(list));
    } catch (e) {
      console.warn("Failed to save local notifications:", e);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    refreshAbortRef.current = false;

    if (!user) {
      const local = getLocalNotifications();
      if (local.length === 0) {
        const seeded: NotificationItem[] = [
          {
            id: "system-welcome",
            user_id: null,
            title: "Clearance Granted",
            body: "Welcome aboard Heading. Premium aviation prep environment is operational. Clear telemetry is active.",
            type: "system",
            read: false,
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
          {
            id: "system-content",
            user_id: null,
            title: "Syllabus Content Update",
            body: "Air Navigation and Meteorology questions updated with latest DGCA/FAA public specifications.",
            type: "system",
            read: false,
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
          }
        ];
        saveLocalNotifications(seeded);
        if (!refreshAbortRef.current) setNotifications(seeded);
      } else {
        if (!refreshAbortRef.current) setNotifications(local);
      }
      if (!refreshAbortRef.current) setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, title, message, type, read, created_at")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false });

      if (refreshAbortRef.current) return;

      const mapRows = (rows: any[]): NotificationItem[] =>
        (rows || []).map((r) => ({
          id: r.id,
          user_id: r.user_id ?? null,
          title: r.title,
          body: r.body ?? r.message ?? "",
          type: r.type,
          read: !!r.read,
          created_at: r.created_at,
        }));

      if (error) {
        console.warn("Fall back to local notifications:", error.message);
        const local = getLocalNotifications();
        if (local.length === 0) {
          const seeded: NotificationItem[] = [
            {
              id: "system-welcome",
              user_id: user.uid,
              title: "Clearance Granted",
              body: "Welcome aboard Heading! Premium aviation prep environment is operational. Clear telemetry is active.",
              type: "system",
              read: false,
              created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            },
            {
              id: "system-content",
              user_id: user.uid,
              title: "Syllabus Content Update",
              body: "Air Navigation and Meteorology questions updated with latest DGCA/FAA public specifications.",
              type: "system",
              read: false,
              created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            }
          ];
          saveLocalNotifications(seeded);
          if (!refreshAbortRef.current) setNotifications(seeded);
        } else {
          if (!refreshAbortRef.current) setNotifications(local);
        }
      } else {
        if (!refreshAbortRef.current) setNotifications(mapRows(data || []));
      }
    } catch (e) {
      console.warn("Unexpected database error for notifications. Using fallback.", e);
      if (!refreshAbortRef.current) setNotifications(getLocalNotifications());
    } finally {
      if (!refreshAbortRef.current) setLoading(false);
    }
  }, [user?.uid, getLocalNotifications, saveLocalNotifications]);

  // Cancel any in-flight refresh when user changes or component unmounts.
  useEffect(() => {
    refreshAbortRef.current = false;
    return () => { refreshAbortRef.current = true; };
  }, [user?.uid]);

  // Initial load — depends on refreshNotifications which is stable per user?.uid.
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Hold latest refreshNotifications in a ref so the Realtime handler always
  // calls the current version without the channel needing to be recreated.
  const refreshRef = useRef(refreshNotifications);
  useEffect(() => { refreshRef.current = refreshNotifications; }, [refreshNotifications]);

  // Realtime: push new rows to the client the moment they're inserted/updated.
  // Dep is [user?.uid] only — the channel is recreated only when user changes,
  // not on every refreshNotifications identity change (which was the bug).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.uid}` },
        () => { refreshRef.current(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.uid}` },
        () => { refreshRef.current(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNotification = useCallback(async (
    title: string,
    body: string,
    type: "milestone" | "reminder" | "system" | "countdown"
  ) => {
    const newNotif: NotificationItem = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
      user_id: user ? user.uid : null,
      title,
      body,
      type,
      read: false,
      created_at: new Date().toISOString(),
    };

    if (!user) {
      const local = [newNotif, ...getLocalNotifications()];
      saveLocalNotifications(local);
      setNotifications(local);
      return;
    }

    try {
      const { error } = await supabase.from("notifications").insert({
        title,
        message: body,
        type,
        user_id: user.uid,
        read: false,
      });

      if (error) {
        const local = [newNotif, ...getLocalNotifications()];
        saveLocalNotifications(local);
        setNotifications(local);
      } else {
        await refreshNotifications();
      }
    } catch {
      const local = [newNotif, ...getLocalNotifications()];
      saveLocalNotifications(local);
      setNotifications(local);
    }
  }, [user?.uid, getLocalNotifications, saveLocalNotifications, refreshNotifications]);

  // Countdown exam date reminder — runs once when notifications stabilise.
  // Uses a ref to avoid repeatedly calling addNotification across re-renders.
  const countdownAddedRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (countdownAddedRef.current) return;

    const savedName = localStorage.getItem("heading_nextCheckName") || "";
    const savedDate = localStorage.getItem("heading_nextCheckDate") || "";
    const savedTime = localStorage.getItem("heading_nextCheckTime") || "09:00";

    if (!savedDate) return;

    const targetDate = new Date(`${savedDate}T${savedTime}:00`);
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return;

    const title = `Countdown: ${savedName || "Aviation Exam"}`;
    const body = `Your check flight exam is in ${days === 0 ? "today" : `${days} days`}. Stay sharp, keep training!`;

    const exists = notifications.some(n => n.type === "countdown" && n.title === title && n.body === body);
    if (!exists) {
      countdownAddedRef.current = true;
      addNotification(title, body, "countdown");
    } else {
      countdownAddedRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    const localList = getLocalNotifications().map(n => (n.id === id ? { ...n, read: true } : n));
    saveLocalNotifications(localList);

    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) {
        console.warn("Supabase update fail, local fallback active.");
      }
    } catch (e) {
      console.warn("Failed syncing read notification:", e);
    }
  }, [user?.uid, getLocalNotifications, saveLocalNotifications]);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );

    const localList = getLocalNotifications().map(n => ({ ...n, read: true }));
    saveLocalNotifications(localList);

    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.uid);

      if (error) {
        console.warn("Supabase markAllAsRead failed.");
      }
    } catch (e) {
      console.warn("Failed marking all as read:", e);
    }
  }, [user?.uid, getLocalNotifications, saveLocalNotifications]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    const localList = getLocalNotifications().filter(n => n.id !== id);
    saveLocalNotifications(localList);

    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("Supabase delete fail.");
      }
    } catch (e) {
      console.warn("Failed deleting notification:", e);
    }
  }, [user?.uid, getLocalNotifications, saveLocalNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = useMemo<NotificationContextProps>(() => ({
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  }), [
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
