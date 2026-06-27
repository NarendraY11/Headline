// =====================================================================
// PHASE 4 — Normalization + pipeline helpers (pure).
//
// Maps an arbitrary raw row onto ONE canonical question model bound to the
// Phase 1 registry, then validates / dedupes / previews. Reuses Phase 1
// (resolveContentId/aircraftOf/familyOf) and Phase 3 (validateQuestion,
// normalizedHash, chunk). No DB, no deps → fully unit-testable.
// =====================================================================

import {
  aircraftOf,
  familyOf,
  resolveContentId,
} from "../contentRegistry";
import {
  normalizedHash,
  validateQuestion,
  type QuestionDraft,
  type ValidationIssue,
} from "../cms/contentModel";
import type { RawRow } from "./parsers";

const PROGRAM_OF_FAMILY: Record<string, string> = {
  dgca: "dgca", faa: "faa", easa: "easa", type_rating: "type-rating", airline: "airline-recruitment",
};

export interface NormalizedQuestion extends QuestionDraft {
  programId: string | null;
  certificationId: string | null;
  aircraftId: string | null;
  moduleId: string | null;
  tags: string[];
  references: string[];
  attachments: string[];
  ata: string | null;
  authority: string | null;
  regulation: string | null;
  dedupeHash: string;
}

export interface NormalizedRow {
  rowIndex: number;
  raw: RawRow;
  normalized: NormalizedQuestion;
  issues: ValidationIssue[];
  status: "valid" | "invalid" | "duplicate";
}

