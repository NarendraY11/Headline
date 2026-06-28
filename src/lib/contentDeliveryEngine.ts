// =====================================================================
// PHASE 5 — Content Delivery Engine (pure core)
//
// Single canonical resolver: ActiveLearningContext → ContentScope.
// Every consumer (Modules, Missions, Quiz, Analytics, Scheduler, AI,
// Admin) derives eligible subjects/modules/topics from this scope.
// No page filters independently anymore.
//
// Pure + synchronous: no DB call, no supabase import.
// DB enrichment lives in ./contentScopeDb.
// React hook lives in ../hooks/useContentScope.
// =====================================================================

import type { ActiveLearningContext, ContextSource } from "./learningContext";
import type { CanonicalId, TrackFamily } from "./contentRegistry";

// ─── Output Types ───────────────────────────────────────────────────

export interface ScopeSubject {
  /** Canonical subject id matching questions.subject_id */
  id: string;
  /** Human-readable label */
  label: string;
  /** Where this subject comes from */
  source: "primary" | "carryover" | "aircraft";
  /** Lower = higher priority in mission selection */
  priority: number;
  /** Which certification contributes this subject */
  certificationId: string | null;
}

export interface ScopeModule {
  id: string;
  label: string;
  subjectId: string;
  priority: number;
}

/** Full resolved content scope — all consumers derive from this. */
export interface ContentScope {
  // ── Identity (mirrors ActiveLearningContext) ──
  certificationId: CanonicalId | null;
  family: TrackFamily | null;
  aircraftId: string | null;
  programId: string | null;
  careerObjectiveId: CanonicalId | null;
  source: ContextSource;

  // ── Content layers ──
  subjects: ScopeSubject[];
  /** Modules known statically; DB enrichment adds more via contentScopeDb */
  modules: ScopeModule[];

  // ── O(1) eligibility checks ──
  eligibleSubjectIds: ReadonlySet<string>;
  eligibleModuleIds: ReadonlySet<string>;

  /** true when at least one subject is in scope */
  hasContent: boolean;
}

// ─── Static Subject Definitions ─────────────────────────────────────

interface SubjectDef {
  id: string;
  label: string;
}

const DGCA_PPL_SUBJECTS: SubjectDef[] = [
  { id: "air-navigation",  label: "Air Navigation" },
  { id: "meteorology",     label: "Aviation Meteorology" },
  { id: "air-regulation",  label: "Air Regulation" },
];

const DGCA_CPL_ONLY: SubjectDef[] = [
  { id: "dgca-tech-general",  label: "Technical General" },
  { id: "dgca-tech-specific", label: "Technical Specific" },
  { id: "dgca-rtr",           label: "RTR(A)" },
];

const DGCA_ATPL_ONLY: SubjectDef[] = [
  { id: "dgca-aircraft-performance", label: "Aircraft Performance" },
  { id: "dgca-mass-balance",         label: "Mass & Balance" },
  { id: "dgca-flight-planning",      label: "Flight Planning" },
  { id: "dgca-human-performance",    label: "Human Performance" },
];

// EASA 13-subject ATPL syllabus
const EASA_ATPL_SUBJECTS: SubjectDef[] = [
  { id: "easa-air-law",           label: "Air Law" },
  { id: "easa-agk-systems",       label: "AGK – Systems" },
  { id: "easa-agk-instrumentation", label: "AGK – Instrumentation" },
  { id: "easa-mass-balance",      label: "Mass & Balance" },
  { id: "easa-performance",       label: "Performance" },
  { id: "easa-flight-planning",   label: "Flight Planning" },
  { id: "easa-human-perf",        label: "Human Performance" },
  { id: "easa-met",               label: "Meteorology" },
  { id: "easa-gen-nav",           label: "General Navigation" },
  { id: "easa-radio-nav",         label: "Radio Navigation & Instruments" },
  { id: "easa-operational-procs", label: "Operational Procedures" },
  { id: "principles-of-flight",   label: "Principles of Flight" },
  { id: "easa-vfr-comm",          label: "VFR Communications" },
];

const FAA_SUBJECTS: SubjectDef[] = [
  { id: "air-navigation",  label: "Air Navigation" },
  { id: "meteorology",     label: "Aviation Meteorology" },
  { id: "air-regulation",  label: "Air Regulation" },
  { id: "principles-of-flight", label: "Principles of Flight" },
];

const RECRUITMENT_SUBJECTS: SubjectDef[] = [
  { id: "recruitment-aptitude",  label: "Aptitude" },
  { id: "recruitment-technical", label: "Technical Interview" },
  { id: "recruitment-hr",        label: "HR & Behavioural" },
];

// RTR standalone subjects
const RTR_SUBJECTS: SubjectDef[] = [
  { id: "dgca-rtr", label: "RTR(A)" },
];

// ─── Aircraft Subject Pools ──────────────────────────────────────────
// These replace the hardcoded TYPE_RATING_SUBJECTS in missionConfig.ts.
// Add new aircraft here; no code change needed elsewhere once done.

