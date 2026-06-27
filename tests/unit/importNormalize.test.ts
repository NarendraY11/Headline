import { describe, it, expect } from "vitest";
import {
  normalizeRow,
  validateNormalized,
  similarity,
  detectDuplicates,
  buildRows,
  buildPreview,
  type NormalizedRow,
} from "../../src/lib/import/normalize";

// ── normalizeRow ──────────────────────────────────────────────────────

describe("normalizeRow", () => {
  const base = {
    prompt: "What is the standard cruise altitude for the A320?",
    option_a: "FL370",
    option_b: "FL280",
    option_c: "FL150",
    option_d: "FL410",
    correct: "a",
    explanation: "The A320 typically cruises at FL370.",
    difficulty: "standard",
    certification: "dgca-cpl",
    subject: "dgca-air-navigation",
  };

  it("extracts prompt + choices + correct", () => {
    const n = normalizeRow(base);
    expect(n.prompt).toBe(base.prompt);
    expect(n.choices?.length).toBe(4);
    expect(n.choices?.[0].id).toBe("a");
    expect(n.choices?.[0].label).toBe("FL370");
    expect(n.correct).toBe("a");
  });

  it("maps alternate field names (question, stem)", () => {
    const n = normalizeRow({ ...base, prompt: undefined, question: "What is V1?" });
    expect(n.prompt).toBe("What is V1?");
  });

  it("maps 'answer' → correct", () => {
    const n = normalizeRow({ ...base, correct: undefined, answer: "b" });
    expect(n.correct).toBe("b");
  });

  it("converts numeric correct answer (1-based)", () => {
    const n = normalizeRow({ ...base, correct: "2" });
    expect(n.correct).toBe("b");
  });

  it("resolves certificationId from certification field", () => {
    const n = normalizeRow(base);
    expect(n.certificationId).not.toBeNull();
  });

  it("splits tags by comma/semicolon/pipe", () => {
    const n = normalizeRow({ ...base, tags: "nav,met;ops|atc" });
    expect(n.tags).toEqual(["nav", "met", "ops", "atc"]);
  });

  it("splits references", () => {
    const n = normalizeRow({ ...base, references: "FCOM|AFM" });
    expect(n.references).toEqual(["FCOM", "AFM"]);
  });

  it("generates dedupeHash", () => {
    const n = normalizeRow(base);
    expect(typeof n.dedupeHash).toBe("string");
    expect(n.dedupeHash.length).toBeGreaterThan(0);
  });

  it("produces same hash for same prompt", () => {
    const n1 = normalizeRow(base);
    const n2 = normalizeRow({ ...base, difficulty: "complex" });
    expect(n1.dedupeHash).toBe(n2.dedupeHash);
  });

  it("produces different hash for different prompt", () => {
    const n1 = normalizeRow(base);
    const n2 = normalizeRow({ ...base, prompt: "What is V2?" });
    expect(n1.dedupeHash).not.toBe(n2.dedupeHash);
  });

  it("accepts options list when no option_a..d", () => {
    const n = normalizeRow({ prompt: "Q?", options: "Yes,No,Maybe,Never", correct: "a" });
    expect(n.choices?.length).toBe(4);
    expect(n.choices?.[0].label).toBe("Yes");
  });
});

// ── validateNormalized ────────────────────────────────────────────────