/** Pick the first present key (case/space/underscore-insensitive). */
function pick(row: RawRow, ...keys: string[]): string {
  const norm = (k: string) => k.toLowerCase().replace(/[\s_-]+/g, "");
  const map = new Map<string, unknown>();
  for (const k of Object.keys(row)) map.set(norm(k), row[k]);
  for (const k of keys) {
    const v = map.get(norm(k));
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function splitList(v: string): string[] {
  return v ? v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [];
}

/** Map a raw row → canonical NormalizedQuestion bound to the registry. */
export function normalizeRow(row: RawRow): NormalizedQuestion {
  const prompt = pick(row, "prompt", "question", "stem", "text");
  // Options: explicit option_a..d / a..d, or an "options" list.
  const explicit = ["a", "b", "c", "d"].map((letter) => ({
    id: letter,
    label: pick(row, `option_${letter}`, `option${letter}`, `opt_${letter}`, letter),
  })).filter((c) => c.label !== "");
  let choices = explicit;
  if (choices.length === 0) {
    const list = splitList(pick(row, "options", "choices"));
    choices = list.map((label, i) => ({ id: "abcd"[i] ?? String(i), label }));
  }
  const correctRaw = pick(row, "correct", "answer", "correct_answer").toLowerCase();
  // Accept "a"/"A"/"1"/full-label match.
  let correct = correctRaw;
  if (/^[1-4]$/.test(correctRaw)) correct = "abcd"[parseInt(correctRaw, 10) - 1];
  else if (correctRaw.length > 1) {
    const m = choices.find((c) => c.label.toLowerCase() === correctRaw);
    if (m) correct = m.id;
  }

  const certInput = pick(row, "certification", "cert", "exam", "target_exam");
  const aircraftInput = pick(row, "aircraft", "type");
  const programInput = pick(row, "program");

  const certificationId = resolveContentId(certInput) ?? resolveContentId(aircraftInput);
  const family = familyOf(certInput) ?? familyOf(aircraftInput);
  const programId = (programInput && PROGRAM_OF_FAMILY[programInput.toLowerCase().replace(/\s+/g, "-")])
    || (family ? PROGRAM_OF_FAMILY[family] : null);
  const aircraftId = aircraftOf(certInput) ?? aircraftOf(aircraftInput) ?? (aircraftInput ? aircraftInput.toLowerCase() : null);

  return {
    prompt,
    choices,
    correct,
    explanation: pick(row, "explanation", "rationale", "why"),
    difficulty: (pick(row, "difficulty", "level") || "standard").toLowerCase(),
    programId,
    certificationId,
    aircraftId,
    subjectId: pick(row, "subject", "subject_id") || null,
    moduleId: pick(row, "module", "module_id", "subcategory", "subcategory_id") || null,
    topicId: pick(row, "topic", "topic_id") || null,
    tags: splitList(pick(row, "tags", "topic_tags")),
    references: splitList(pick(row, "references", "refs", "reference")),
    attachments: splitList(pick(row, "attachments", "images", "image", "video")),
    ata: pick(row, "ata", "ata_chapter") || null,
    authority: pick(row, "authority") || null,
    regulation: pick(row, "regulation", "reg") || null,
    slug: pick(row, "slug", "id") || null,
    dedupeHash: normalizedHash(prompt),
  };
}

const VALID_DIFFICULTY = new Set(["standard", "complex", "extreme"]);

/** Validate a normalized question for import (extends Phase 3 rules). */
export function validateNormalized(
  q: NormalizedQuestion,
  opts?: { existingSlugs?: Set<string>; existingHashes?: Set<string> }
): ValidationIssue[] {
  // Imports are always new questions — don't pass selfSlug (no self-exclusion).
  const issues = validateQuestion(q, { existingSlugs: opts?.existingSlugs });
  // Multiple correct answers (raw had several) is caught upstream; here ensure exactly one.
  if (q.choices && q.correct && q.choices.filter((c) => c.id === q.correct).length > 1) {
    issues.push({ level: "error", field: "correct", message: "Multiple options share the correct id." });
  }
  if (q.difficulty && !VALID_DIFFICULTY.has(q.difficulty))
    issues.push({ level: "error", field: "difficulty", message: `Invalid difficulty "${q.difficulty}".` });
  if (q.certificationId === null)
    issues.push({ level: "error", field: "certification", message: "Unknown / unmapped certification or aircraft." });
  return issues;
}

// ── Duplicate detection ────────────────────────────────────────────────
/** Jaccard similarity over word sets (0..1). Pure. */
export function similarity(a: string, b: string): number {
  const toks = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean));
  const A = toks(a), B = toks(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Flag duplicates. Exact via dedupe_hash against existing + within-batch;
 * near via Jaccard ≥ threshold within the batch. NEVER deletes — only flags.
 * ponytail: intra-batch near-dup is O(n²); fine per chunk, documented ceiling.
 */
export function detectDuplicates(
  rows: NormalizedRow[],
  opts?: { existingHashes?: Set<string>; threshold?: number }
): NormalizedRow[] {
  const threshold = opts?.threshold ?? 0.9;
  const existing = opts?.existingHashes ?? new Set<string>();
  const seen = new Map<string, number>(); // hash → first row index in batch
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const h = r.normalized.dedupeHash;
    let dup = existing.has(h) || seen.has(h);
    if (!dup && threshold < 1) {
      for (let j = 0; j < i; j++) {
        if (similarity(r.normalized.prompt ?? "", rows[j].normalized.prompt ?? "") >= threshold) { dup = true; break; }
      }
    }
    if (dup) {
      r.status = "duplicate";
      r.issues = [...r.issues, { level: "warning", field: "prompt", message: "Possible duplicate question." }];
    } else {
      seen.set(h, i);
    }
  }
  return rows;
}

// ── Build a full normalized + validated + deduped row set ───────────────
export function buildRows(
  rawRows: RawRow[],
  opts?: { existingSlugs?: Set<string>; existingHashes?: Set<string>; threshold?: number }
): NormalizedRow[] {
  const rows: NormalizedRow[] = rawRows.map((raw, rowIndex) => {
    const normalized = normalizeRow(raw);
    const issues = validateNormalized(normalized, opts);
    const status = issues.some((i) => i.level === "error") ? "invalid" : "valid";
    return { rowIndex, raw, normalized, issues, status };
  });
  return detectDuplicates(rows, opts);
}

// ── Preview / statistics ────────────────────────────────────────────────
export interface ImportPreview {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  warnings: number;
  errors: number;
  programs: string[];
  certifications: string[];
  aircraft: string[];
  subjects: string[];
  topics: string[];
  first20: NormalizedRow[];
}

export function buildPreview(rows: NormalizedRow[]): ImportPreview {
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  return {
    total: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    warnings: rows.reduce((n, r) => n + r.issues.filter((i) => i.level === "warning").length, 0),
    errors: rows.reduce((n, r) => n + r.issues.filter((i) => i.level === "error").length, 0),
    programs: uniq(rows.map((r) => r.normalized.programId)),
    certifications: uniq(rows.map((r) => r.normalized.certificationId)),
    aircraft: uniq(rows.map((r) => r.normalized.aircraftId)),
    subjects: uniq(rows.map((r) => r.normalized.subjectId ?? null)),
    topics: uniq(rows.map((r) => r.normalized.topicId ?? null)),
    first20: rows.slice(0, 20),
  };
}
