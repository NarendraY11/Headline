// Phase 2 — DB layer for the learning model. Kept separate from the pure
// builder (learningContext.ts) so that module imports no supabase client.
//
//   resolveActiveLearningContext()  — read chain (enrollment → profile → legacy)
//   syncLearningModel()             — onboarding dual-write (flag-gated by caller)
//   admin enrollment ops            — create / list / activate / deactivate

import { supabase } from "./supabase";
import {
  buildActiveLearningContext,
  pickActiveEnrollment,
  type ActiveLearningContext,
  type EnrollmentRow,
  type LearningProfileRow,
  type LegacyProfile,
} from "./learningContext";
import {
  aircraftOf,
  familyOf,
  resolveContentId,
} from "./contentRegistry";

const PROGRAM_OF_FAMILY: Record<string, string> = {
  dgca: "dgca", faa: "faa", easa: "easa", type_rating: "type-rating", airline: "airline-recruitment",
};

/**
 * Resolve the active learning context for a user. Reads enrollments +
 * learning_profiles, falls back to the legacy mirror passed by the caller
 * (profiles.target_exam / career_objective). Never throws — degrades to the
 * legacy/none context so production paths are unaffected.
 */
export async function resolveActiveLearningContext(
  userId: string | null | undefined,
  legacy?: LegacyProfile | null
): Promise<ActiveLearningContext> {
  if (!userId) return buildActiveLearningContext({ legacy });
  try {
    const [{ data: enrollments }, { data: profile }] = await Promise.all([
      supabase.from("enrollments").select("id, user_id, certification_id, aircraft_id, program_id, is_active, status, created_at").eq("user_id", userId),
      supabase.from("learning_profiles").select("id, user_id, certification_id, aircraft_id, program_id, last_synced_at, created_at").eq("user_id", userId).maybeSingle(),
    ]);
    return buildActiveLearningContext({
      enrollment: pickActiveEnrollment(enrollments as EnrollmentRow[] | null),
      profile: (profile ?? null) as LearningProfileRow | null,
      legacy,
    });
  } catch {
    // Tables missing / RLS / offline → legacy behaviour, no crash.
    return buildActiveLearningContext({ legacy });
  }
}

/**
 * Onboarding dual-write. Upserts the learning profile and the active
 * enrollment from the resolved target_exam. Best-effort: returns ok/false,
 * never throws, so a failure can't break onboarding (target_exam is still
 * written by the existing path). Caller gates this behind the
 * `learningContext` feature flag.
 */
export async function syncLearningModel(
  userId: string,
  input: { targetExam?: string | null; careerObjective?: string | null; experienceLevel?: string | null }
): Promise<boolean> {
  const certificationId = resolveContentId(input.targetExam);
  if (!certificationId) return false; // nothing canonical to enrol into
  const family = familyOf(input.targetExam);
  const programId = family ? PROGRAM_OF_FAMILY[family] : null;
  const aircraftId = aircraftOf(input.targetExam);

  try {
    // 1) Upsert learning profile.
    await supabase.from("learning_profiles").upsert(
      {
        user_id: userId,
        preferred_program_id: programId,
        preferred_certification_id: certificationId,
        preferred_aircraft_id: aircraftId,
        career_objective: input.careerObjective ?? null,
        experience_level: input.experienceLevel ?? null,
      },
      { onConflict: "user_id" }
    );

    // 2+3) Atomic: deactivate-others + upsert-active in one Postgres transaction.
    await supabase.rpc("activate_enrollment", {
      p_user_id:     userId,
      p_cert_id:     certificationId,
      p_program_id:  programId ?? null,
      p_aircraft_id: aircraftId ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Admin enrollment ops (used by hidden EnrollmentsAdmin) ────────────
export async function adminListEnrollments(userId?: string): Promise<EnrollmentRow[]> {
  let q = supabase.from("enrollments").select("id, user_id, certification_id, aircraft_id, program_id, is_active, status, created_at").order("created_at", { ascending: false }).limit(500);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as EnrollmentRow[];
}

export async function adminCreateEnrollment(row: {
  user_id: string; certification_id: string; program_id?: string | null; aircraft_id?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("enrollments").insert({
    user_id: row.user_id,
    certification_id: row.certification_id,
    program_id: row.program_id ?? null,
    aircraft_id: row.aircraft_id ?? null,
    status: "active",
    is_active: false, // admin activates explicitly to respect one-active rule
  });
  if (error) throw error;
}

/** Activate one enrollment, deactivating the user's others first. Atomic via RPC. */
export async function adminActivateEnrollment(enrollment: EnrollmentRow): Promise<void> {
  const { error } = await supabase.rpc("activate_enrollment", {
    p_user_id:     enrollment.user_id,
    p_cert_id:     enrollment.certification_id,
    p_program_id:  enrollment.program_id ?? null,
    p_aircraft_id: enrollment.aircraft_id ?? null,
  });
  if (error) throw error;
}

export async function adminDeactivateEnrollment(id: string): Promise<void> {
  const { error } = await supabase.from("enrollments")
    .update({ is_active: false, status: "paused" }).eq("id", id);
  if (error) throw error;
}
