// =====================================================================
// PHASE 4 — Import service. Orchestrates parse→chunk→normalize→validate
// →dedupe→stage→preview→commit pipeline using Supabase for persistence.
//
// Runs entirely client-side for CSV/JSON. Chunked to keep memory usage
// flat for 100k+ row files. Yields to event loop between chunks for UI
// responsiveness.
// =====================================================================

import { supabase } from "../supabase";
import type { ImportType } from "./parsers";
import { parseContent } from "./parsers";
import { buildRows } from "./normalize";
import type { NormalizedRow } from "./normalize";

// ponytail: small chunks balance payload size vs API call count.
const PARSE_CHUNK = 250;
const COMMIT_CHUNK = 150;

export type SessionStatus =
  | "uploading" | "parsing" | "normalizing" | "validating"
  | "preview" | "importing" | "completed" | "cancelled" | "failed";

export interface SessionStats {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  imported: number;
  skipped: number;
  warnings: number;
  errors: number;
}

export interface ImportSession {
  id: string;
  userId: string | null;
  importType: ImportType;
  fileName: string;
  status: SessionStatus;
  statistics: Partial<SessionStats>;
  validationResults: { level: string; field: string; message: string }[];
  preview: Record<string, unknown> | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function mapSession(row: Record<string, unknown>): ImportSession {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    importType: row.import_type as ImportType,
    fileName: (row.file_name as string) ?? "",
    status: row.status as SessionStatus,
    statistics: (row.statistics as Partial<SessionStats>) ?? {},
    validationResults: (row.validation_results as []) ?? [],
    preview: (row.preview as Record<string, unknown>) ?? null,
    error: (row.error as string) ?? null,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

async function patch(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from("import_sessions")
    .update({ updated_at: new Date().toISOString(), ...fields })
    .eq("id", id);
  if (error) throw new Error(`Session update failed: ${error.message}`);
}

async function yield_() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

// ── Public API ────────────────────────────────────────────────────────

/** Create an import session record and return its id. */
export async function createSession(type: ImportType, fileName: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("import_sessions")
    .insert({ import_type: type, file_name: fileName, status: "uploading", user_id: auth.user?.id ?? null })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create import session.");
  return (data as { id: string }).id;
}

/**
 * Full pipeline: parse → chunk(normalize+validate+dedupe) → insert import_rows
 * → update session to 'preview'. Returns the preview object so callers don't
 * need a separate DB fetch. onProgress called with (processed, total).
 */
export async function runPipeline(
  sessionId: string,
  text: string,
  type: ImportType,
  onProgress: (n: number, total: number) => void,
): Promise<Record<string, unknown>> {
  await patch(sessionId, { status: "parsing" });
  const { rows: rawRows, warnings: parseWarnings } = parseContent(type, text);
  const total = rawRows.length;

  await patch(sessionId, { status: "normalizing" });

  // Fetch existing hashes for exact-dup detection against live questions.
  const existingHashes = new Set<string>();
  const { data: hashes } = await supabase
    .from("questions")
    .select("dedupe_hash")
    .not("dedupe_hash", "is", null);
  if (hashes) (hashes as { dedupe_hash: string }[]).forEach((r) => existingHashes.add(r.dedupe_hash));

  await patch(sessionId, { status: "validating" });

  const stats: SessionStats = {
    total,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    imported: 0,
    skipped: 0,
    warnings: parseWarnings.length,
    errors: 0,
  };

  // Coverage sets for preview
  const programs = new Set<string>();
  const certifications = new Set<string>();
  const aircraft = new Set<string>();
  const subjects = new Set<string>();
  const topics = new Set<string>();
  const first20: NormalizedRow[] = [];

  for (let offset = 0; offset < rawRows.length; offset += PARSE_CHUNK) {
    const chunk = rawRows.slice(offset, offset + PARSE_CHUNK);
    const processed = buildRows(chunk, { existingHashes });

    for (const r of processed) {
      if (r.status === "duplicate") stats.duplicates++;
      else if (r.status === "valid") {
        stats.valid++;
        existingHashes.add(r.normalized.dedupeHash); // intra-file dedup
      } else stats.invalid++;
      stats.warnings += r.issues.filter((i) => i.level === "warning").length;
      stats.errors += r.issues.filter((i) => i.level === "error").length;
      const n = r.normalized;
      if (n.programId) programs.add(n.programId);
      if (n.certificationId) certifications.add(n.certificationId);
      if (n.aircraftId) aircraft.add(n.aircraftId);
      if (n.subjectId) subjects.add(n.subjectId);
      if (n.topicId) topics.add(n.topicId);
      if (offset + r.rowIndex < 20) first20.push(r);
    }

    const rowsToInsert = processed.map((r) => ({
      session_id: sessionId,
      row_index: offset + r.rowIndex,
      raw: r.raw,
      normalized: r.normalized,
      status: r.status === "valid" || r.status === "invalid" || r.status === "duplicate"
        ? r.status
        : "pending",
      issues: r.issues,
      dedupe_hash: r.normalized.dedupeHash,
    }));

    const { error } = await supabase.from("import_rows").insert(rowsToInsert);
    if (error) throw new Error(`Row insert failed at offset ${offset}: ${error.message}`);

    onProgress(Math.min(offset + PARSE_CHUNK, total), total);
    await yield_();
  }

  const preview = {
    total: stats.total,
    valid: stats.valid,
    invalid: stats.invalid,
    duplicates: stats.duplicates,
    warnings: stats.warnings,
    errors: stats.errors,
    programs: [...programs],
    certifications: [...certifications],
    aircraft: [...aircraft],
    subjects: [...subjects],
    topics: [...topics],
    first20,
  };

  await patch(sessionId, { status: "preview", statistics: stats, preview });
  return preview;
}

/**
 * Commit: insert valid rows into questions as status='draft', in chunks.
 * onProgress called with (done, total).
 */
export async function commitSession(
  sessionId: string,
  onProgress: (n: number, total: number) => void,
): Promise<{ committed: number; skipped: number }> {
  await patch(sessionId, { status: "importing" });

  const { count } = await supabase
    .from("import_rows")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "valid");

  const total = count ?? 0;
  let committed = 0;
  let skipped = 0;
  let page = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("import_rows")
      .select("id, normalized")
      .eq("session_id", sessionId)
      .eq("status", "valid")
      .range(page * COMMIT_CHUNK, (page + 1) * COMMIT_CHUNK - 1);

    if (error) throw new Error(`Failed to fetch rows: ${error.message}`);
    if (!rows || rows.length === 0) break;

    const questions = (rows as { id: string; normalized: Record<string, unknown> }[]).map((r, idx) => {
      const n = r.normalized as Record<string, unknown>;
      const id = (n.slug as string) ?? `imp-${sessionId.slice(0, 8)}-${committed + skipped + idx}`;
      return {
        id,
        prompt: n.prompt,
        choices: n.choices,
        correct: n.correct,
        explanation: n.explanation,
        difficulty: n.difficulty ?? "standard",
        subject_id: n.subjectId ?? null,
        subcategory_id: n.moduleId ?? null,
        topic_id: n.topicId ?? null,
        ata: n.ata ?? null,
        authority: n.authority ?? null,
        regulation: n.regulation ?? null,
        refs: Array.isArray(n.references) ? n.references : [],
        attachments: Array.isArray(n.attachments) ? n.attachments : [],
        dedupe_hash: n.dedupeHash,
        status: "draft",
        updated_at: new Date().toISOString(),
      };
    });

    const { error: insertErr } = await supabase.from("questions").upsert(questions, { onConflict: "id" });
    if (insertErr) {
      // Mark as skipped; don't abort entire import.
      skipped += rows.length;
    } else {
      const ids = (rows as { id: string }[]).map((r) => r.id);
      await supabase.from("import_rows").update({ status: "imported" }).in("id", ids);
      committed += rows.length;
    }

    onProgress(committed + skipped, total);
    await yield_();
    page++;
    if (rows.length < COMMIT_CHUNK) break;
  }

