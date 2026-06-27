// =====================================================================
// PHASE 3 — CMS pure core (tree, search, validation, versioning)
//
// No supabase import → offline + test friendly. The DB layer (cmsDb.ts)
// fetches rows and feeds them here; React components render the result.
// Builds the hierarchy on the Phase 1 registry + relation tables — no new
// relationship tables beyond the optional question_groups bridge.
// =====================================================================

export type EntityType =
  | "program" | "certification" | "aircraft"
  | "subject" | "module" | "topic" | "question_group" | "question";

export interface RegistryNodeRow {
  id: string;
  slug?: string;
  title: string;
  status: "draft" | "published" | "archived";
  sort_order?: number;
}

export interface ContentNode {
  id: string;
  type: EntityType;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  sortOrder: number;
  children: ContentNode[];
}

/** Edge: parent id → child id, with ordering. */
export interface Edge { parent: string; child: string; position?: number }

/** All rows + edges needed to assemble the tree. */
export interface ContentData {
  programs: RegistryNodeRow[];
  certifications: RegistryNodeRow[];
  aircraft: RegistryNodeRow[];
  subjects: RegistryNodeRow[];
  modules: RegistryNodeRow[];          // = subcategories
  topics: RegistryNodeRow[];
  questionGroups: RegistryNodeRow[];
  edges: {
    programCert: Edge[];     // program → certification
    certAircraft: Edge[];    // certification → aircraft
    courseSubject: Edge[];   // certification → subject
    subjectModule: Edge[];   // subject → module
    moduleTopic: Edge[];     // module → topic
    topicGroup: Edge[];      // topic → question_group
  };
}

function toNode(r: RegistryNodeRow, type: EntityType): ContentNode {
  return {
    id: r.id, type, slug: r.slug ?? r.id, title: r.title,
    status: r.status, sortOrder: r.sort_order ?? 0, children: [],
  };
}

function index(rows: RegistryNodeRow[], type: EntityType): Map<string, ContentNode> {
  return new Map(rows.map((r) => [r.id, toNode(r, type)]));
}

function attach(parents: Map<string, ContentNode>, children: Map<string, ContentNode>, edges: Edge[]) {
  // Stable order: edge.position then child.sortOrder then title.
  const sorted = [...edges].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const e of sorted) {
    const p = parents.get(e.parent);
    const c = children.get(e.child);
    if (p && c) p.children.push(c);
  }
}

/**
 * Assemble the full content tree:
 *   Program → Certification → (Aircraft) + Subject → Module → Topic → QuestionGroup
 * Pure. Questions hang under topics/groups in the DB but are loaded lazily by
 * the UI (not materialised here to keep the tree light).
 */
export function buildContentTree(data: ContentData): ContentNode[] {
  const programs = index(data.programs, "program");
  const certs = index(data.certifications, "certification");
  const aircraft = index(data.aircraft, "aircraft");
  const subjects = index(data.subjects, "subject");
  const modules = index(data.modules, "module");
  const topics = index(data.topics, "topic");
  const groups = index(data.questionGroups, "question_group");

  attach(topics, groups, data.edges.topicGroup);
  attach(modules, topics, data.edges.moduleTopic);
  attach(subjects, modules, data.edges.subjectModule);
  attach(certs, subjects, data.edges.courseSubject);
  attach(certs, aircraft, data.edges.certAircraft);
  attach(programs, certs, data.edges.programCert);

  return [...programs.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
  );
}

/** Flatten a tree to a list (for search / counts). */
export function flattenTree(nodes: ContentNode[]): ContentNode[] {
  const out: ContentNode[] = [];
  const walk = (n: ContentNode) => { out.push(n); n.children.forEach(walk); };
  nodes.forEach(walk);
  return out;
}

// ── Search ────────────────────────────────────────────────────────────
export interface SearchResult { id: string; type: EntityType; title: string; slug: string; status: string }

/** Case-insensitive substring search over title/slug/type/status. Instant. */
export function searchContent(nodes: ContentNode[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flattenTree(nodes)
    .filter((n) =>
      n.title.toLowerCase().includes(q) ||
      n.slug.toLowerCase().includes(q) ||
      n.type.includes(q) ||
      n.status.includes(q))
    .map((n) => ({ id: n.id, type: n.type, title: n.title, slug: n.slug, status: n.status }));
}

// ── Validation ─────────────────────────────────────────────────────────
export interface ValidationIssue { level: "error" | "warning"; field: string; message: string }

export interface QuestionDraft {
  prompt?: string | null;
  choices?: Array<{ id: string; label: string }> | null;
  correct?: string | null;
  explanation?: string | null;
  difficulty?: string | null;
  subjectId?: string | null;
  subcategoryId?: string | null;
  topicId?: string | null;
  slug?: string | null;
}

/** Validate a question before publish. Errors block publish; warnings don't. */
export function validateQuestion(q: QuestionDraft, opts?: { existingSlugs?: Set<string>; existingHashes?: Set<string>; selfSlug?: string }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!q.prompt || !q.prompt.trim()) issues.push({ level: "error", field: "prompt", message: "Missing question prompt." });
  const choices = q.choices ?? [];
  if (choices.length < 2) issues.push({ level: "error", field: "choices", message: "At least two options are required." });
  if (!q.correct) issues.push({ level: "error", field: "correct", message: "Missing correct answer." });
  else if (choices.length && !choices.some((c) => c.id === q.correct))
    issues.push({ level: "error", field: "correct", message: "Correct answer does not match any option id." });
  if (!q.explanation || !q.explanation.trim()) issues.push({ level: "error", field: "explanation", message: "Missing explanation." });
  if (!q.subjectId) issues.push({ level: "error", field: "subjectId", message: "No subject assigned." });
  if (!q.subcategoryId && !q.topicId) issues.push({ level: "warning", field: "module", message: "No module/topic assigned." });
  if (q.slug && opts?.existingSlugs?.has(q.slug) && q.slug !== opts?.selfSlug)
    issues.push({ level: "error", field: "slug", message: "Duplicate slug." });
  // Duplicate-question detection by normalized prompt hash.
  if (q.prompt && opts?.existingHashes?.has(normalizedHash(q.prompt)))
    issues.push({ level: "warning", field: "prompt", message: "Possible duplicate question (matching prompt)." });
  return issues;
}