const AIRCRAFT_SUBJECT_POOLS: Record<string, SubjectDef[]> = {
  "a320": [
    { id: "a320-systems",      label: "Airbus A320 Family" },
    { id: "a320-pneumatics",   label: "A320 Pneumatics" },
    { id: "a320-hydraulics",   label: "A320 Hydraulics" },
    { id: "a320-electrical",   label: "A320 Electrical" },
    { id: "a320-flight-controls", label: "A320 Flight Controls" },
    { id: "a320-fuel",         label: "A320 Fuel System" },
  ],
  "a330": [
    { id: "a330-systems",      label: "A330 Systems" },
    { id: "a330-hydraulics",   label: "A330 Hydraulics" },
    { id: "a330-electrical",   label: "A330 Electrical" },
    { id: "a330-flight-controls", label: "A330 Flight Controls" },
  ],
  "a350": [
    { id: "a350-systems",      label: "A350 Systems" },
    { id: "a350-hydraulics",   label: "A350 Hydraulics" },
    { id: "a350-electrical",   label: "A350 Electrical" },
  ],
  "atr72": [
    { id: "atr72-systems",     label: "ATR72 Systems" },
    { id: "atr72-propulsion",  label: "ATR72 Propulsion" },
    { id: "atr72-electrics",   label: "ATR72 Electrics" },
  ],
  "b737ng": [
    { id: "b737-systems",      label: "B737 Systems" },
    { id: "b737-hydraulics",   label: "B737 Hydraulics" },
    { id: "b737-electrical",   label: "B737 Electrical" },
    { id: "b737-flight-controls", label: "B737 Flight Controls" },
  ],
  "b737max": [
    { id: "b737-systems",      label: "B737 Systems" },
    { id: "b737-hydraulics",   label: "B737 Hydraulics" },
    { id: "b737-electrical",   label: "B737 Electrical" },
    { id: "b737-flight-controls", label: "B737 Flight Controls" },
    { id: "b737max-mcas",      label: "B737 MAX MCAS" },
  ],
  "b777": [
    { id: "b777-systems",      label: "B777 Systems" },
    { id: "b777-hydraulics",   label: "B777 Hydraulics" },
    { id: "b777-electrical",   label: "B777 Electrical" },
  ],
  "b787": [
    { id: "b787-systems",      label: "B787 Systems" },
    { id: "b787-hydraulics",   label: "B787 Hydraulics" },
    { id: "b787-electrical",   label: "B787 Electrical" },
    { id: "b787-composites",   label: "B787 Composites" },
  ],
};

// ─── Certification → Primary Subject Pool ───────────────────────────

type CertSubjectMap = Partial<Record<CanonicalId, SubjectDef[]>>;

const CERT_PRIMARY_SUBJECTS: CertSubjectMap = {
  // DGCA — build from layered carry-over (CPL ⊃ PPL, ATPL ⊃ CPL ⊃ PPL)
  "dgca-ppl":  DGCA_PPL_SUBJECTS,
  "dgca-cpl":  [...DGCA_PPL_SUBJECTS, ...DGCA_CPL_ONLY],
  "dgca-atpl": [...DGCA_PPL_SUBJECTS, ...DGCA_CPL_ONLY, ...DGCA_ATPL_ONLY],
  "dgca-rtr":  RTR_SUBJECTS,

  // FAA
  "faa-ppl": FAA_SUBJECTS.slice(0, 3),       // nav + met + reg
  "faa-cpl": FAA_SUBJECTS,
  "faa-atp": FAA_SUBJECTS,

  // EASA
  "easa-atpl": EASA_ATPL_SUBJECTS,

  // Airline recruitment
  "airline-recruitment": RECRUITMENT_SUBJECTS,

  // Type ratings: subjects come from AIRCRAFT_SUBJECT_POOLS below
  // (resolved via aircraftId, not certificationId)
};

// ─── Carry-over Map ──────────────────────────────────────────────────
// Subjects shared between certifications (e.g. ATPL ⊃ CPL ⊃ PPL).
// Each entry lists subject ids that are inherited (not added by the cert itself).

const CARRYOVER_SUBJECT_IDS: Partial<Record<CanonicalId, string[]>> = {
  "dgca-cpl":  DGCA_PPL_SUBJECTS.map((s) => s.id),
  "dgca-atpl": [...DGCA_PPL_SUBJECTS, ...DGCA_CPL_ONLY].map((s) => s.id),
};

// ─── Static Module Pools ─────────────────────────────────────────────

const STATIC_MODULES: ScopeModule[] = [
  // Air Navigation sub-topics
  { id: "nav-gen",  label: "General Navigation",  subjectId: "air-navigation", priority: 1 },
  { id: "nav-rad",  label: "Radio Navigation",     subjectId: "air-navigation", priority: 2 },
  { id: "nav-inst", label: "Aircraft Instruments", subjectId: "air-navigation", priority: 3 },
  // Meteorology
  { id: "met-1", label: "Met Test 1", subjectId: "meteorology", priority: 1 },
  { id: "met-2", label: "Met Test 2", subjectId: "meteorology", priority: 2 },
  // Air Regulation
  { id: "reg-1", label: "Air Reg Test 1", subjectId: "air-regulation", priority: 1 },
  // A320
  { id: "a320-ata-27", label: "ATA 27 – Flight Controls", subjectId: "a320-systems", priority: 1 },
  { id: "a320-ata-21", label: "ATA 21 – Pneumatics",      subjectId: "a320-systems", priority: 2 },
  { id: "a320-ata-29", label: "ATA 29 – Hydraulics",       subjectId: "a320-systems", priority: 3 },
  { id: "a320-ata-24", label: "ATA 24 – Electrical",       subjectId: "a320-systems", priority: 4 },
  { id: "a320-ata-28", label: "ATA 28 – Fuel",             subjectId: "a320-systems", priority: 5 },
];

