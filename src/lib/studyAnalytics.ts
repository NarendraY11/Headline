// AI Study Scheduler — analytics event wrappers (M7)
//
// All events are deduped per session via sessionStorage to prevent double-fires
// from remounts. Entity-scoped dedup keys include the ID so distinct entities
// can each fire once.

import { posthogCapture } from "./posthog.js";

function once(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true; // storage blocked — allow event, dedup not critical
  }
}

export function trackStudyPlanGenerated(planId: string, horizonDays?: number) {
  if (!once(`study_plan_generated_${planId}`)) return;
  posthogCapture("study_plan_generated", { plan_id: planId, horizon_days: horizonDays });
}

export function trackStudyPlanViewed(planId: string) {
  if (!once(`study_plan_viewed_${planId}`)) return;
  posthogCapture("study_plan_viewed", { plan_id: planId });
}

export function trackStudyPlanMaterialized(planId: string, missionCount: number) {
  if (!once(`study_plan_materialized_${planId}`)) return;
  posthogCapture("study_plan_materialized", { plan_id: planId, mission_count: missionCount });
}

export function trackMissionStarted(missionId: string, type: string, subjectId?: string | null) {
  if (!once(`mission_started_${missionId}`)) return;
  posthogCapture("mission_started", { mission_id: missionId, mission_type: type, subject_id: subjectId });
}

export function trackMissionCompleted(missionId: string, type?: string, attemptId?: string) {
  if (!once(`mission_completed_${missionId}`)) return;
  posthogCapture("mission_completed", {
    mission_id: missionId,
    mission_type: type,
    attempt_id: attemptId,
  });
}

export function trackCalendarOpened() {
  if (!once("calendar_opened_session")) return;
  posthogCapture("calendar_opened");
}

export function trackScheduleRegenerated(oldPlanId: string | null, newPlanId: string) {
  posthogCapture("schedule_regenerated", { old_plan_id: oldPlanId, new_plan_id: newPlanId });
}
