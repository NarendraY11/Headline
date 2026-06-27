// =====================================================================
// PHASE 2 — Active Learning Context (pure core)
//
// Resolves which program / certification / aircraft a user is actively
// studying, with a backward-compatible fallback chain:
//
//   active enrollment ─► learning_profiles preferred ─► legacy target_exam
//
// Pure + synchronous so it is offline- and test-friendly. The async DB
// fetch lives in ./learningContextDb; the React hook in
// hooks/useLearningContext. Everything after Phase 2 consumes the context
// this module builds — no page is switched in Phase 2 (data only).
// =====================================================================

import {
  aircraftOf,
  familyOf,
  resolveContentId,
  resolveLearningScope,
  type CanonicalId,
  type TrackFamily,
} from "./contentRegistry";

/** Shape of an enrollments row (FKs are canonical slugs — see migration). */
export interface EnrollmentRow {
  id: string;
  user_id: string;
  program_id: string | null;
  certification_id: string;     // canonical cert slug, e.g. "dgca-cpl"
  aircraft_id: string | null;   // canonical aircraft slug, e.g. "a320"
  status: "active" | "paused" | "completed" | "archived";
  is_active: boolean;
  progress_snapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface LearningProfileRow {
  preferred_program_id?: string | null;
  preferred_certification_id?: string | null;
  preferred_aircraft_id?: string | null;
  career_objective?: string | null;
}

/** Legacy profile fields (compat mirror). */
export interface LegacyProfile {
  targetExam?: string | null;
  careerObjective?: string | null;
}

export type ContextSource = "enrollment" | "profile" | "legacy" | "none";

export interface ActiveLearningContext {
  source: ContextSource;
  enrollmentId: string | null;
  programId: string | null;
  certificationId: CanonicalId | null;
  aircraftId: string | null;
  family: TrackFamily | null;
  careerObjectiveId: CanonicalId | null;
  /** subject id scope (static today; registry-backed later) */
  subjectScope: string[];
}

const EMPTY: ActiveLearningContext = {
  source: "none",
  enrollmentId: null,
  programId: null,
  certificationId: null,
  aircraftId: null,
  family: null,
  careerObjectiveId: null,
  subjectScope: [],
};

/** Pick the active enrollment from a list (is_active wins; else null). */
export function pickActiveEnrollment(enrollments: EnrollmentRow[] | null | undefined): EnrollmentRow | null {
  if (!enrollments || enrollments.length === 0) return null;
  return enrollments.find((e) => e.is_active) ?? null;
}

/**
 * Build the active learning context from whatever data is available.
 * Pure. Fallback order: enrollment → learning profile → legacy target_exam.
 */
export function buildActiveLearningContext(input: {
  enrollment?: EnrollmentRow | null;
  profile?: LearningProfileRow | null;
  legacy?: LegacyProfile | null;
}): ActiveLearningContext {
  const { enrollment, profile, legacy } = input;

  // 1) Active enrollment — the real source of truth once Phase 2 is live.
  if (enrollment) {
    const certificationId = resolveContentId(enrollment.certification_id);
    const family = familyOf(enrollment.certification_id);
    const scope = resolveLearningScope({
      targetExam: enrollment.certification_id,
      careerObjective: legacy?.careerObjective ?? profile?.career_objective ?? null,
    });
    return {
      source: "enrollment",
      enrollmentId: enrollment.id,
      certificationId,
      family,
      programId: enrollment.program_id ?? scope.programId,
      aircraftId: enrollment.aircraft_id ?? aircraftOf(enrollment.certification_id),
      careerObjectiveId: scope.careerObjectiveId,
      subjectScope: scope.subjectScope,
    };
  }

  // 2) Learning profile preference (no enrollment yet but profile set).
  if (profile?.preferred_certification_id) {
    const scope = resolveLearningScope({
      targetExam: profile.preferred_certification_id,
      careerObjective: profile.career_objective ?? legacy?.careerObjective ?? null,
    });
    return {
      source: "profile",
      enrollmentId: null,
      certificationId: scope.certificationId,
      family: scope.family,
      programId: profile.preferred_program_id ?? scope.programId,
      aircraftId: profile.preferred_aircraft_id ?? scope.aircraftId,
      careerObjectiveId: scope.careerObjectiveId,
      subjectScope: scope.subjectScope,
    };
  }

  // 3) Legacy fallback — Phase 1 resolver over profiles.target_exam.
  if (legacy?.targetExam || legacy?.careerObjective) {
    const scope = resolveLearningScope({
      targetExam: legacy.targetExam ?? null,
      careerObjective: legacy.careerObjective ?? null,
    });
    return {
      source: "legacy",
      enrollmentId: null,
      certificationId: scope.certificationId,
      family: scope.family,
      programId: scope.programId,
      aircraftId: scope.aircraftId,
      careerObjectiveId: scope.careerObjectiveId,
      subjectScope: scope.subjectScope,
    };
  }

  // 4) Nothing known.
  return EMPTY;
}

/**
 * Canonical target_exam string to mirror back to profiles.target_exam for
 * a given enrollment (keeps legacy readers working).
 */
export function targetExamForEnrollment(enrollment: EnrollmentRow | null | undefined): string | null {
  if (!enrollment) return null;
  return resolveContentId(enrollment.certification_id);
}