  await patch(sessionId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    statistics: { imported: committed, skipped, total },
  });

  return { committed, skipped };
}

/** Cancel a session (sets status='cancelled'). */
export async function cancelSession(sessionId: string): Promise<void> {
  await patch(sessionId, { status: "cancelled" });
}

/** Fail a session with an error message. */
export async function failSession(sessionId: string, msg: string): Promise<void> {
  await patch(sessionId, { status: "failed", error: msg });
}

/** Fetch past import sessions (admin-only; RLS enforces). */
export async function listSessions(limit = 30): Promise<ImportSession[]> {
  const { data, error } = await supabase
    .from("import_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapSession(r as Record<string, unknown>));
}

/** Fetch a single session. */
export async function loadSession(id: string): Promise<ImportSession> {
  const { data, error } = await supabase
    .from("import_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Session not found.");
  return mapSession(data as Record<string, unknown>);
}

/** Fetch import_rows for a session (for validation report download). */
export async function loadRows(sessionId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("import_rows")
    .select("row_index, status, issues, normalized")
    .eq("session_id", sessionId)
    .order("row_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

/** Download a validation report for a session as a CSV. */
export async function downloadReport(session: ImportSession): Promise<void> {
  const rows = await loadRows(session.id);
  const lines = [
    "row_index,status,issues",
    ...rows.map((r) => {
      const issues = JSON.stringify(r.issues ?? []).replace(/"/g, "'");
      return `${r.row_index},${r.status},"${issues}"`;
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `validation-report-${session.id.slice(0, 8)}-${session.fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
