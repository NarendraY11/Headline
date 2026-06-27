// =====================================================================
// PHASE 1 — Canonical content resolver (single source of truth)
//
// The platform historically scattered string parsing of values like
// "dgca-cpl", "DGCA CPL", "type-a320", "A320", "boeing-737" across
// onboarding, navigation, missions, dashboards, search and analytics.
// Some compared LABELS ("DGCA CPL"), some compared TOKENS ("dgca-cpl"),
// which produced a null-family bug for default users.
//
// This module is the ONE place that normalizes any historical string
// into a canonical registry id. Every consumer (navigationConfig,
// missionConfig, dashboardConfig, Today, Modules, Mission Engine,
// Analytics, Onboarding, Search) resolves through here — no page parses
// strings independently anymore.
//
// Pure + synchronous: uses static canonical maps mirrored from the
// `certifications` / `programs` / `aircraft` registry tables. No DB call
// on the hot path, so it works offline and in tests. DB-backed registry
// reads (for admin CRUD) are the cached fetchers at the bottom.
// =====================================================================

// NOTE: DB-backed registry reads (admin CRUD) live in ./contentRegistryDb
// so this module stays pure (no supabase import) — works offline + in tests.

export type TrackFamily = "dgca" | "type_rating" | "faa" | "easa" | "airline";

/** Canonical certification ids — mirror certifications.slug in the DB. */
export const CERTIFICATION_IDS = [
  "dgca-ppl", "dgca-cpl", "dgca-atpl", "dgca-rtr",
  "faa-ppl", "faa-cpl", "faa-atp",
  "easa-atpl",
  "type-a320", "type-a330", "type-a350", "type-atr72", "type-b737", "type-b777", "type-b787",
  "airline-recruitment",
] as const;
export type CanonicalId = (typeof CERTIFICATION_IDS)[number];

const CERT_SET = new Set<string>(CERTIFICATION_IDS);

/** Canonical aircraft ids — mirror aircraft.slug. */
export const AIRCRAFT_IDS = [
  "a320", "a330", "a350", "atr72", "b737ng", "b737max", "b777", "b787",
] as const;

// ---------------------------------------------------------------------
// Alias table: any historical label/token → canonical certification id.
// Keys are pre-normalized (lowercased, non-alphanumerics → '-').
// ---------------------------------------------------------------------
const CERT_ALIASES: Record<string, CanonicalId> = {
  // DGCA
  "dgca-cpl": "dgca-cpl", "dgca-commercial-pilot-license": "dgca-cpl", "cpl": "dgca-cpl",
  "dgca-atpl": "dgca-atpl", "dgca-airline-transport-pilot-license": "dgca-atpl", "atpl": "dgca-atpl",
  "dgca-ppl": "dgca-ppl", "dgca-private-pilot-license": "dgca-ppl", "ppl": "dgca-ppl",
  "dgca-rtr": "dgca-rtr", "rtr": "dgca-rtr", "rtr-a": "dgca-rtr",
  // FAA
  "faa-ppl": "faa-ppl", "faa-cpl": "faa-cpl", "faa-atp": "faa-atp", "atp": "faa-atp",
  // EASA
  "easa-atpl": "easa-atpl",
  // Type ratings (token + bare aircraft + manufacturer forms)
  "type-a320": "type-a320", "a320": "type-a320", "airbus-a320": "type-a320",
  "type-a330": "type-a330", "a330": "type-a330", "airbus-a330": "type-a330",
  "type-a350": "type-a350", "a350": "type-a350", "airbus-a350": "type-a350",
  "type-atr72": "type-atr72", "atr72": "type-atr72", "atr-72": "type-atr72",
  "type-b737": "type-b737", "b737": "type-b737", "boeing-737": "type-b737", "b737ng": "type-b737", "b737max": "type-b737",
  "type-b777": "type-b777", "b777": "type-b777", "boeing-777": "type-b777",
  "type-b787": "type-b787", "b787": "type-b787", "boeing-787": "type-b787",
  // Recruitment (career objective also flows through here)
  "airline-recruitment": "airline-recruitment", "recruitment": "airline-recruitment",
};

/** Lowercase, trim, collapse any run of non-alphanumerics to a single '-'. */
function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolve ANY historical string (label OR token) to a canonical
 * certification id, or null if unknown. This is the function every page
 * must use instead of comparing raw strings.
 *
 *   resolveContentId("DGCA CPL")  -> "dgca-cpl"
 *   resolveContentId("dgca-cpl")  -> "dgca-cpl"
 *   resolveContentId("A320")      -> "type-a320"
 *   resolveContentId("Boeing 737")-> "type-b737"
 *   resolveContentId("General Study") -> null
 */
