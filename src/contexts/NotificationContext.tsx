import React, { createContext, useContext, useEffect, useState } from "react";
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

  // Helper to load localStorage fallback
  const getLocalNotifications = (): NotificationItem[] => {
    try {
      const saved = localStorage.getItem("heading_notifications_local");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse local notifications:", e);
    }
    return [];
  };

  const saveLocalNotifications = (list: NotificationItem[]) => {
    try {
      localStorage.setItem("heading_notifications_local", JSON.stringify(list));
    } catch (e) {
      console.warn("Failed to save local notifications:", e);
    }
  };

  const refreshNotifications = async () => {
    if (!user) {
      // Load offline notifications from local storage
      const local = getLocalNotifications();
      // If empty, seed with high-fidelity realistic starter notifications
      if (local.length === 0) {
        const seeded: NotificationItem[] = [
          {
            id: "system-welcome",
            user_id: null,
            title: "Clearance Granted",
            body: "Welcome aboard Heading. Premium aviation prep environment is operational. Clear telemetry is active.",
            type: "system",
            read: false,
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
          },
          {
            id: "system-content",
            user_id: null,
            title: "Syllabus Content Update",
            body: "Air Navigation and Meteorology questions updated with latest DGCA/FAA public specifications.",
            type: "system",
            read: false,
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
          }
        ];
        saveLocalNotifications(seeded);
        setNotifications(seeded);
      } else {
        setNotifications(local);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback to local storage if relation not enabled yet
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
          setNotifications(seeded);
        } else {
          setNotifications(local);
        }
      } else {
        setNotifications(data || []);
      }
    } catch (e) {
      console.warn("Unexpected database error for notifications. Using fallback.", e);
      setNotifications(getLocalNotifications());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshNotifications();
  }, [user]);

  // Handle countdown exam date reminders dynamically
  useEffect(() => {
    const savedName = localStorage.getItem("heading_nextCheckName") || "";
    const savedDate = localStorage.getItem("heading_nextCheckDate") || "";
    const savedTime = localStorage.getItem("heading_nextCheckTime") || "09:00";

    if (savedDate) {
      const targetDate = new Date(`${savedDate}T${savedTime}:00`);
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days >= 0) {
        const title = `Countdown: ${savedName || "Aviation Exam"}`;
        const body = `Your check flight exam is in ${days === 0 ? "today" : `${days} days`}. Stay sharp, keep training!`;
        
        // Find if we already have an active countdown notification to avoid spamming
        const exists = notifications.some(n => n.type === "countdown" && n.title === title && n.body === body);
        if (!exists) {
          addNotification(title, body, "countdown");
        }
      }
    }
  }, [notifications.length]);

  const addNotification = async (
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
        body,
        type,
        user_id: user.uid,
        read: false,
      });

      if (error) {
        // Fallback to local
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
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
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
  };

  const markAllAsRead = async () => {
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
  };

  const deleteNotification = async (id: string) => {
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
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
