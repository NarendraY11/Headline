// Shared pure helpers for the Study Calendar.
// No React, no Supabase — fully unit-testable.

import type { MissionStatus, StudyMissionRow } from "../../../types/studyScheduler";
import type { ReactNode } from "react";

export type CalendarView = "monthly" | "weekly" | "agenda";

export interface TypeMeta {
  label: string;
  icon: ReactNode;
  dot: string;
  chip: string;
}

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
export const DAY_ABBREV = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Use local date parts to avoid UTC offset shifting the day.
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return isoDate(new Date());
}

export function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function isOverdue(dateISO: string): boolean {
  return dateISO < todayISO();
}

export function missionTitle(m: StudyMissionRow): string {
  const subjectId = m.payload?.subjectId;
  if (subjectId) return subjectId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const title = (m.payload as unknown as Record<string, unknown>)?.title;
  return typeof title === "string"
    ? title
    : m.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupByDate(missions: StudyMissionRow[]): Map<string, StudyMissionRow[]> {
  const map = new Map<string, StudyMissionRow[]>();
  for (const m of missions) {
    const arr = map.get(m.scheduled_date) ?? [];
    arr.push(m);
    map.set(m.scheduled_date, arr);
  }
  return map;
}

export function completionPct(missions: StudyMissionRow[]): number {
  if (!missions.length) return 0;
  const done = missions.filter((m) => m.status === "completed").length;
  return Math.round((done / missions.length) * 100);
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  return {
    start: isoDate(new Date(year, month, 1)),
    end: isoDate(new Date(year, month + 1, 0)),
  };
}

export function weekRange(anchor: Date): { start: string; end: string } {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  const start = isoDate(d);
  d.setDate(d.getDate() + 6);
  return { start, end: isoDate(d) };
}

/** All calendar-grid days for a month (including leading/trailing to fill rows). */
export function calendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = first.getDay();
  const endOffset = 6 - last.getDay();
  const days: Date[] = [];
  for (let i = -startOffset; i <= last.getDate() - 1 + endOffset; i++) {
    days.push(new Date(year, month, 1 + i));
  }
  return days;
}

/** 7-day strip starting Sunday of the week containing anchor. */
export function weekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  return Array.from(
    { length: 7 },
    (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i),
  );
}

export const STATUS_CONFIG: Record<MissionStatus, { cls: string; label: string }> = {
  pending:     { cls: "bg-rule-strong",                      label: "Pending"     },
  in_progress: { cls: "bg-amber motion-safe:animate-pulse",  label: "In progress" },
  completed:   { cls: "bg-mint",                             label: "Completed"   },
  skipped:     { cls: "bg-muted-2",                          label: "Skipped"     },
};
