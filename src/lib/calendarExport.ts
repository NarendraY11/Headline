// =====================================================================
// M13: Calendar Export — pure client-side, no API calls
//
// generateICS      — build RFC 5545 .ics string from study missions
// downloadICS      — trigger browser download
// getGoogleUrl     — Google Calendar "add event" deep-link
// getOutlookUrl    — Outlook.com "add event" deep-link
// getAppleICS      — same as downloadICS (iOS/macOS opens .ics natively)
// =====================================================================

import type { StudyMissionRow } from "../types/studyScheduler.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function icsDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}`;
}

function icsDateAllDay(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const TYPE_LABEL: Record<string, string> = {
  drill: "Drill Session",
  review: "Review",
  viva: "Viva Practice",
  flashcard: "Flashcards",
  mini_test: "Mini Test",
  mock: "Mock Exam",
  read: "Reading",
};

function missionToEvent(
  mission: StudyMissionRow,
  uid: string,
  startHour = 9
): string {
  const subject = (mission.payload as any)?.subject ?? "Study";
  const typeLabel = TYPE_LABEL[mission.type] ?? mission.type;
  const summary = escapeICS(`${typeLabel} — ${subject}`);
  const description = escapeICS(
    `Type: ${typeLabel}\nSubject: ${subject}\nEstimated: ${mission.estimated_min ?? 30}min\n\nScheduled by Heading study plan.`
  );

  const dateStr = mission.scheduled_date; // "YYYY-MM-DD"
  const dtStart = `${icsDateAllDay(dateStr)}T${String(startHour).padStart(2, "0")}0000`;
  const durationMin = mission.estimated_min ?? 30;
  const endDate = new Date(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00`);
  endDate.setMinutes(endDate.getMinutes() + durationMin);
  const dtEnd = icsDate(endDate);

  return [
    "BEGIN:VEVENT",
    `UID:${uid}-${mission.id}`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ].join("\r\n");
}

// ── generateICS ───────────────────────────────────────────────────────────────

export function generateICS(
  missions: StudyMissionRow[],
  planTitle = "Heading Study Plan",
  userUid = "heading"
): string {
  const events = missions.map((m, i) => missionToEvent(m, userUid, 9 + (i % 3)));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Heading//Study Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(planTitle)}`,
    "X-WR-CALDESC:Exported from Heading pilot exam prep",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

// ── downloadICS ───────────────────────────────────────────────────────────────

export function downloadICS(icsContent: string, filename = "study-plan.ics"): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Google Calendar deep-link ─────────────────────────────────────────────────

export function getGoogleCalendarUrl(mission: StudyMissionRow): string {
  const subject = (mission.payload as any)?.subject ?? "Study";
  const typeLabel = TYPE_LABEL[mission.type] ?? mission.type;
  const title = encodeURIComponent(`${typeLabel} — ${subject}`);
  const details = encodeURIComponent(
    `${typeLabel} session for ${subject}. Estimated: ${mission.estimated_min ?? 30}min.`
  );
  const dateStr = mission.scheduled_date.replace(/-/g, "");
  const dates = `${dateStr}T090000/${dateStr}T${String(9 + Math.floor((mission.estimated_min ?? 30) / 60)).padStart(2, "0")}${String((mission.estimated_min ?? 30) % 60).padStart(2, "0")}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

// ── Outlook Calendar deep-link ────────────────────────────────────────────────

export function getOutlookCalendarUrl(mission: StudyMissionRow): string {
  const subject = (mission.payload as any)?.subject ?? "Study";
  const typeLabel = TYPE_LABEL[mission.type] ?? mission.type;
  const title = encodeURIComponent(`${typeLabel} — ${subject}`);
  const body = encodeURIComponent(
    `${typeLabel} session for ${subject}. Estimated: ${mission.estimated_min ?? 30}min.`
  );
  const startDate = `${mission.scheduled_date}T09:00:00`;
  const endDate = new Date(`${mission.scheduled_date}T09:00:00`);
  endDate.setMinutes(endDate.getMinutes() + (mission.estimated_min ?? 30));
  const endStr = endDate.toISOString().slice(0, 19);
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${body}&startdt=${startDate}&enddt=${endStr}`;
}

// ── Single-mission ICS (for Apple Calendar / generic) ────────────────────────

export function downloadSingleMissionICS(mission: StudyMissionRow, userUid = "heading"): void {
  const subject = (mission.payload as any)?.subject ?? "Study";
  const typeLabel = TYPE_LABEL[mission.type] ?? mission.type;
  const content = generateICS([mission], `${typeLabel} — ${subject}`, userUid);
  downloadICS(content, `${typeLabel.toLowerCase().replace(/\s+/g, "-")}.ics`);
}
