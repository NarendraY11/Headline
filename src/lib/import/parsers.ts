// =====================================================================
// PHASE 4 — Import parsers (pure). Format → array of raw row objects.
//
// CSV + JSON are fully implemented (no dependencies). XLSX / DOCX / PDF /
// image / ai_text are registered as PLUGGABLE parsers that currently report
// "not available" — the pipeline + registry exist so binary/OCR/AI parsers
// drop in later without touching callers (per Phase 4 scope: infra only).
// =====================================================================

export type ImportType = "csv" | "xlsx" | "json" | "docx" | "pdf" | "image" | "ai_text";

export interface RawRow { [key: string]: string | number | boolean | null | undefined | unknown }

export interface ParseResult {
  rows: RawRow[];
  warnings: string[];
}

export class ParserUnavailableError extends Error {
  constructor(type: ImportType) {
    super(`Parser for "${type}" is not available yet (binary/OCR/AI parsing is a later phase). Use CSV or JSON.`);
    this.name = "ParserUnavailableError";
  }
}

// ── CSV ───────────────────────────────────────────────────────────────
/** RFC-4180-ish CSV tokenizer: handles quoted fields, escaped quotes (""),
 *  commas and newlines inside quotes, CRLF/LF. Pure, streaming-safe. */
export function parseCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.length > 1 || record[0] !== "") records.push(record);
      record = [];
    } else field += c;
  }
  if (field !== "" || record.length) { record.push(field); records.push(record); }

  if (records.length === 0) return { rows: [], warnings: ["Empty CSV."] };
  const header = records[0].map((h) => h.trim());
  const rows: RawRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    if (cells.length === 1 && cells[0] === "") continue; // blank line
    if (cells.length !== header.length) {
      warnings.push(`Row ${r + 1}: expected ${header.length} columns, got ${cells.length}.`);
    }
    const obj: RawRow = {};
    header.forEach((h, idx) => { obj[h] = cells[idx] ?? ""; });
    rows.push(obj);
  }
  return { rows, warnings };
}

// ── JSON ──────────────────────────────────────────────────────────────
/** Accepts an array of objects, or { questions: [...] } / { rows: [...] }. */
export function parseJson(text: string): ParseResult {
  let data: unknown;
  try { data = JSON.parse(text); }
  catch (e: any) { throw new Error(`Invalid JSON: ${e?.message ?? "parse error"}`); }
  let arr: unknown;
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === "object") arr = (data as any).questions ?? (data as any).rows ?? (data as any).items;
  if (!Array.isArray(arr)) throw new Error("JSON must be an array, or an object with a questions/rows/items array.");
  return { rows: arr as RawRow[], warnings: [] };
}

// ── Parser registry (pluggable) ──────────────────────────────────────
type Parser = (text: string) => ParseResult;

const PARSERS: Partial<Record<ImportType, Parser>> = {
  csv: parseCsv,
  json: parseJson,
  // xlsx/docx/pdf/image/ai_text intentionally absent → unavailable for now.
};

export function isParserAvailable(type: ImportType): boolean {
  return !!PARSERS[type];
}

/** Register a parser for a format later (binary/OCR/AI) without editing callers. */
export function registerParser(type: ImportType, parser: Parser): void {
  PARSERS[type] = parser;
}

export function parseContent(type: ImportType, text: string): ParseResult {
  const p = PARSERS[type];
  if (!p) throw new ParserUnavailableError(type);
  return p(text);
}

/** Best-effort format detection from a filename extension. */
export function detectType(fileName: string): ImportType | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, ImportType> = {
    csv: "csv", tsv: "csv", json: "json", xlsx: "xlsx", xls: "xlsx",
    docx: "docx", pdf: "pdf", png: "image", jpg: "image", jpeg: "image", txt: "ai_text",
  };
  return map[ext] ?? null;
}