export function resolveContentId(input: string | null | undefined): CanonicalId | null {
  if (!input) return null;
  const key = normalizeKey(input);
  if (CERT_SET.has(key)) return key as CanonicalId;
  return CERT_ALIASES[key] ?? null;
}

/** Alias kept for call-site clarity at write time (onboarding/profile). */
export const normalizeTargetExam = resolveContentId;

/**
 * Canonical id → track family. Single definition; getPrimaryTrackFamily
 * in trainingPaths.ts delegates here so legacy imports keep working but
 * now handle labels too (fixes the label-vs-token null-family bug).
 */
export function familyOf(input: string | null | undefined): TrackFamily | null {
  const id = resolveContentId(input);
  if (!id) return null;
  if (id.startsWith("dgca-")) return "dgca";
  if (id.startsWith("faa-")) return "faa";
  if (id.startsWith("easa-")) return "easa";
  if (id.startsWith("type-")) return "type_rating";
  if (id === "airline-recruitment") return "airline";
  return null;
}

/** Canonical type-rating id → canonical aircraft id (or null). */
export function aircraftOf(input: string | null | undefined): string | null {
  const id = resolveContentId(input);
  if (!id || !id.startsWith("type-")) return null;
  const map: Record<string, string> = {
    "type-a320": "a320", "type-a330": "a330", "type-a350": "a350",
    "type-atr72": "atr72", "type-b737": "b737ng", "type-b777": "b777", "type-b787": "b787",
  };
  return map[id] ?? null;
}

// ---------------------------------------------------------------------
// Learning scope resolver — the structured output future phases consume.
// ---------------------------------------------------------------------
export interface LearningProfileInput {
  targetExam?: string | null;
  careerObjective?: string | null;
}

export interface LearningScope {
  /** program slug, e.g. "dgca" / "type-rating" / null if unresolved */
  programId: string | null;
  /** canonical certification id, e.g. "dgca-cpl" / null */
  certificationId: CanonicalId | null;
  /** canonical aircraft id for type ratings, else null */
  aircraftId: string | null;
  family: TrackFamily | null;
  /** career objective canonical id layered on top (e.g. recruitment) */
  careerObjectiveId: CanonicalId | null;
  /** static subject-id scope usable today; registry-backed in Phase 2 */
  subjectScope: string[];
}

const PROGRAM_OF_FAMILY: Record<TrackFamily, string> = {
  dgca: "dgca", faa: "faa", easa: "easa", type_rating: "type-rating", airline: "airline-recruitment",
};

// Static subject scope (mirrors the DGCA core; registry course_subjects
// supersedes this in Phase 2). Empty for tracks with no bank yet.
const SUBJECT_SCOPE: Partial<Record<CanonicalId, string[]>> = {
  "dgca-cpl":  ["dgca-air-navigation", "dgca-meteorology", "dgca-air-regulations", "dgca-technical-general", "dgca-technical-specific"],
  "dgca-atpl": ["dgca-air-navigation", "dgca-meteorology", "dgca-air-regulations", "dgca-technical-general", "dgca-technical-specific", "dgca-aircraft-performance", "dgca-mass-balance", "dgca-flight-planning", "dgca-human-performance"],
  "dgca-ppl":  ["dgca-air-navigation", "dgca-meteorology", "dgca-air-regulations"],
  "airline-recruitment": ["recruitment-aptitude", "recruitment-technical", "recruitment-hr"],
};

/**
 * Resolve a learning profile to a structured scope. Pure. This is the
 * ONLY resolver future phases (Modules, Missions, Analytics, …) will
 * consume — no UI change in Phase 1.
 */
export function resolveLearningScope(profile: LearningProfileInput): LearningScope {
  const certificationId = resolveContentId(profile.targetExam);
  const family = familyOf(profile.targetExam);
  return {
    certificationId,
    family,
    programId: family ? PROGRAM_OF_FAMILY[family] : null,
    aircraftId: aircraftOf(profile.targetExam),
    careerObjectiveId: resolveContentId(profile.careerObjective),
    subjectScope: certificationId ? (SUBJECT_SCOPE[certificationId] ?? []) : [],
  };
}

// DB-backed registry reads live in ./contentRegistryDb (kept out of this
// pure module so the resolver imports no supabase client).