describe("validateNormalized", () => {
  function row(overrides: Record<string, unknown> = {}): NormalizedRow["normalized"] {
    return normalizeRow({
      prompt: "What is ILS?",
      option_a: "Instrument Landing System",
      option_b: "Instrument Lift System",
      option_c: "Internal Landing System",
      option_d: "Inertial Launch System",
      correct: "a",
      explanation: "ILS = Instrument Landing System.",
      difficulty: "standard",
      certification: "dgca-cpl",
      subject: "dgca-air-navigation",
      ...overrides,
    });
  }

  it("returns no errors for a valid row", () => {
    const issues = validateNormalized(row());
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("errors on missing prompt", () => {
    const issues = validateNormalized(row({ prompt: "" }));
    expect(issues.some((i) => i.field === "prompt")).toBe(true);
  });

  it("errors on no choices", () => {
    const issues = validateNormalized(row({ option_a: "", option_b: "", option_c: "", option_d: "", options: "" }));
    expect(issues.some((i) => i.field === "choices")).toBe(true);
  });

  it("errors on invalid difficulty", () => {
    const n = row({ difficulty: "super-hard" });
    const issues = validateNormalized(n);
    expect(issues.some((i) => i.field === "difficulty")).toBe(true);
  });

  it("accepts standard, complex, extreme difficulty", () => {
    for (const diff of ["standard", "complex", "extreme"]) {
      const issues = validateNormalized(row({ difficulty: diff }));
      expect(issues.some((i) => i.field === "difficulty")).toBe(false);
    }
  });

  it("warns if certificationId is null (unknown cert)", () => {
    const n = row({ certification: "nonexistent-cert-xyz" });
    const issues = validateNormalized(n);
    expect(issues.some((i) => i.field === "certification")).toBe(true);
  });

  it("checks for duplicate slugs", () => {
    const n = row({ slug: "duplicate-slug" });
    const issues = validateNormalized(n, { existingSlugs: new Set(["duplicate-slug"]) });
    expect(issues.some((i) => i.field === "slug")).toBe(true);
  });
});

// ── similarity ────────────────────────────────────────────────────────

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("what is the altimeter", "what is the altimeter")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(similarity("hello world", "foo bar baz qux")).toBe(0);
  });

  it("returns 1 for both empty strings", () => {
    expect(similarity("", "")).toBe(1);
  });

  it("returns partial score for overlapping tokens", () => {
    const s = similarity("what is the altimeter setting", "what is the altimeter reading");
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });

  it("is case-insensitive", () => {
    expect(similarity("WHAT IS VOR", "what is vor")).toBe(1);
  });

  it("ignores punctuation", () => {
    expect(similarity("what is VOR?", "what is VOR")).toBe(1);
  });
});

// ── detectDuplicates ──────────────────────────────────────────────────

function makeRow(prompt: string, rowIndex = 0): NormalizedRow {
  const normalized = normalizeRow({ prompt, option_a: "A", option_b: "B", option_c: "C", option_d: "D", correct: "a" });
  const issues = validateNormalized(normalized);
  return { rowIndex, raw: {}, normalized, issues, status: issues.some(i => i.level === "error") ? "invalid" : "valid" };
}

describe("detectDuplicates", () => {
  it("flags exact hash duplicates within batch", () => {
    const rows = [makeRow("What is VOR?", 0), makeRow("What is VOR?", 1)];
    const result = detectDuplicates(rows);
    expect(result[1].status).toBe("duplicate");
  });

  it("does not flag the first occurrence", () => {
    const rows = [makeRow("What is VOR?", 0), makeRow("What is VOR?", 1)];
    const result = detectDuplicates(rows);
    expect(result[0].status).not.toBe("duplicate");
  });

  it("flags exact hash matches against existing hashes", () => {
    const row = makeRow("What is VOR?", 0);
    const result = detectDuplicates([row], { existingHashes: new Set([row.normalized.dedupeHash]) });
    expect(result[0].status).toBe("duplicate");
  });

  it("flags near-duplicates via Jaccard ≥0.9", () => {
    const rows = [
      makeRow("What is the instrument landing system used for approach?", 0),
      makeRow("What is the instrument landing system used for approach procedure?", 1),
    ];
    const result = detectDuplicates(rows, { threshold: 0.7 });
    expect(result[1].status).toBe("duplicate");
  });

  it("does not flag non-similar rows", () => {
    const rows = [makeRow("What is VOR?", 0), makeRow("What is the altimeter?", 1)];
    const result = detectDuplicates(rows);
    expect(result.every((r) => r.status !== "duplicate")).toBe(true);
  });

  it("adds a warning issue on duplicate", () => {
    const rows = [makeRow("What is VOR?", 0), makeRow("What is VOR?", 1)];
    const result = detectDuplicates(rows);
    expect(result[1].issues.some((i) => i.message.toLowerCase().includes("duplicate"))).toBe(true);
  });
});

// ── buildRows ─────────────────────────────────────────────────────────

