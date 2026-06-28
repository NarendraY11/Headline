// =====================================================================
// PHASE 5 — Content Scope DB Enrichment
//
// Async enrichment of a static ContentScope with DB registry data:
//   course_subjects → subjects for a certification
//   subject_modules → modules per subject
//   module_topics   → topics per module
//
// Falls back gracefully to the static scope if tables are empty,
// offline, or the Phase 1 registry seed hasn't been applied yet.
// =====================================================================

import { supabase } from "./supabase";
import {
  type ContentScope,
  type ScopeSubject,
  type ScopeModule,
  EMPTY_SCOPE,
} from "./contentDeliveryEngine";

export interface ScopeTopic {
  id: string;
  label: string;
  moduleId: string;
  subjectId: string;
  priority: number;
}

export interface EnrichedContentScope extends ContentScope {
  topics: ScopeTopic[];
  eligibleTopicIds: ReadonlySet<string>;
  /** true if DB registry contributed subjects (vs pure static fallback) */
  dbEnriched: boolean;
}

// Supabase join shapes fight the type checker — use any[] at all call sites.

// In-process cache: certificationId → subjects (10-minute TTL)
const DB_CACHE = new Map<string, { scope: EnrichedContentScope; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function cacheKey(scope: ContentScope): string {
  return `${scope.certificationId ?? "none"}:${scope.aircraftId ?? "none"}`;
}

/**
 * Enrich a static ContentScope with registry data from the DB.
 * Returns the same scope enhanced with DB subjects/modules/topics where
 * available, or the original scope if DB is empty or unavailable.
 *
 * Results are cached in-process for 10 minutes.
 */
export async function enrichContentScope(
  scope: ContentScope
): Promise<EnrichedContentScope> {
  const key = cacheKey(scope);
  const cached = DB_CACHE.get(key);
  if (cached && cached.expires > Date.now()) return cached.scope;

  const result = await fetchEnrichedScope(scope);
  DB_CACHE.set(key, { scope: result, expires: Date.now() + CACHE_TTL });
  return result;
}

/** Clear the in-process enrichment cache (useful after admin writes). */
export function invalidateContentScopeCache(): void {
  DB_CACHE.clear();
}

async function fetchEnrichedScope(
  scope: ContentScope
): Promise<EnrichedContentScope> {
  if (!scope.certificationId) {
    return toEnriched(scope, [], false);
  }

  try {
    // 1) Resolve certification UUID from slug so we can query course_subjects
    // (course_subjects.course_id is a UUID FK to certifications.id, not the slug).
    const { data: certRow, error: certError } = await supabase
      .from("certifications")
      .select("id")
      .eq("slug", scope.certificationId)
      .maybeSingle();

    if (certError || !certRow) {
      // Cert not in registry yet — stay with static scope, no error.
      return toEnriched(scope, [], false);
    }

    // 2) Load subjects for this certification.
    // Schema: course_subjects(course_id uuid, subject_id text, position int)
    const { data: csRows, error: csError } = await supabase
      .from("course_subjects")
      .select("subject_id, position, subjects(title)")
      .eq("course_id", certRow.id)
      .order("position", { ascending: true });

    if (csError || !csRows || csRows.length === 0) {
      // Registry table empty or not yet seeded — stay with static scope.
      return toEnriched(scope, [], false);
    }

    // Merge DB subjects with static (DB wins on id conflicts)
    const dbSubjectIds = new Set((csRows as any[]).map((r) => r.subject_id as string));
    const staticFiltered = scope.subjects.filter((s) => !dbSubjectIds.has(s.id));

    const dbSubjects: ScopeSubject[] = (csRows as any[]).map((r, i) => ({
      id: r.subject_id,
      label: (r.subjects as any)?.title ?? r.subject_id,
      source: "primary" as const,
      priority: r.position ?? i + 1,
      certificationId: scope.certificationId,
    }));

    const mergedSubjects: ScopeSubject[] = [...dbSubjects, ...staticFiltered].sort(
      (a, b) => a.priority - b.priority
    );
    const mergedSubjectIds = new Set(mergedSubjects.map((s) => s.id));

    // 3) Load modules for merged subjects.
    // Schema: subject_modules(subject_id text, module_id text, position int)
    const { data: smRows } = await supabase
      .from("subject_modules")
      .select("module_id, position, subject_id")
      .in("subject_id", [...mergedSubjectIds])
      .order("position", { ascending: true });

    const dbModules: ScopeModule[] = ((smRows ?? []) as any[]).map((r, i) => ({
      id: r.module_id,
      label: r.module_id,
      subjectId: r.subject_id,
      priority: r.position ?? i + 1,
    }));

    // Merge with static modules (DB wins)
    const dbModuleIds = new Set(dbModules.map((m) => m.id));
    const staticModules = scope.modules.filter((m) => !dbModuleIds.has(m.id));
    const mergedModules = [...dbModules, ...staticModules].sort(
      (a, b) => a.priority - b.priority
    );
    const mergedModuleIds = new Set(mergedModules.map((m) => m.id));

    // 4) Load topics for merged modules.
    // Schema: module_topics(module_id text, topic_id uuid, position int)
    const moduleIdArray = [...mergedModuleIds];
    let topics: ScopeTopic[] = [];

    if (moduleIdArray.length > 0) {
      const { data: mtRows } = await supabase
        .from("module_topics")
        .select("topic_id, position, topics(title), module_id")
        .in("module_id", moduleIdArray)
        .order("position", { ascending: true });

      topics = ((mtRows ?? []) as any[]).map((r, i) => ({
        id: r.topic_id,
        label: (r.topics as any)?.title ?? r.topic_id,
        moduleId: r.module_id,
        subjectId: "",
        priority: r.position ?? i + 1,
      }));
    }

    const enriched: EnrichedContentScope = {
      ...scope,
      subjects: mergedSubjects,
      modules: mergedModules,
      eligibleSubjectIds: mergedSubjectIds,
      eligibleModuleIds: mergedModuleIds,
      hasContent: mergedSubjects.length > 0,
      topics,
      eligibleTopicIds: new Set(topics.map((t) => t.id)),
      dbEnriched: true,
    };

    return enriched;
  } catch {
    // Any error (offline, RLS, missing tables) → fall back to static
    return toEnriched(scope, [], false);
  }
}

function toEnriched(
  scope: ContentScope,
  topics: ScopeTopic[],
  dbEnriched: boolean
): EnrichedContentScope {
  return {
    ...scope,
    topics,
    eligibleTopicIds: new Set(topics.map((t) => t.id)),
    dbEnriched,
  };
}

export const EMPTY_ENRICHED_SCOPE: EnrichedContentScope = {
  ...EMPTY_SCOPE,
  topics: [],
  eligibleTopicIds: new Set(),
  dbEnriched: false,
};
