// =====================================================================
// Phase 8.2A — useEngineReminders: in-app reminder hook
// Phase 8.2B.1 — refactored to consume the shared pure selector.
//
// This hook is now thin: it does data gathering, loading stabilization, and
// dismissal state, then delegates the "which reminder?" decision to the shared
// selectReminder() brain (src/lib/reminderSelector.ts) — the same function the
// future push cron will use, so in-app and push never diverge.
//
// In-app Flight Alerts always show the highest-priority reminder (no mute) —
// the per-type prefs are a PUSH concern (8.2B.2), not in-app.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMissionStreak } from "./useMissionStreak";
import { selectReminder, type EngineReminder } from "../lib/reminderSelector";
import type { RankProgress } from "../lib/xpValues";
import type { StudyMissionRow } from "../types/studyScheduler";

// Re-export so existing consumers (FlightAlerts) keep importing from here.
export type { EngineReminder, EngineReminderType } from "../lib/reminderSelector";

export interface UseEngineRemindersInput {
  /** Passed from TodayView — already computed via useXp, no duplicate query. */
  xpRank: RankProgress;
  xpSystemEnabled: boolean;
  /** Passed from TodayView — already fetched via getDueQuestionIds. */
  dueCount: number;
  /** userData.nextExam — login-time but exam date is stable intraday. */
  nextExam?: string | null;
  /**
   * Phase 9.3: pre-resolved mission state from TodayView's single
   * useActiveMission() call. FlightAlerts should be a pure consumer.
   */
  mission?: StudyMissionRow | null;
  completedToday?: StudyMissionRow | null;
  missionLoading?: boolean;
}

// ── Suppression model (UI-only: dismissed-today) ──────────────────────────────
// Key: "heading_engine_alert"  Shape: { "YYYY-MM-DD": { dismissed: true } }
// Auto-prunes entries older than 7 days on write.

const STORAGE_KEY = "heading_engine_alert";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDismissedToday(): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return stored[todayISO()]?.dismissed === true;
  } catch { return false; }
}

function writeDismissed(): void {
  try {
    const today = todayISO();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    for (const key of Object.keys(stored)) {
      if (key < cutoffStr) delete stored[key];
    }
    stored[today] = { dismissed: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEngineReminders({
  xpRank,
  xpSystemEnabled,
  dueCount,
  nextExam,
  mission,
  completedToday,
  missionLoading = false,
}: UseEngineRemindersInput): { reminder: EngineReminder | null; loading: boolean; dismiss: () => void } {
  const { streak: missionStreak, loading: streakLoading } = useMissionStreak();
  const [dismissed, setDismissed] = useState(() => isDismissedToday());

  // Phase 8.2A.1: unstable while async inputs feeding the top priorities load.
  const loading = missionLoading || streakLoading;

  // Re-sync dismissed state when the date rolls over in a long-running session.
  useEffect(() => {
    setDismissed(isDismissedToday());
  }, [todayISO()]);

  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  const reminder = useMemo((): EngineReminder | null => {
    // UI-only gates (not in the shared selector): loading + dismissed-today.
    if (loading) return null;
    if (dismissed) return null;

    // Delegate the decision to the shared brain. In-app passes no muted set —
    // Flight Alerts always show the highest-priority reminder.
    return selectReminder({
      mission: mission
        ? {
            status: mission.status,
            startedAt: (mission.payload?.startedAt as string | undefined) ?? null,
            title: (mission.payload?.title as string | undefined) ?? null,
          }
        : null,
      completedToday: completedToday !== null,
      missionStreak,
      xpRank: xpSystemEnabled
        ? { isMax: xpRank.isMax, xpRemaining: xpRank.xpRemaining, nextName: xpRank.next?.name ?? null }
        : null,
      dueCount,
      nextExam,
      nowMs: Date.now(),
    });
  }, [loading, dismissed, mission, completedToday, missionStreak, xpRank, xpSystemEnabled, dueCount, nextExam]);

  return { reminder, loading, dismiss };
}