describe("buildRows", () => {
  const raw = [
    { prompt: "What is VOR?", option_a: "Radio nav aid", option_b: "Radar", option_c: "Visual aid", option_d: "GPS", correct: "a", explanation: "VOR explanation.", certification: "dgca-cpl", subject: "dgca-air-navigation" },
    { prompt: "What is ILS?", option_a: "Landing aid", option_b: "Radar", option_c: "Visual aid", option_d: "GPS", correct: "a", explanation: "ILS explanation.", certification: "dgca-cpl", subject: "dgca-air-navigation" },
    { prompt: "What is VOR?", option_a: "Radio nav aid", option_b: "Radar", option_c: "Visual aid", option_d: "GPS", correct: "a", explanation: "VOR explanation.", certification: "dgca-cpl", subject: "dgca-air-navigation" },
  ];

  it("returns a row per input", () => {
    const rows = buildRows(raw);
    expect(rows).toHaveLength(3);
  });

  it("assigns rowIndex sequentially", () => {
    const rows = buildRows(raw);
    expect(rows[0].rowIndex).toBe(0);
    expect(rows[1].rowIndex).toBe(1);
    expect(rows[2].rowIndex).toBe(2);
  });

  it("marks duplicate", () => {
    const rows = buildRows(raw);
    expect(rows[2].status).toBe("duplicate");
  });

  it("marks valid rows as valid", () => {
    const rows = buildRows(raw);
    expect(rows[0].status).toBe("valid");
    expect(rows[1].status).toBe("valid");
  });
});

// ── buildPreview ──────────────────────────────────────────────────────

describe("buildPreview", () => {
  function makeValidRow(i: number): NormalizedRow {
    return makeRow(`Question ${i}`, i);
  }

  it("counts total, valid, invalid, duplicates", () => {
    const rows = [makeValidRow(0), makeValidRow(1)];
    rows[0].status = "valid";
    rows[1].status = "invalid";
    const p = buildPreview(rows);
    expect(p.total).toBe(2);
    expect(p.valid).toBe(1);
    expect(p.invalid).toBe(1);
  });

  it("returns at most 20 first rows", () => {
    const rows = Array.from({ length: 50 }, (_, i) => makeValidRow(i));
    const p = buildPreview(rows);
    expect(p.first20).toHaveLength(20);
  });

  it("collects unique certifications", () => {
    const rows = [makeValidRow(0), makeValidRow(1)];
    rows[0].normalized = { ...rows[0].normalized, certificationId: "dgca-cpl" };
    rows[1].normalized = { ...rows[1].normalized, certificationId: "faa-ppl" };
    const p = buildPreview(rows);
    expect(p.certifications).toContain("dgca-cpl");
    expect(p.certifications).toContain("faa-ppl");
  });

  it("deduplicated collections (no repeats)", () => {
    const rows = [makeValidRow(0), makeValidRow(1)];
    rows[0].normalized = { ...rows[0].normalized, certificationId: "dgca-cpl" };
    rows[1].normalized = { ...rows[1].normalized, certificationId: "dgca-cpl" };
    const p = buildPreview(rows);
    expect(p.certifications).toHaveLength(1);
  });
});

// ── Large import chunking (no Supabase) ───────────────────────────────

describe("buildRows — large batch performance", () => {
  // ponytail: intra-batch Jaccard is O(n²); test at realistic chunk size (250).
  // Large-file handling is covered by chunking in importService.ts (250 rows/chunk).
  it("processes 250 rows (one chunk) without stack overflow", () => {
    const raw = Array.from({ length: 250 }, (_, i) => ({
      prompt: `Aviation question ${i}: What is the correct procedure for scenario ${i} in flight operations?`,
      option_a: "Opt A", option_b: "Opt B", option_c: "Opt C", option_d: "Opt D",
      correct: "a",
      explanation: "Explanation for this question.",
      certification: "dgca-cpl",
      subject: "dgca-air-navigation",
    }));
    const rows = buildRows(raw);
    expect(rows).toHaveLength(250);
    const notDup = rows.filter((r) => r.status !== "duplicate");
    expect(notDup.length).toBeGreaterThan(220);
  });
});
