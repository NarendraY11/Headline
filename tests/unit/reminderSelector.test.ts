import { describe, it, expect } from "vitest";
import { selectReminder, REMINDER_TYPES_BY_PRIORITY, type ReminderInputs } from "../../src/lib/reminderSelector";
import { formatReminderPush } from "../../src/lib/reminderPush";

const NOW = Date.UTC(2026, 5, 25, 12, 0, 0); // fixed clock for determinism

// Minimal baseline: nothing triggers.
function base(): ReminderInputs {
  return {
    mission: null,
    completedToday: false,
    missionStreak: 0,
    xpRank: null,
    dueCount: 0,
    nextExam: null,
    nowMs: NOW,
  };
}

function hoursAgoISO(h: number): string {
  return new Date(NOW - h * 3600000).toISOString();
}

describe("selectReminder — priority + gates", () => {
  it("returns null when nothing qualifies", () => {
    expect(selectReminder(base())).toBeNull();
  });

  it("completedToday hard-suppresses everything", () => {
    const inputs = {
      ...base(),
      completedToday: true,
      mission: { status: "in_progress", startedAt: hoursAgoISO(72), title: "Nav" },
      missionStreak: 5,
      dueCount: 100,
    };
    expect(selectReminder(inputs)).toBeNull();
  });

  it("P1 stale_mission wins over streak + review", () => {
    const inputs = {
      ...base(),
      mission: { status: "in_progress", startedAt: hoursAgoISO(72), title: "Air Nav" },
      missionStreak: 3,
      dueCount: 100,
    };
    const r = selectReminder(inputs);
    expect(r?.type).toBe("stale_mission");
    expect(r?.body).toContain("3 days");
    expect(r?.priority).toBe(1);
  });

  it("stale needs >=48h — 47h in_progress does not fire stale", () => {
    const inputs = {
      ...base(),
      mission: { status: "in_progress", startedAt: hoursAgoISO(47), title: "Nav" },
      missionStreak: 2,
    };
    expect(selectReminder(inputs)?.type).toBe("streak_risk"); // falls to P2
  });

  it("P2 streak_risk wins over rank + review", () => {
    const inputs = {
      ...base(),
      missionStreak: 4,
      xpRank: { isMax: false, xpRemaining: 30, nextName: "Solo Endorsed" },
      dueCount: 80,
    };
    const r = selectReminder(inputs);
    expect(r?.type).toBe("streak_risk");
    expect(r?.title).toBe("4-Day Streak at Risk");
  });

  it("P3 rank_proximity wins over review (<=100 XP)", () => {
    const inputs = {
      ...base(),
      xpRank: { isMax: false, xpRemaining: 50, nextName: "PPL Rated" },
      dueCount: 80,
    };
    const r = selectReminder(inputs);
    expect(r?.type).toBe("rank_proximity");
    expect(r?.title).toBe("50 XP from PPL Rated");
  });

  it("rank needs <=100 XP — 101 remaining does not fire rank", () => {
    const inputs = {
      ...base(),
      xpRank: { isMax: false, xpRemaining: 101, nextName: "PPL Rated" },
      dueCount: 80,
    };
    expect(selectReminder(inputs)?.type).toBe("review_overload"); // falls to P4
  });

  it("isMax rank never fires rank_proximity", () => {
    const inputs = { ...base(), xpRank: { isMax: true, xpRemaining: 0, nextName: null } };
    expect(selectReminder(inputs)).toBeNull();
  });

  it("P4 review_overload at >=50 due", () => {
    expect(selectReminder({ ...base(), dueCount: 50 })?.type).toBe("review_overload");
    expect(selectReminder({ ...base(), dueCount: 49 })).toBeNull();
  });

  it("P5 exam_countdown only within 7 days", () => {
    const in5 = new Date(NOW + 5 * 86400000).toISOString();
    const in8 = new Date(NOW + 8 * 86400000).toISOString();
    expect(selectReminder({ ...base(), nextExam: in5 })?.type).toBe("exam_countdown");
    expect(selectReminder({ ...base(), nextExam: in8 })).toBeNull();
  });
});

describe("selectReminder — muted types (push prefs)", () => {
  it("muting the winning type surfaces the next priority", () => {
    const inputs = {
      ...base(),
      missionStreak: 3,                                        // P2 would win
      xpRank: { isMax: false, xpRemaining: 40, nextName: "X" }, // P3 fallback
    };
    expect(selectReminder(inputs)?.type).toBe("streak_risk");
    const muted = new Set(["streak_risk" as const]);
    expect(selectReminder(inputs, { mutedTypes: muted })?.type).toBe("rank_proximity");
  });

  it("muting all qualifying types returns null", () => {
    const inputs = { ...base(), missionStreak: 2, dueCount: 99 };
    const muted = new Set(["streak_risk" as const, "review_overload" as const]);
    expect(selectReminder(inputs, { mutedTypes: muted })).toBeNull();
  });

  it("priority array order is the canonical order", () => {
    expect([...REMINDER_TYPES_BY_PRIORITY]).toEqual([
      "stale_mission", "streak_risk", "rank_proximity", "review_overload", "exam_countdown",
    ]);
  });
});

describe("formatReminderPush", () => {
  it("carries selector copy verbatim + maps category/tag/ttl", () => {
    const r = selectReminder({ ...base(), missionStreak: 2 })!;
    const p = formatReminderPush(r);
    expect(p.title).toBe(r.title);
    expect(p.body).toBe(r.body);
    expect(p.type).toBe("streak");
    expect(p.tag).toBe("heading-reminder-streak_risk");
    expect(p.ttl).toBe(8 * 3600);
    expect(p.url).toBe("/today");
  });

  it("uses reminder href as click URL when present (review_overload)", () => {
    const r = selectReminder({ ...base(), dueCount: 60 })!;
    const p = formatReminderPush(r);
    expect(r.type).toBe("review_overload");
    expect(p.url).toBe("/quiz/review");
    expect(p.type).toBe("reminder");
  });
});
