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
import type {
  MissionStatus,
  NewManualMission,
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
  if (error) {
    console.warn("getActiveStudyPlan failed:", error.message);
    return null;
  }
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
  if (error) {
    console.warn("getMissionsForDate failed:", error.message);
    return [];
  }
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
  if (error) {
    console.warn("getMissionsInRange failed:", error.message);
    return [];
  }
  return (data as StudyMissionRow[]) ?? [];
}

/** "Add to Schedule": insert a user-owned manual mission (RLS-checked). */
export async function addManualMission(
  input: NewManualMission
): Promise<StudyMissionRow | null> {
  const { data, error } = await supabase
    .from("study_missions")
    .insert({
      user_id: input.userId,
      plan_id: null,
      scheduled_date: input.scheduledDate,
      type: input.type,
      payload: input.payload,
      estimated_min: input.estimatedMin ?? 0,
      position: input.position ?? 0,
      status: "pending",
      source: "manual",
    })
    .select("*")
    .single();
  if (error) {
    console.warn("addManualMission failed:", error.message);
    return null;
  }
  return data as StudyMissionRow;
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
  if (error) {
    console.warn("updateMissionStatus failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Mark a mission complete and link the proof-of-work attempt. The DB trigger
 * verifies the attempt is the caller's own and stamps completed_at.
 */
export async function completeMission(
  missionId: string,
  attemptId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("study_missions")
    .update({ status: "completed", completed_attempt_id: attemptId })
    .eq("id", missionId);
  if (error) {
    console.warn("completeMission failed:", error.message);
    return false;
  }
  return true;
}

/** Fetch a single mission by id (used by M5 launch + completion flow). */
export async function getMissionById(
  missionId: string
): Promise<StudyMissionRow | null> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("id", missionId)
    .maybeSingle();
  if (error) {
    console.warn("getMissionById failed:", error.message);
    return null;
  }
  return (data as StudyMissionRow) ?? null;
}

/**
 * Count plan-source missions for a calendar day without fetching rows.
 * Used by the service layer to decide whether to trigger materialization.
 */
export async function countPlanMissionsForDate(
  userId: string,
  dateISO: string
): Promise<number> {
  const { count, error } = await supabase
    .from("study_missions")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("scheduled_date", dateISO)
    .eq("source", "plan");
  if (error) {
    console.warn("countPlanMissionsForDate failed:", error.message);
    return 0;
  }
  return count ?? 0;
}
