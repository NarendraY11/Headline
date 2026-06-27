import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseJson,
  parseContent,
  detectType,
  isParserAvailable,
  registerParser,
  ParserUnavailableError,
} from "../../src/lib/import/parsers";

// ── parseCsv ──────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses basic CSV", () => {
    const { rows, warnings } = parseCsv("prompt,correct\nWhat is lift?,a\nWhat is drag?,b");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ prompt: "What is lift?", correct: "a" });
    expect(warnings).toHaveLength(0);
  });

  it("handles quoted fields with commas", () => {
    const { rows } = parseCsv(`prompt,explanation\n"What, exactly, is VOR?","Navigation aid, UHF band"`);
    expect(rows[0].prompt).toBe("What, exactly, is VOR?");
    expect(rows[0].explanation).toBe("Navigation aid, UHF band");
  });

  it("handles escaped quotes (\"\")", () => {
    const { rows } = parseCsv(`prompt\n"He said ""correct"" answer"`);
    expect(rows[0].prompt).toBe(`He said "correct" answer`);
  });

  it("handles CRLF line endings", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(rows).toHaveLength(2);
    expect(rows[1].a).toBe("3");
  });

  it("strips BOM", () => {
    const { rows } = parseCsv("﻿prompt,correct\nQ1?,a");
    expect(rows[0].prompt).toBe("Q1?");
  });

  it("returns warning for mismatched column count", () => {
    const { warnings } = parseCsv("a,b,c\n1,2");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/Row 2/);
  });

  it("returns empty rows for empty CSV", () => {
    const { rows, warnings } = parseCsv("");
    expect(rows).toHaveLength(0);
    expect(warnings[0]).toMatch(/Empty/i);
  });

  it("skips blank lines", () => {
    const { rows } = parseCsv("a,b\n1,2\n\n3,4");
    expect(rows).toHaveLength(2);
  });

  it("trims header whitespace", () => {
    const { rows } = parseCsv(" prompt , correct \nQ?,a");
    expect("prompt" in rows[0]).toBe(true);
    expect("correct" in rows[0]).toBe(true);
  });
});

// ── parseJson ─────────────────────────────────────────────────────────

describe("parseJson", () => {
  it("parses a plain array", () => {
    const { rows } = parseJson('[{"prompt":"Q1","correct":"a"}]');
    expect(rows).toHaveLength(1);
    expect(rows[0].prompt).toBe("Q1");
  });

  it("accepts {questions:[]} wrapper", () => {
    const { rows } = parseJson('{"questions":[{"prompt":"Q2","correct":"b"}]}');
    expect(rows[0].prompt).toBe("Q2");
  });

  it("accepts {rows:[]} wrapper", () => {
    const { rows } = parseJson('{"rows":[{"prompt":"Q3"}]}');
    expect(rows[0].prompt).toBe("Q3");
  });

  it("accepts {items:[]} wrapper", () => {
    const { rows } = parseJson('{"items":[{"prompt":"Q4"}]}');
    expect(rows[0].prompt).toBe("Q4");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJson("{broken}")).toThrow(/Invalid JSON/);
  });

  it("throws when result is not an array", () => {
    expect(() => parseJson('{"foo":"bar"}')).toThrow(/array/);
  });

  it("returns empty warnings array", () => {
    const { warnings } = parseJson("[]");
    expect(warnings).toHaveLength(0);
  });
});

// ── detectType ────────────────────────────────────────────────────────

describe("detectType", () => {
  it.each([
    ["questions.csv", "csv"],
    ["data.tsv", "csv"],
    ["bank.json", "json"],
    ["sheet.xlsx", "xlsx"],
    ["doc.docx", "docx"],
    ["notes.pdf", "pdf"],
    ["scan.png", "image"],
    ["photo.jpg", "image"],
    ["text.txt", "ai_text"],
  ])("detects %s → %s", (name, expected) => {
    expect(detectType(name)).toBe(expected);
  });

  it("returns null for unknown extension", () => {
    expect(detectType("archive.zip")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectType("DATA.CSV")).toBe("csv");
    expect(detectType("bank.JSON")).toBe("json");
  });
});

// ── isParserAvailable / parseContent ─────────────────────────────────

describe("isParserAvailable", () => {
  it("returns true for csv and json", () => {
    expect(isParserAvailable("csv")).toBe(true);
    expect(isParserAvailable("json")).toBe(true);
  });

  it("returns false for unavailable parsers", () => {
    expect(isParserAvailable("xlsx")).toBe(false);
    expect(isParserAvailable("pdf")).toBe(false);
    expect(isParserAvailable("docx")).toBe(false);
    expect(isParserAvailable("image")).toBe(false);
    expect(isParserAvailable("ai_text")).toBe(false);
  });
});

describe("parseContent", () => {
  it("parses csv via type dispatch", () => {
    const { rows } = parseContent("csv", "prompt\nQ1");
    expect(rows[0].prompt).toBe("Q1");
  });

  it("parses json via type dispatch", () => {
    const { rows } = parseContent("json", '[{"prompt":"Q2"}]');
    expect(rows[0].prompt).toBe("Q2");
  });

  it("throws ParserUnavailableError for xlsx", () => {
    expect(() => parseContent("xlsx", "data")).toThrow(ParserUnavailableError);
  });

  it("thrown error contains the format name", () => {
    try { parseContent("pdf", "data"); }
    catch (e) { expect((e as Error).message).toMatch(/pdf/i); }
  });
});

// ── registerParser (pluggable registry) ──────────────────────────────

describe("registerParser", () => {
  it("registers a custom parser and makes it available", () => {
    registerParser("ai_text", (text) => ({ rows: [{ prompt: text.trim() }], warnings: [] }));
    expect(isParserAvailable("ai_text")).toBe(true);
    const { rows } = parseContent("ai_text", "  Custom Q  ");
    expect(rows[0].prompt).toBe("Custom Q");
  });
});
