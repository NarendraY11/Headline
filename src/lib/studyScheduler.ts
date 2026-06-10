// =====================================================================
// AI Study Scheduler — client repository layer (Phase M1)
//
// Thin, typed data-access over Supabase for study_plans / study_missions.
// Reads + user-owned writes go directly through RLS (no API round-trip);
// service-role operations (plan generation, materialize) live in /api.
//
// NOTE: this is the data foundation only. No UI consumes these yet — the
// scheduler ships behind the `aiStudyScheduler` flag (OFF by default).
// =====================================================================

import { supabase } from "./supabase";
import { trackMissionCompleted } from "./studyAnalytics.js";
import type {
  MissionStatus,
  StudyMissionRow,
  StudyPlanRow,
} from "../types/studyScheduler";

/** The single active plan for a user (partial-unique guarantees ≤ 1), or null. */
export async function getActiveStudyPlan(userId: string): Promise<StudyPlanRow | null> {
  const { data, error } = await supabase
    .from("study_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  // FIX #15: previously returned null on error, hiding DB failures from callers.
  // Now throws so the hook's catch block can surface an error to the UI.
  if (error) throw new Error(`getActiveStudyPlan: ${error.message}`);
  return (data as StudyPlanRow) ?? null;
}

/** Missions scheduled for a single calendar day, ordered for display. */
export async function getMissionsForDate(
  userId: string,
  dateISO: string
): Promise<StudyMissionRow[]> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("scheduled_date", dateISO)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  // FIX #15: throw on DB error so the hook's catch block surfaces it.
  if (error) throw new Error(`getMissionsForDate: ${error.message}`);
  return (data as StudyMissionRow[]) ?? [];
}

/** Missions across a date range (inclusive) — calendar / Flight Schedule view. */
export async function getMissionsInRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<StudyMissionRow[]> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", startISO)
    .lte("scheduled_date", endISO)
    .order("scheduled_date", { ascending: true })
    .order("position", { ascending: true });
  // FIX #15: throw on DB error.
  if (error) throw new Error(`getMissionsInRange: ${error.message}`);
  return (data as StudyMissionRow[]) ?? [];
}

/** Flip mission status (pending → in_progress → completed/skipped). */
export async function updateMissionStatus(
  missionId: string,
  status: MissionStatus
): Promise<boolean> {
  const { error } = await supabase
    .from("study_missions")
    .update({ status })
    .eq("id", missionId);
  // FIX #15: throw on DB error so callers (launchMission) can log the failure.
  if (error) throw new Error(`updateMissionStatus: ${error.message}`);
  return true;
}

export async function completeMission(
  missionId: string,
  attemptId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("study_missions")
    .update({ status: "completed", completed_attempt_id: attemptId })
    .eq("id", missionId);
  // FIX #15: throw on DB error so QuizView can log and surface the failure.
  if (error) throw new Error(`completeMission: ${error.message}`);
  trackMissionCompleted(missionId, undefined, attemptId);
  return true;
}

// FIX #18: addManualMission, getMissionById, countPlanMissionsForDate removed —
// confirmed zero consumers outside this file across all of src/ and api/.
// Restore from git history if "Add to Schedule" manual-mission UI is built.
