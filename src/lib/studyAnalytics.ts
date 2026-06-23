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

// ── Phase 6 Mission Engine events ─────────────────────────────────────────────
// Shared payload shape per spec: { primaryTrack, careerObjective, missionType,
// subject, accuracy }. Not session-deduped per-id beyond what the caller needs;
// created/abandoned are deduped by mission id, resumed is allowed to re-fire.

export interface MissionEventContext {
  primaryTrack?: string | null;
  careerObjective?: string | null;
  missionType?: string | null;
  subject?: string | null;
  accuracy?: number | null;
}

export function trackMissionCreated(missionId: string, ctx: MissionEventContext) {
  if (!once(`mission_created_${missionId}`)) return;
  posthogCapture("mission_created", { mission_id: missionId, ...ctx });
}

export function trackMissionResumed(missionId: string, ctx: MissionEventContext) {
  posthogCapture("mission_resumed", { mission_id: missionId, ...ctx });
}

export function trackMissionAbandoned(missionId: string, ctx: MissionEventContext) {
  if (!once(`mission_abandoned_${missionId}`)) return;
  posthogCapture("mission_abandoned", { mission_id: missionId, ...ctx });
}

export function trackCalendarOpened() {
  if (!once("calendar_opened_session")) return;
  posthogCapture("calendar_opened");
}

export function trackScheduleRegenerated(oldPlanId: string | null, newPlanId: string) {
  posthogCapture("schedule_regenerated", { old_plan_id: oldPlanId, new_plan_id: newPlanId });
}

export function trackReadinessImproved(
  oldBand: string,
  newBand: string,
  score: number,
  components: { mastery: number; coverage: number; consistency: number; recency: number }
) {
  posthogCapture("readiness_improved", {
    old_band: oldBand,
    new_band: newBand,
    score,
    component_mastery:     Math.round(components.mastery * 100),
    component_coverage:    Math.round(components.coverage * 100),
    component_consistency: Math.round(components.consistency * 100),
    component_recency:     Math.round(components.recency * 100),
  });
}

export function trackPlanRebalanced(payload: {
  planId: string;
  trigger: "mastery_drift" | "recovery" | "staleness" | "new_critical" | "manual";
  subjectsImproved: string[];
  subjectsRegressed: string[];
  oldWeakCount: number;
  newWeakCount: number;
  daysSinceLastRegen: number;
  regenCount: number;
}) {
  posthogCapture("plan_rebalanced", {
    plan_id:              payload.planId,
    trigger:              payload.trigger,
    subjects_improved:    payload.subjectsImproved,
    subjects_regressed:   payload.subjectsRegressed,
    old_weak_count:       payload.oldWeakCount,
    new_weak_count:       payload.newWeakCount,
    days_since_last_regen: payload.daysSinceLastRegen,
    regen_count:          payload.regenCount,
  });
}
