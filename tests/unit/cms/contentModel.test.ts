// Phase 7 — Unit tests for contentModel.ts pure functions.
// No DB, no React. Vitest (run via `npm test`).

import { describe, expect, it } from "vitest";
import {
  buildContentTree,
  chunk,
  diffSnapshot,
  flattenTree,
  hasBlockingErrors,
  mergeSearchResults,
  normalizedHash,
  searchContent,
  validateHierarchyAssignment,
  validateNode,
  validateQuestion,
  type ContentData,
} from "../../../src/lib/cms/contentModel";

// ── normalizedHash ────────────────────────────────────────────────────────

describe("normalizedHash", () => {
  it("is deterministic", () => {
    expect(normalizedHash("hello world")).toBe(normalizedHash("hello world"));
  });
  it("ignores case and whitespace", () => {
    expect(normalizedHash("  Hello  WORLD  ")).toBe(normalizedHash("hello world"));
  });
  it("returns 8-char hex", () => {
    expect(normalizedHash("test")).toMatch(/^[0-9a-f]{8}$/);
  });
  it("differs for distinct strings", () => {
    expect(normalizedHash("foo")).not.toBe(normalizedHash("bar"));
  });
});

// ── chunk ────────────────────────────────────────────────────────────────

describe("chunk", () => {
  it("splits evenly", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
  it("handles remainder", () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
  it("handles size > array length", () => {
    expect(chunk([1], 5)).toEqual([[1]]);
  });
  it("throws on zero size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
  it("empty array returns empty", () => {
    expect(chunk([], 2)).toEqual([]);
  });
});

// ── validateQuestion ─────────────────────────────────────────────────────

describe("validateQuestion", () => {
  const valid = {
    prompt: "What is the correct answer?",
    choices: [{ id: "a", label: "Option A" }, { id: "b", label: "Option B" }],
    correct: "a",
    explanation: "Because A is correct.",
    subjectId: "subj-1",
    subcategoryId: "mod-1",  // prevents "no module/topic" warning
  };

  it("passes a valid draft", () => {
    expect(validateQuestion(valid)).toHaveLength(0);
  });

  it("errors on missing prompt", () => {
    const issues = validateQuestion({ ...valid, prompt: "" });
    expect(issues.some((i) => i.field === "prompt" && i.level === "error")).toBe(true);
  });

  it("errors on fewer than 2 choices", () => {
    const issues = validateQuestion({ ...valid, choices: [{ id: "a", label: "A" }] });
    expect(issues.some((i) => i.field === "choices")).toBe(true);
  });

  it("errors on missing correct", () => {
    const issues = validateQuestion({ ...valid, correct: null });
    expect(issues.some((i) => i.field === "correct")).toBe(true);
  });

  it("errors when correct doesn't match any choice id", () => {
    const issues = validateQuestion({ ...valid, correct: "z" });
    expect(issues.some((i) => i.field === "correct")).toBe(true);
  });

  it("errors on missing explanation", () => {
    const issues = validateQuestion({ ...valid, explanation: "" });
    expect(issues.some((i) => i.field === "explanation")).toBe(true);
  });

  it("errors on missing subjectId", () => {
    const issues = validateQuestion({ ...valid, subjectId: null });
    expect(issues.some((i) => i.field === "subjectId")).toBe(true);
  });

  it("warns on no module/topic but doesn't block", () => {
    const issues = validateQuestion({ ...valid, subcategoryId: null, topicId: null });
    const warn = issues.find((i) => i.field === "module");
    expect(warn?.level).toBe("warning");
  });

  it("errors on duplicate slug", () => {
    const issues = validateQuestion({ ...valid, slug: "q-1" }, { existingSlugs: new Set(["q-1"]) });
    expect(issues.some((i) => i.field === "slug")).toBe(true);
  });

  it("warns on duplicate prompt hash", () => {
    const hash = normalizedHash(valid.prompt);
    const issues = validateQuestion(valid, { existingHashes: new Set([hash]) });
    expect(issues.some((i) => i.field === "prompt" && i.level === "warning")).toBe(true);
  });
});

// ── hasBlockingErrors ────────────────────────────────────────────────────

describe("hasBlockingErrors", () => {
  it("true when error present", () => {
    expect(hasBlockingErrors([{ level: "error", field: "x", message: "bad" }])).toBe(true);
  });
  it("false for warnings only", () => {
    expect(hasBlockingErrors([{ level: "warning", field: "x", message: "hmm" }])).toBe(false);
  });
  it("false for empty", () => {
    expect(hasBlockingErrors([])).toBe(false);
  });
});

// ── validateNode ─────────────────────────────────────────────────────────

describe("validateNode", () => {
  it("passes valid node", () => {
    expect(validateNode({ type: "subject", title: "Met", slug: "met" })).toHaveLength(0);
  });
  it("errors on missing title", () => {
    const issues = validateNode({ type: "subject", title: "", slug: "met" });
    expect(issues.some((i) => i.field === "title")).toBe(true);
  });
  it("errors on duplicate slug", () => {
    const issues = validateNode(
      { type: "subject", title: "Met", slug: "met" },
      { existingSlugs: new Set(["met"]) },
    );
    expect(issues.some((i) => i.field === "slug")).toBe(true);
  });
  it("no error if selfSlug matches", () => {
    const issues = validateNode(
      { type: "subject", title: "Met", slug: "met" },
      { existingSlugs: new Set(["met"]), selfSlug: "met" },
    );
    expect(issues).toHaveLength(0);
  });
});

// ── validateHierarchyAssignment ──────────────────────────────────────────

describe("validateHierarchyAssignment", () => {
  const edges = [{ parent: "p1", child: "c1" }];

  it("passes valid new edge", () => {
    expect(validateHierarchyAssignment("program>certification", "p2", "c2", edges)).toHaveLength(0);
  });
  it("errors on self-reference", () => {
    const issues = validateHierarchyAssignment("subject>module", "x", "x", []);
    expect(issues.some((i) => i.message.includes("Self-reference"))).toBe(true);
  });
  it("errors on duplicate", () => {
    const issues = validateHierarchyAssignment("program>certification", "p1", "c1", edges);
    expect(issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });
  it("errors on cycle", () => {
    // p→c, now try c→p (cycle)
    const issues = validateHierarchyAssignment("program>certification", "c1", "p1", edges);
    expect(issues.some((i) => i.message.includes("Cycle"))).toBe(true);
  });
});

// ── buildContentTree ─────────────────────────────────────────────────────

describe("buildContentTree", () => {
  const data: ContentData = {
    programs: [{ id: "prog1", title: "DGCA CPL", status: "published", sort_order: 1 }],
    certifications: [{ id: "cert1", title: "CPL", status: "published" }],
    aircraft: [],
    subjects: [{ id: "s1", title: "Meteorology", status: "published" }],
    modules: [{ id: "m1", title: "Clouds", status: "published" }],
    topics: [{ id: "t1", slug: "t1", title: "Cloud types", status: "published" }],
    questionGroups: [],
    edges: {
      programCert: [{ parent: "prog1", child: "cert1" }],
      certAircraft: [],
      courseSubject: [{ parent: "cert1", child: "s1" }],
      subjectModule: [{ parent: "s1", child: "m1" }],
      moduleTopic: [{ parent: "m1", child: "t1" }],
      topicGroup: [],
    },
  };

  it("builds tree root = programs", () => {
    const tree = buildContentTree(data);
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe("program");
  });

  it("nests cert under program", () => {
    const tree = buildContentTree(data);
    expect(tree[0].children[0].type).toBe("certification");
  });

  it("nests topic 3 levels deep", () => {
    const tree = buildContentTree(data);
    const cert = tree[0].children[0];
    const subj = cert.children.find((n) => n.type === "subject")!;
    const mod  = subj.children[0];
    const top  = mod.children[0];
    expect(top.type).toBe("topic");
    expect(top.title).toBe("Cloud types");
  });

  it("flattenTree gives all nodes", () => {
    const tree = buildContentTree(data);
    const flat = flattenTree(tree);
    expect(flat.map((n) => n.type)).toContain("topic");
    expect(flat.length).toBe(5); // prog, cert, subj, mod, topic
  });
});

// ── searchContent ────────────────────────────────────────────────────────

describe("searchContent", () => {
  const tree = buildContentTree({
    programs: [{ id: "p1", title: "DGCA CPL", status: "published" }],
    certifications: [],
    aircraft: [],
    subjects: [],
    modules: [],
    topics: [],
    questionGroups: [],
    edges: { programCert: [], certAircraft: [], courseSubject: [], subjectModule: [], moduleTopic: [], topicGroup: [] },
  });

  it("finds by title substring", () => {
    const results = searchContent(tree, "dgca");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("DGCA");
  });

  it("returns empty for no match", () => {
    expect(searchContent(tree, "zzzzzz")).toHaveLength(0);
  });

  it("returns empty for blank query", () => {
    expect(searchContent(tree, "  ")).toHaveLength(0);
  });
});

// ── diffSnapshot ─────────────────────────────────────────────────────────

describe("diffSnapshot", () => {
  it("returns changed fields", () => {
    const diff = diffSnapshot({ a: 1, b: "x" }, { a: 2, b: "x" });
    expect(diff).toEqual(["a"]);
  });
  it("returns empty when identical", () => {
    expect(diffSnapshot({ a: 1 }, { a: 1 })).toHaveLength(0);
  });
  it("includes newly added keys", () => {
    const diff = diffSnapshot({ a: 1 }, { a: 1, b: 2 });
    expect(diff).toContain("b");
  });
  it("handles undefined/null gracefully", () => {
    expect(() => diffSnapshot({}, {})).not.toThrow();
  });
});

// ── mergeSearchResults ───────────────────────────────────────────────────

describe("mergeSearchResults", () => {
  const r1 = [{ id: "a", type: "subject" as const, title: "A", slug: "a", status: "published" }];
  const r2 = [
    { id: "a", type: "subject" as const, title: "A", slug: "a", status: "published" },
    { id: "b", type: "topic" as const, title: "B", slug: "b", status: "draft" },
  ];

  it("de-dupes by type:id", () => {
    const merged = mergeSearchResults(r1, r2);
    expect(merged.length).toBe(2);
  });

  it("preserves order (first seen wins)", () => {
    const merged = mergeSearchResults(r1, r2);
    expect(merged[0].id).toBe("a");
  });
});