/** Validate a registry node (slug + relationship integrity). */
export function validateNode(
  node: { type: EntityType; slug?: string | null; title?: string | null; parentId?: string | null },
  opts?: { existingSlugs?: Set<string>; selfSlug?: string; requiresParent?: boolean }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!node.title || !node.title.trim()) issues.push({ level: "error", field: "title", message: "Missing title." });
  if (!node.slug || !node.slug.trim()) issues.push({ level: "error", field: "slug", message: "Missing slug." });
  else if (opts?.existingSlugs?.has(node.slug) && node.slug !== opts?.selfSlug)
    issues.push({ level: "error", field: "slug", message: "Duplicate slug." });
  if (opts?.requiresParent && !node.parentId)
    issues.push({ level: "error", field: "parent", message: "Broken relationship: no parent assigned." });
  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/** Stable normalized hash for duplicate detection (FNV-1a over normalized text). */
export function normalizedHash(text: string): string {
  const s = text.toLowerCase().replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ── Versioning ──────────────────────────────────────────────────────────
export interface VersionRecord {
  entity_type: EntityType;
  entity_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  reason?: string;
  editor_email?: string;
}

/** Build the next version record from a row snapshot. */
export function buildVersionRecord(
  entityType: EntityType, entityId: string, currentVersion: number,
  snapshot: Record<string, unknown>, reason?: string, editorEmail?: string
): VersionRecord {
  return {
    entity_type: entityType, entity_id: entityId,
    version: (currentVersion ?? 0) + 1, snapshot,
    reason, editor_email: editorEmail,
  };
}

/** Diff two snapshots → list of changed fields (shallow). */
export function diffSnapshot(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(prev?.[k]) !== JSON.stringify(next?.[k])) changed.push(k);
  }
  return changed.sort();
}

// =====================================================================
// PHASE 3.1 — scale + safety helpers (pure)
// =====================================================================

/** Split an array into chunks of at most `size` (bulk-op safety). */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Relation kinds and the parent/child entity types they connect. */
export const RELATION_TYPES: Record<string, { parent: EntityType; child: EntityType }> = {
  "program>certification": { parent: "program", child: "certification" },
  "certification>aircraft": { parent: "certification", child: "aircraft" },
  "certification>subject": { parent: "certification", child: "subject" },
  "subject>module": { parent: "subject", child: "module" },
  "module>topic": { parent: "module", child: "topic" },
  "topic>question_group": { parent: "topic", child: "question_group" },
};
export type RelationKind = keyof typeof RELATION_TYPES;

/** Existing edge for cycle/duplicate checks. */
export interface ExistingEdge { parent: string; child: string }

/**
 * Validate a hierarchy assignment BEFORE writing. Catches: self-reference,
 * duplicate relationship, and cycles (defensive — the typed hierarchy is a
 * DAG, but a malformed edge set could still loop). Pure.
 */
export function validateHierarchyAssignment(
  kind: RelationKind,
  parentId: string,
  childId: string,
  existingEdges: ExistingEdge[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!RELATION_TYPES[kind]) {
    issues.push({ level: "error", field: "kind", message: `Unknown relation kind: ${kind}.` });
    return issues;
  }
  if (!parentId || !childId) {
    issues.push({ level: "error", field: "relation", message: "Both parent and child are required." });
    return issues;
  }
  if (parentId === childId) {
    issues.push({ level: "error", field: "relation", message: "Self-reference is not allowed." });
    return issues;
  }
  if (existingEdges.some((e) => e.parent === parentId && e.child === childId)) {
    issues.push({ level: "error", field: "relation", message: "Duplicate relationship." });
  }
  // Cycle: would adding parent→child create a path child →…→ parent?
  const adj = new Map<string, string[]>();
  for (const e of existingEdges) {
    if (!adj.has(e.parent)) adj.set(e.parent, []);
    adj.get(e.parent)!.push(e.child);
  }
  const seen = new Set<string>();
  const stack = [childId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === parentId) {
      issues.push({ level: "error", field: "relation", message: "Cycle detected: this assignment would create a loop." });
      break;
    }
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const n of adj.get(cur) ?? []) stack.push(n);
  }
  return issues;
}

/** Merge several search-result lists, de-duping by `type:id`. */
export function mergeSearchResults(...lists: SearchResult[][]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const list of lists) {
    for (const r of list) {
      const k = `${r.type}:${r.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}