// ─── Core Resolver ───────────────────────────────────────────────────

function buildScopeSubjects(
  ctx: ActiveLearningContext
): ScopeSubject[] {
  const { certificationId, aircraftId } = ctx;

  const result: ScopeSubject[] = [];
  const carryoverIds = certificationId
    ? new Set(CARRYOVER_SUBJECT_IDS[certificationId] ?? [])
    : new Set<string>();

  // 1) Type-rating: aircraft subjects first-class
  if (aircraftId) {
    const pool = AIRCRAFT_SUBJECT_POOLS[aircraftId] ?? [];
    pool.forEach((s, i) => {
      result.push({ id: s.id, label: s.label, source: "aircraft", priority: i + 1, certificationId: certificationId });
    });
  }

  // 2) Certification primary subjects
  if (certificationId) {
    const primaries = CERT_PRIMARY_SUBJECTS[certificationId] ?? [];
    primaries.forEach((s, i) => {
      if (result.some((r) => r.id === s.id)) return; // skip dups from aircraft pool
      result.push({
        id: s.id,
        label: s.label,
        source: carryoverIds.has(s.id) ? "carryover" : "primary",
        priority: i + 1,
        certificationId: certificationId,
      });
    });
  }

  return result;
}

function buildScopeModules(subjects: ScopeSubject[]): ScopeModule[] {
  const eligibleSubjectIds = new Set(subjects.map((s) => s.id));
  return STATIC_MODULES.filter((m) => eligibleSubjectIds.has(m.subjectId));
}

/**
 * Resolve a full content scope from an active learning context.
 * Pure + synchronous: safe to call anywhere, works offline.
 *
 * For DB-backed enrichment (registry course_subjects, module_topics),
 * use enrichContentScope() from ./contentScopeDb.
 */
export function resolveContentScope(ctx: ActiveLearningContext): ContentScope {
  const subjects = buildScopeSubjects(ctx);
  const modules = buildScopeModules(subjects);

  return {
    certificationId: ctx.certificationId,
    family: ctx.family,
    aircraftId: ctx.aircraftId,
    programId: ctx.programId,
    careerObjectiveId: ctx.careerObjectiveId,
    source: ctx.source,
    subjects,
    modules,
    eligibleSubjectIds: new Set(subjects.map((s) => s.id)),
    eligibleModuleIds: new Set(modules.map((m) => m.id)),
    hasContent: subjects.length > 0,
  };
}

// ─── Mission Helpers ─────────────────────────────────────────────────

export interface ScopedMissionSubject {
  id: string;
  label: string;
  priority: number;
  source: "aircraft" | "primary" | "carryover";
}

/**
 * Return subjects eligible for mission generation in priority order.
 * Filters against available question banks (caller-supplied).
 *
 * Replaces TRACK_SUBJECTS in missionConfig.ts when
 * contentDeliveryEngine flag is ON.
 */
export function getEligibleMissionSubjects(
  scope: ContentScope,
  availableSubjectIds: Set<string>
): ScopedMissionSubject[] {
  return scope.subjects
    .filter((s) => availableSubjectIds.has(s.id))
    .sort((a, b) => a.priority - b.priority)
    .map((s) => ({
      id: s.id,
      label: s.label,
      priority: s.priority,
      source: s.source,
    }));
}

// ─── Exam-Centre Helpers ─────────────────────────────────────────────

/**
 * Filter a list of items (subjects, exams, modules) to only those in scope.
 * Use this in the Modules page, Exam Centre, and Mock Exam grid.
 */
export function filterToScope<T extends { id: string }>(
  items: T[],
  scope: ContentScope
): T[] {
  if (!scope.hasContent) return items; // no scope = show all (fallback)
  return items.filter((item) => scope.eligibleSubjectIds.has(item.id));
}

// ─── Analytics Helpers ───────────────────────────────────────────────

/**
 * Total subject count expected for the user's certification
 * (for readiness % denominator).
 */
export function getTotalExamSubjectCount(scope: ContentScope): number {
  return scope.subjects.filter((s) => s.source !== "carryover").length;
}

// ─── Empty scope (no context resolved) ──────────────────────────────

export const EMPTY_SCOPE: ContentScope = {
  certificationId: null,
  family: null,
  aircraftId: null,
  programId: null,
  careerObjectiveId: null,
  source: "none",
  subjects: [],
  modules: [],
  eligibleSubjectIds: new Set(),
  eligibleModuleIds: new Set(),
  hasContent: false,
};
