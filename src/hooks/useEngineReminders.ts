// =====================================================================
// Phase 8.2A — useEngineReminders: unified in-app reminder engine
//
// Single source of truth for all Today alert signals. Replaces:
//   - the inline daily reminder useEffect in TodayView (fragmented)
//   - useStudyReminders (used wrong signal source: scheduler plan missions)
//
// Architecture:
//   - evaluates engine-owned signals only (mission, streak, xp, review, exam)
//   - strictly EXCLUDED: lastActivityDate, questionsAnsweredToday (stale at
//     login), useTodayMissions / scheduler plan signals
//   - returns exactly ONE highest-priority reminder or null
//   - suppression: completedToday → null (pure state); user dismiss → null for
//     rest of day (localStorage, self-pruning)
//   - state-driven not time-driven: shows whenever condition is true (caller
//     decides visibility). Push reminders (Phase 8.2B) will add time-gating.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveMission } from "./useActiveMission";
import { useMissionStreak } from "./useMissionStreak";
import type { RankProgress } from "../lib/xpValues";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngineReminderType =
  | "stale_mission"
  | "streak_risk"
  | "rank_proximity"
  | "review_overload"
  | "exam_countdown";

export interface EngineReminder {
  type: EngineReminderType;
  title: string;
  body: string;
  icon: "clock" | "flame" | "zap" | "alert-circle" | "target";
  /** Optional deep-link for the alert CTA */
  href?: string;
}

export interface UseEngineRemindersInput {
  /** Passed from TodayView — already computed via useXp, no duplicate query. */
  xpRank: RankProgress;
  xpSystemEnabled: boolean;
  /** Passed from TodayView — already fetched via getDueQuestionIds. */
  dueCount: number;
  /**
   * userData.nextExam — login-time value but exam date is stable intraday.
   * Acceptable for exam countdown (≤7 days). Never used for "studied today" logic.
   */
  nextExam?: string | null;
}

// ── Suppression model ─────────────────────────────────────────────────────────
// Key: "heading_engine_alert"
// Shape: { "YYYY-MM-DD": { dismissed: true } }
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
    // Prune old entries
    for (const key of Object.keys(stored)) {
      if (key < cutoffStr) delete stored[key];
    }
    stored[today] = { dismissed: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursAgo(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return isFinite(diff) ? diff : null;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useEngineReminders({
  xpRank,
  xpSystemEnabled,
  dueCount,
  nextExam,
}: UseEngineRemindersInput): { reminder: EngineReminder | null; dismiss: () => void } {
  const { mission, completedToday } = useActiveMission();
  const { streak: missionStreak } = useMissionStreak();
  const [dismissed, setDismissed] = useState(() => isDismissedToday());

  // Re-sync dismissed state when date rolls over in a long-running session
  useEffect(() => {
    setDismissed(isDismissedToday());
  }, [todayISO()]);  // re-runs when the date string changes

  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  const reminder = useMemo((): EngineReminder | null => {
    // Hardest gate first: user already completed a mission today — no alert.
    if (completedToday !== null) return null;
    // User explicitly dismissed the alert today — respect it.
    if (dismissed) return null;

    // ── Priority 1: stale active mission ──────────────────────────────────
    // A mission that has been in_progress for 2+ days with no completion.
    // Most urgent: user started something and walked away.
    if (mission && mission.status === "in_progress") {
      const h = hoursAgo(mission.payload?.startedAt as string | undefined);
      if (h >= 48) {
        const d = Math.floor(h / 24);
        const missionTitle = mission.payload?.title as string | undefined ?? "Your mission";
        return {
          type: "stale_mission",
          title: "Training Paused",
          body: `${missionTitle} has been waiting ${d} day${d !== 1 ? "s" : ""}. Resume now.`,
          icon: "clock",
        };
      }
    }

    // ── Priority 2: mission streak at risk ────────────────────────────────
    // missionStreak >= 1 means last completion was today OR yesterday.
    // !completedToday (checked above) means today isn't done yet.
    // So missionStreak >= 1 here ⇒ streak alive but at risk of breaking today.
    if (missionStreak >= 1) {
      return {
        type: "streak_risk",
        title: `${missionStreak}-Day Streak at Risk`,
        body: "Complete today's mission to keep your streak alive.",
        icon: "flame",
      };
    }

    // ── Priority 3: rank proximity ─────────────────────────────────────────
    // Within 100 XP of next rank — one mission away.
    if (xpSystemEnabled && !xpRank.isMax && xpRank.xpRemaining <= 100) {
      return {
        type: "rank_proximity",
        title: `${xpRank.xpRemaining} XP from ${xpRank.next!.name}`,
        body: "Complete today's mission to advance your rank.",
        icon: "zap",
      };
    }

    // ── Priority 4: review overload ────────────────────────────────────────
    if (dueCount >= 50) {
      return {
        type: "review_overload",
        title: `${dueCount} Questions Overdue`,
        body: "Your review queue is building up. A quick drill clears it.",
        icon: "alert-circle",
        href: "/quiz/review",
      };
    }

    // ── Priority 5: exam countdown ─────────────────────────────────────────
    // nextExam is login-time but exam date is stable intraday — acceptable.
    const examDays = daysUntil(nextExam);
    if (examDays !== null && examDays > 0 && examDays <= 7) {
      return {
        type: "exam_countdown",
        title: `${examDays} Day${examDays !== 1 ? "s" : ""} to Exam`,
        body: examDays <= 3
          ? "Final approach — review weak subjects and take a mock today."
          : "Keep your prep on track. Check your readiness score.",
        icon: "target",
      };
    }

    return null;
  }, [mission, completedToday, missionStreak, xpRank, xpSystemEnabled, dueCount, nextExam, dismissed]);

  return { reminder, dismiss };
}
