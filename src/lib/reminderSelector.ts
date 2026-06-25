// =====================================================================
// Phase 8.2B.1 — reminderSelector: the single reminder brain (pure)
//
// One source of truth for "which reminder should this user receive?".
// Shared by:
//   - in-app Flight Alerts (useEngineReminders)
//   - future scheduled push reminders (8.2B.2 cron / Edge Function)
//
// PURE: no React, no supabase, no Date.now() in the cascade except via the
// injected `nowMs` so it stays deterministic and server-reusable. Inputs are
// plain normalized data — the caller (hook or cron) does the gathering.
//
// Suppression rules that apply to BOTH channels live here (completedToday,
// muted-type prefs). UI-only gates (loading, dismissed-today) stay in the hook.
// =====================================================================

export type EngineReminderType =
  | "stale_mission"
  | "streak_risk"
  | "rank_proximity"
  | "review_overload"
  | "exam_countdown";

/** All reminder types, in priority order (index 0 = highest priority). */
export const REMINDER_TYPES_BY_PRIORITY: readonly EngineReminderType[] = [
  "stale_mission",
  "streak_risk",
  "rank_proximity",
  "review_overload",
  "exam_countdown",
] as const;

export interface EngineReminder {
  type: EngineReminderType;
  /** 1-based priority (1 = highest). Mirrors REMINDER_TYPES_BY_PRIORITY order. */
  priority: number;
  title: string;
  body: string;
  icon: "clock" | "flame" | "zap" | "alert-circle" | "target";
  /** Optional deep-link for the alert / push click action. */
  href?: string;
}

/** Normalized, plain-data inputs — no React/supabase types. */
export interface ReminderInputs {
  /** Active engine mission, normalized. null when none. */
  mission: { status: string; startedAt?: string | null; title?: string | null } | null;
  /** True when the user completed a system mission today. Hard suppression gate. */
  completedToday: boolean;
  /** Engine mission streak (consecutive completion days, ending today/yesterday). */
  missionStreak: number;
  /** XP rank proximity, normalized. null when xpSystem off / no data. */
  xpRank: { isMax: boolean; xpRemaining: number; nextName: string | null } | null;
  /** Spaced-review questions currently due. */
  dueCount: number;
  /** Exam date ISO (login-time value is fine — exam date is stable intraday). */
  nextExam?: string | null;
  /** Current epoch ms. Injected for determinism + server reuse. */
  nowMs: number;
}

export interface SelectReminderOptions {
  /**
   * Reminder types the user has muted (opt-out). A muted type is skipped in the
   * cascade and a lower-priority reminder may surface instead. In-app Flight
   * Alerts pass nothing (always show highest). Push passes the user's DB prefs.
   */
  mutedTypes?: ReadonlySet<EngineReminderType>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function hoursSince(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 3600000));
}

function daysUntil(dateStr: string | null | undefined, nowMs: number): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (!isFinite(t)) return null;
  return Math.ceil((t - nowMs) / 86400000);
}

const PRIORITY = (t: EngineReminderType): number =>
  REMINDER_TYPES_BY_PRIORITY.indexOf(t) + 1;

// ── Selector ──────────────────────────────────────────────────────────────────

/**
 * Pure: pick the single highest-priority reminder for a user, or null.
 * Priority: stale_mission > streak_risk > rank_proximity > review_overload >
 * exam_countdown. A muted type is skipped (next priority may win).
 *
 * Hard gate: completedToday → always null (user trained today; no nudge).
 */
export function selectReminder(
  inputs: ReminderInputs,
  opts: SelectReminderOptions = {}
): EngineReminder | null {
  // Hard suppression: trained today → no reminder on any channel.
  if (inputs.completedToday) return null;

  const muted = opts.mutedTypes ?? new Set<EngineReminderType>();
  const allowed = (t: EngineReminderType): boolean => !muted.has(t);

  const { mission, missionStreak, xpRank, dueCount, nextExam, nowMs } = inputs;

  // ── P1: stale active mission (in_progress, untouched ≥48h) ────────────────
  if (allowed("stale_mission") && mission && mission.status === "in_progress") {
    const h = hoursSince(mission.startedAt, nowMs);
    if (h >= 48) {
      const d = Math.floor(h / 24);
      const title = mission.title ?? "Your mission";
      return {
        type: "stale_mission",
        priority: PRIORITY("stale_mission"),
        title: "Training Paused",
        body: `${title} has been waiting ${d} day${d !== 1 ? "s" : ""}. Resume now.`,
        icon: "clock",
      };
    }
  }

  // ── P2: mission streak at risk (streak alive, today not done) ─────────────
  if (allowed("streak_risk") && missionStreak >= 1) {
    return {
      type: "streak_risk",
      priority: PRIORITY("streak_risk"),
      title: `${missionStreak}-Day Streak at Risk`,
      body: "Complete today's mission to keep your streak alive.",
      icon: "flame",
    };
  }

  // ── P3: rank proximity (≤100 XP from next rank) ───────────────────────────
  if (allowed("rank_proximity") && xpRank && !xpRank.isMax && xpRank.xpRemaining <= 100) {
    return {
      type: "rank_proximity",
      priority: PRIORITY("rank_proximity"),
      title: `${xpRank.xpRemaining} XP from ${xpRank.nextName}`,
      body: "Complete today's mission to advance your rank.",
      icon: "zap",
    };
  }

  // ── P4: review overload (≥50 due) ─────────────────────────────────────────
  if (allowed("review_overload") && dueCount >= 50) {
    return {
      type: "review_overload",
      priority: PRIORITY("review_overload"),
      title: `${dueCount} Questions Overdue`,
      body: "Your review queue is building up. A quick drill clears it.",
      icon: "alert-circle",
      href: "/quiz/review",
    };
  }

  // ── P5: exam countdown (≤7 days) ──────────────────────────────────────────
  const examDays = daysUntil(nextExam, nowMs);
  if (allowed("exam_countdown") && examDays !== null && examDays > 0 && examDays <= 7) {
    return {
      type: "exam_countdown",
      priority: PRIORITY("exam_countdown"),
      title: `${examDays} Day${examDays !== 1 ? "s" : ""} to Exam`,
      body: examDays <= 3
        ? "Final approach — review weak subjects and take a mock today."
        : "Keep your prep on track. Check your readiness score.",
      icon: "target",
    };
  }

  return null;
}
