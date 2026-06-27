// Phase 3 / 3.1 — CMS DB layer. Loads the tree (paginated — never the
// PostgREST 1000-row cap), server-side search, generic CRUD, validated
// relationship assignment, version history, and SAFE bulk ops (chunked,
// versioned, archive-not-delete). No question import (Phase 4).

import { supabase } from "../supabase";
import {
  buildContentTree,
  buildVersionRecord,
  chunk,
  hasBlockingErrors,
  mergeSearchResults,
  validateHierarchyAssignment,
  type ContentData,
  type ContentNode,
  type EntityType,
  type RelationKind,
  type SearchResult,
} from "./contentModel";

// entity type → table name (modules == subcategories).
const TABLE: Record<EntityType, string> = {
  program: "programs",
  certification: "certifications",
  aircraft: "aircraft",
  subject: "subjects",
  module: "subcategories",
  topic: "topics",
  question_group: "question_groups",
  question: "questions",
};

const PAGE = 1000;          // PostgREST hard cap per request — page past it.
const BULK_CHUNK = 200;     // ids per write request (URL-length safe).

/** Fetch ALL rows of a table by paging in PAGE-sized windows. Never
 *  silently truncates (the Phase 3 audit's P0). */
async function fetchAll(table: string, cols = "*"): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/** Load every registry + relation row (paginated) and assemble the tree. */
export async function loadContentTree(): Promise<{ tree: ContentNode[]; data: ContentData }> {
  const [
    programs, certifications, aircraft, subjects, subcategories, topics, questionGroups,
    programCert, certAircraft, courseSubject, subjectModule, moduleTopic, topicGroup,
  ] = await Promise.all([
    fetchAll("programs", "id,slug,title,status,sort_order"),
    fetchAll("certifications", "id,slug,title,status,sort_order"),
    fetchAll("aircraft", "id,slug,title,status,sort_order"),
    fetchAll("subjects", "id,title,status,sort_order"),
    fetchAll("subcategories", "id,title,status,sort_order"),
    fetchAll("topics", "id,slug,title,status,sort_order"),
    fetchAll("question_groups", "id,slug,title,status,sort_order"),
    fetchAll("program_certifications", "program_id,certification_id,position"),
    fetchAll("certification_aircraft", "certification_id,aircraft_id"),
    fetchAll("course_subjects", "course_id,subject_id,position"),
    fetchAll("subject_modules", "subject_id,module_id,position"),
    fetchAll("module_topics", "module_id,topic_id,position"),
    fetchAll("topic_groups", "topic_id,group_id,position"),
  ]);

  const data: ContentData = {
    programs, certifications, aircraft,
    subjects: subjects.map((s) => ({ ...s, slug: s.id })),
    modules: subcategories.map((m) => ({ ...m, slug: m.id })),
    topics, questionGroups,
    edges: {
      programCert: programCert.map((e) => ({ parent: e.program_id, child: e.certification_id, position: e.position })),
      certAircraft: certAircraft.map((e) => ({ parent: e.certification_id, child: e.aircraft_id })),
      courseSubject: courseSubject.map((e) => ({ parent: e.course_id, child: e.subject_id, position: e.position })),
      subjectModule: subjectModule.map((e) => ({ parent: e.subject_id, child: e.module_id, position: e.position })),
      moduleTopic: moduleTopic.map((e) => ({ parent: e.module_id, child: e.topic_id, position: e.position })),
      topicGroup: topicGroup.map((e) => ({ parent: e.topic_id, child: e.group_id, position: e.position })),
    },
  };
  return { tree: buildContentTree(data), data };
}

/** Lazy-load questions under a topic, capped + paginated (no 1000 surprise). */
export async function loadQuestionsForTopic(topicId: string, limit = 200) {
  const { data, error } = await supabase
    .from("topic_questions")
    .select("question_id, position, questions(*)")
    .eq("topic_id", topicId)
    .range(0, Math.max(0, limit - 1));
  if (error) throw error;
  return (data ?? []).map((r: any) => r.questions).filter(Boolean);
}

// ── Server-side search (Phase 3.1 — includes questions, scales to 50k) ──
/** Sanitize a query for PostgREST `or(...)` filters: strip reserved chars. */
function safeTerm(q: string): string {
  return q.replace(/[,()*%:]/g, " ").trim();
}

/** Search every entity type server-side via ilike, including question
 *  prompt/explanation/slug. Each table is indexed + limited, so this stays
 *  fast at 50k+ questions instead of flattening the whole tree client-side. */
export async function searchContentServer(query: string, perTypeLimit = 20): Promise<SearchResult[]> {
  const term = safeTerm(query);
  if (!term) return [];
  const like = `%${term}%`;

  const registry: Array<[EntityType, string, string]> = [
    ["program", "programs", "id,slug,title,status"],
    ["certification", "certifications", "id,slug,title,status"],
    ["aircraft", "aircraft", "id,slug,title,status"],
    ["subject", "subjects", "id,title,status"],
    ["module", "subcategories", "id,title,status"],
    ["topic", "topics", "id,slug,title,status"],
    ["question_group", "question_groups", "id,slug,title,status"],
  ];

  const registryQueries = registry.map(async ([type, table, cols]) => {
    const hasSlug = cols.includes("slug");
    const filter = hasSlug ? `title.ilike.${like},slug.ilike.${like},id.ilike.${like}` : `title.ilike.${like},id.ilike.${like}`;
    const { data, error } = await supabase.from(table).select(cols).or(filter).limit(perTypeLimit);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ id: r.id, type, title: r.title, slug: r.slug ?? r.id, status: r.status })) as SearchResult[];
  });

  const questionQuery = (async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("id,prompt,status")
      .or(`prompt.ilike.${like},explanation.ilike.${like},id.ilike.${like}`)
      .limit(perTypeLimit * 2);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id, type: "question" as EntityType,
      title: (r.prompt ?? "").slice(0, 80), slug: r.id, status: r.status,
    })) as SearchResult[];
  })();

  const lists = await Promise.all([...registryQueries, questionQuery]);
  return mergeSearchResults(...lists);
}

