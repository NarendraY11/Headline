// M13: useStudyReminders — fires in-app reminders for missions, streak, exam countdown
// Runs once per session; uses localStorage to prevent duplicate fires per day.

import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import { useNotifications } from "../contexts/NotificationContext";
import { useTodayMissions } from "./useStudyMissions";

const STORAGE_KEY = "heading_reminder_fired";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firedToday(type: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return stored[todayKey()]?.[type] === true;
  } catch { return false; }
}

function markFired(type: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const today = todayKey();
    stored[today] = { ...(stored[today] ?? {}), [type]: true };
    // Prune keys older than 7 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    for (const key of Object.keys(stored)) {
      if (key < todayKey()) delete stored[key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

export function useStudyReminders(): void {
  const enabled = useFeature("pushNotifications");
  const { user, userData } = useAuth();
  const { addNotification } = useNotifications();
  const { missions } = useTodayMissions();

  useEffect(() => {
    if (!enabled || !user) return;

    const hour = new Date().getHours();
    if (hour < 7 || hour > 22) return; // quiet hours

    // 1. Mission reminder — has missions today but none completed
    if (!firedToday("mission") && missions.length > 0) {
      const pending = missions.filter(m => m.status !== "completed");
      if (pending.length > 0) {
        markFired("mission");
        void addNotification(
          "Study session ready ✈️",
          `${pending.length} mission${pending.length > 1 ? "s" : ""} on today's flight plan. Tap to begin.`,
          "reminder"
        );
      }
    }

    // 2. Streak reminder — studied yesterday but not today
    if (!firedToday("streak") && hour >= 18) {
      const lastActivity = userData?.lastActivityDate ?? "";
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      if (lastActivity === yStr) {
        markFired("streak");
        const streak = userData?.streakCount ?? 0;
        void addNotification(
          `Protect your ${streak}-day streak 🔥`,
          "You studied yesterday — one session today keeps the chain alive.",
          "reminder"
        );
      }
    }

    // 3. Exam countdown — within 30 days
    if (!firedToday("exam")) {
      const examDate = userData?.nextExam ?? "";
      if (examDate) {
        const diff = Math.ceil(
          (new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (diff > 0 && diff <= 30) {
          markFired("exam");
          void addNotification(
            `${diff} day${diff !== 1 ? "s" : ""} to exam ✈`,
            diff <= 7
              ? "Final approach — review weak subjects and take a full mock today."
              : "Keep your prep on track. Check your readiness score.",
            "countdown"
          );
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id, missions.length]);
}
