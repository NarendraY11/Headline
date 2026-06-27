import { describe, it, expect } from "vitest";
import {
  chunk,
  validateHierarchyAssignment,
  mergeSearchResults,
  hasBlockingErrors,
  type SearchResult,
} from "../../src/lib/cms/contentModel";

describe("chunk (bulk safety)", () => {
  it("splits into max-size chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
    expect(chunk([1], 10)).toEqual([[1]]);
  });
  it("throws on non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("validateHierarchyAssignment", () => {
  const kind = "subject>module" as const;

  it("accepts a valid new edge", () => {
    expect(validateHierarchyAssignment(kind, "subj", "mod", [])).toEqual([]);
  });

  it("rejects self-reference", () => {
    const issues = validateHierarchyAssignment(kind, "x", "x", []);
    expect(hasBlockingErrors(issues)).toBe(true);
    expect(issues[0].message).toMatch(/self/i);
  });

  it("rejects duplicate relationship", () => {
    const issues = validateHierarchyAssignment(kind, "a", "b", [{ parent: "a", child: "b" }]);
    expect(issues.some((i) => /duplicate/i.test(i.message))).toBe(true);
  });

  it("detects a cycle", () => {
    // existing: b→c, c→a ; adding a→b closes the loop a→b→c→a
    const edges = [{ parent: "b", child: "c" }, { parent: "c", child: "a" }];
    const issues = validateHierarchyAssignment(kind, "a", "b", edges);
    expect(issues.some((i) => /cycle/i.test(i.message))).toBe(true);
  });

  it("does NOT false-positive a cycle on an acyclic add", () => {
    const edges = [{ parent: "a", child: "b" }];
    const issues = validateHierarchyAssignment(kind, "b", "c", edges);
    expect(issues).toEqual([]);
  });

  it("rejects unknown relation kind", () => {
    const issues = validateHierarchyAssignment("nope" as any, "a", "b", []);
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it("requires both ids", () => {
    expect(hasBlockingErrors(validateHierarchyAssignment(kind, "", "b", []))).toBe(true);
    expect(hasBlockingErrors(validateHierarchyAssignment(kind, "a", "", []))).toBe(true);
  });
});

describe("mergeSearchResults", () => {
  const a: SearchResult[] = [{ id: "1", type: "subject", title: "Nav", slug: "nav", status: "published" }];
  const b: SearchResult[] = [
    { id: "1", type: "subject", title: "Nav", slug: "nav", status: "published" }, // dup
    { id: "q1", type: "question", title: "Q", slug: "q1", status: "draft" },
  ];
  it("dedupes by type:id across lists", () => {
    const merged = mergeSearchResults(a, b);
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => `${r.type}:${r.id}`).sort()).toEqual(["question:q1", "subject:1"]);
  });
  it("keeps same id across different types", () => {
    const merged = mergeSearchResults(
      [{ id: "x", type: "topic", title: "t", slug: "x", status: "draft" }],
      [{ id: "x", type: "module", title: "m", slug: "x", status: "draft" }],
    );
    expect(merged).toHaveLength(2);
  });
});