// ── Generic CRUD ────────────────────────────────────────────────────────
export async function upsertEntity(type: EntityType, row: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.from(TABLE[type]).upsert(row).select().maybeSingle();
  if (error) throw error;
  return data;
}

/** Snapshot rows into content_versions before a bulk status change so the
 *  ledger records publish/archive/restore — chunked. */
async function snapshotEntities(type: EntityType, ids: string[], reason: string, editor?: string): Promise<void> {
  for (const part of chunk(ids, BULK_CHUNK)) {
    const { data, error } = await supabase.from(TABLE[type]).select("*").in("id", part);
    if (error) throw error;
    const recs = (data ?? []).map((r: any) => buildVersionRecord(type, String(r.id), Number(r.version ?? 0), r, reason, editor));
    if (recs.length) {
      const { error: vErr } = await supabase.from("content_versions").insert(recs);
      if (vErr) throw vErr;
    }
  }
}

/** Bulk status change — versioned + chunked. Replaces hard delete. */
export async function setStatusBulk(
  type: EntityType, ids: string[], status: "draft" | "published" | "archived", editor?: string
): Promise<void> {
  if (ids.length === 0) return;
  await snapshotEntities(type, ids, `bulk:${status}`, editor);
  for (const part of chunk(ids, BULK_CHUNK)) {
    const { error } = await supabase.from(TABLE[type]).update({ status }).in("id", part);
    if (error) throw error;
  }
}

export const archiveEntities = (type: EntityType, ids: string[], editor?: string) => setStatusBulk(type, ids, "archived", editor);
export const restoreEntities = (type: EntityType, ids: string[], editor?: string) => setStatusBulk(type, ids, "draft", editor);
export const publishEntities = (type: EntityType, ids: string[], editor?: string) => setStatusBulk(type, ids, "published", editor);

// NOTE: hard delete intentionally REMOVED from the CMS path (Phase 3.1).
// Content is only ever archived (recoverable). Purges happen out-of-band.

// ── Relationship assignment (validated; uses Phase 1 relation tables) ───
const REL_TABLE: Record<RelationKind, { table: string; parent: string; child: string }> = {
  "program>certification": { table: "program_certifications", parent: "program_id", child: "certification_id" },
  "certification>aircraft": { table: "certification_aircraft", parent: "certification_id", child: "aircraft_id" },
  "certification>subject": { table: "course_subjects", parent: "course_id", child: "subject_id" },
  "subject>module": { table: "subject_modules", parent: "subject_id", child: "module_id" },
  "module>topic": { table: "module_topics", parent: "module_id", child: "topic_id" },
  "topic>question_group": { table: "topic_groups", parent: "topic_id", child: "group_id" },
};

/** Assign a relationship after validating it (no self-ref / duplicate /
 *  cycle). Throws a meaningful admin error on invalid input. */
export async function assignRelation(kind: RelationKind, parentId: string, childId: string, position = 0): Promise<void> {
  const r = REL_TABLE[kind];
  const { data, error } = await supabase.from(r.table).select(`${r.parent},${r.child}`);
  if (error) throw error;
  const edges = (data ?? []).map((e: any) => ({ parent: e[r.parent], child: e[r.child] }));
  const issues = validateHierarchyAssignment(kind, parentId, childId, edges);
  if (hasBlockingErrors(issues)) throw new Error(issues.map((i) => i.message).join("; "));
  const { error: upErr } = await supabase.from(r.table).upsert({ [r.parent]: parentId, [r.child]: childId, position });
  if (upErr) throw upErr;
}

export async function unassignRelation(kind: RelationKind, parentId: string, childId: string): Promise<void> {
  const r = REL_TABLE[kind];
  const { error } = await supabase.from(r.table).delete().eq(r.parent, parentId).eq(r.child, childId);
  if (error) throw error;
}

// ── Versioning ──────────────────────────────────────────────────────────
export async function saveVersion(
  type: EntityType, entityId: string, snapshot: Record<string, unknown>, reason?: string, editorEmail?: string
): Promise<void> {
  const currentVersion = Number((snapshot as any)?.version ?? 0);
  const rec = buildVersionRecord(type, entityId, currentVersion, snapshot, reason, editorEmail);
  const { error } = await supabase.from("content_versions").insert(rec);
  if (error) throw error;
}

export async function listVersions(type: EntityType, entityId: string) {
  const { data, error } = await supabase
    .from("content_versions").select("*")
    .eq("entity_type", type).eq("entity_id", entityId)
    .order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Rollback = write a chosen snapshot back onto the live row, after first
 *  versioning the current state (so rollback is itself reversible). */
export async function rollbackToVersion(type: EntityType, entityId: string, versionId: number): Promise<void> {
  const { data, error } = await supabase.from("content_versions").select("*").eq("id", versionId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Version not found.");
  const snap = (data as any).snapshot as Record<string, unknown>;
  const { data: live } = await supabase.from(TABLE[type]).select("*").eq("id", entityId).maybeSingle();
  if (live) await saveVersion(type, entityId, live as any, `pre-rollback to v${(data as any).version}`);
  const { error: upErr } = await supabase.from(TABLE[type]).update(snap).eq("id", entityId);
  if (upErr) throw upErr;
}
