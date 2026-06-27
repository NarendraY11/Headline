import { describe, it, expect } from "vitest";
import {
  buildContentTree,
  flattenTree,
  searchContent,
  validateQuestion,
  validateNode,
  hasBlockingErrors,
  normalizedHash,
  diffSnapshot,
  buildVersionRecord,
  type ContentData,
} from "../../src/lib/cms/contentModel";

function node(id: string, title: string, status: any = "published") {
  return { id, slug: id, title, status, sort_order: 0 };
}

const data: ContentData = {
  programs: [node("dgca", "DGCA")],
  certifications: [node("dgca-cpl", "DGCA CPL")],
  aircraft: [node("a320", "A320")],
  subjects: [node("nav", "Air Navigation")],
  modules: [node("nav-charts", "Charts")],
  topics: [node("rhumb", "Rhumb lines")],
  questionGroups: [node("grp1", "Group 1")],
  edges: {
    programCert: [{ parent: "dgca", child: "dgca-cpl" }],
    certAircraft: [{ parent: "dgca-cpl", child: "a320" }],
    courseSubject: [{ parent: "dgca-cpl", child: "nav" }],
    subjectModule: [{ parent: "nav", child: "nav-charts" }],
    moduleTopic: [{ parent: "nav-charts", child: "rhumb" }],
    topicGroup: [{ parent: "rhumb", child: "grp1" }],
  },
};

describe("buildContentTree", () => {
  it("assembles the full Program→…→Group hierarchy", () => {
    const tree = buildContentTree(data);
    expect(tree).toHaveLength(1);
    const program = tree[0];
    expect(program.type).toBe("program");
    const cert = program.children.find((c) => c.type === "certification")!;
    expect(cert.id).toBe("dgca-cpl");
    // cert has both aircraft + subject children
    expect(cert.children.map((c) => c.type).sort()).toEqual(["aircraft", "subject"]);
    const subject = cert.children.find((c) => c.type === "subject")!;
    const mod = subject.children[0];
    const topic = mod.children[0];
    expect(topic.id).toBe("rhumb");
    expect(topic.children[0].type).toBe("question_group");
  });

  it("flattenTree counts every node", () => {
    const all = flattenTree(buildContentTree(data));
    // program, cert, aircraft, subject, module, topic, group = 7
    expect(all).toHaveLength(7);
  });

  it("does not attach orphan edges", () => {
    const d = { ...data, edges: { ...data.edges, courseSubject: [{ parent: "missing", child: "nav" }] } };
    const tree = buildContentTree(d);
    const cert = tree[0].children[0];
    expect(cert.children.some((c) => c.type === "subject")).toBe(false);
  });
});

describe("searchContent", () => {
  it("finds nodes by title/type/status; empty query → none", () => {
    const tree = buildContentTree(data);
    expect(searchContent(tree, "")).toEqual([]);
    expect(searchContent(tree, "rhumb").map((r) => r.id)).toContain("rhumb");
    expect(searchContent(tree, "certification").map((r) => r.type)).toContain("certification");
    expect(searchContent(tree, "DGCA").length).toBeGreaterThan(0);
  });
});

describe("validateQuestion", () => {
  const good = {
    prompt: "What is QNH?", choices: [{ id: "a", label: "x" }, { id: "b", label: "y" }],
    correct: "a", explanation: "because", subjectId: "nav", subcategoryId: "nav-charts",
  };
  it("passes a complete question", () => {
    expect(validateQuestion(good)).toEqual([]);
  });
  it("flags missing fields as blocking errors", () => {
    const issues = validateQuestion({ ...good, prompt: "", correct: null, explanation: "", subjectId: null });
    expect(hasBlockingErrors(issues)).toBe(true);
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(["prompt", "correct", "explanation", "subjectId"]));
  });
  it("flags correct answer not matching any option", () => {
    const issues = validateQuestion({ ...good, correct: "z" });
    expect(issues.some((i) => i.field === "correct")).toBe(true);
  });
  it("warns on duplicate slug + duplicate prompt", () => {
    const issues = validateQuestion(
      { ...good, slug: "dup" },
      { existingSlugs: new Set(["dup"]), existingHashes: new Set([normalizedHash(good.prompt)]) }
    );
    expect(issues.some((i) => i.field === "slug" && i.level === "error")).toBe(true);
    expect(issues.some((i) => i.field === "prompt" && i.level === "warning")).toBe(true);
  });
});

describe("validateNode", () => {
  it("requires title + slug; detects duplicate + broken relationship", () => {
    expect(validateNode({ type: "subject", title: "", slug: "" }).length).toBe(2);
    const dup = validateNode({ type: "topic", title: "T", slug: "t" }, { existingSlugs: new Set(["t"]) });
    expect(dup.some((i) => i.field === "slug")).toBe(true);
    const broken = validateNode({ type: "module", title: "M", slug: "m", parentId: null }, { requiresParent: true });
    expect(broken.some((i) => i.field === "parent")).toBe(true);
  });
});

describe("versioning", () => {
  it("buildVersionRecord increments version", () => {
    const r = buildVersionRecord("question", "q1", 3, { a: 1 }, "edit", "admin@x.com");
    expect(r.version).toBe(4);
    expect(r.entity_id).toBe("q1");
  });
  it("diffSnapshot lists changed fields only", () => {
    expect(diffSnapshot({ a: 1, b: 2 }, { a: 1, b: 9, c: 3 })).toEqual(["b", "c"]);
  });
  it("normalizedHash is stable + whitespace-insensitive", () => {
    expect(normalizedHash("Hello   World")).toBe(normalizedHash("hello world"));
  });
});
