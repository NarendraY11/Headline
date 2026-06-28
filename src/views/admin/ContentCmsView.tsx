// Phase 7 — Production Admin Content Management System.
// 3-panel desktop layout: Tree (left) · Content table (center) · Inspector (right).
// Gated by contentCms flag. No student-facing changes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import {
  flattenTree,
  type ContentNode,
  type EntityType,
} from "../../lib/cms/contentModel";
import {
  archiveEntities,
  bulkUpdateField,
  fetchQuestionById,
  fetchQuestionsPaginated,
  listVersions,
  loadContentTree,
  publishEntities,
  restoreEntities,
  rollbackToVersion,
  type QuestionPageOpts,
  type QuestionPage,
} from "../../lib/cms/cmsDb";
import QuestionEditor from "./cms/QuestionEditor";

// ── Types ────────────────────────────────────────────────────────────────

type CmsTab = "tree" | "questions" | "editor";

// ── Helpers ──────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const base = "inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold uppercase border";
  if (status === "published") return `${base} bg-mint/10 text-emerald-700 border-mint/30`;
  if (status === "archived") return `${base} bg-muted/10 text-muted-2 border-muted/20 line-through`;
  return `${base} bg-amber-50 text-amber-700 border-amber-200`;
}

function diffBadge(difficulty: string) {
  const base = "inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold uppercase border";
  if (difficulty === "extreme") return `${base} bg-rose-50 text-rose-700 border-rose-200`;
  if (difficulty === "complex") return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
}

// ── Tree component ────────────────────────────────────────────────────────

function Tree(props: {
  nodes: ContentNode[];
  depth?: number;
  expanded: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (n: ContentNode) => void;
  onVersions: (t: EntityType, id: string) => void;
  onFilter: (type: EntityType, id: string, title: string) => void;
  counts: Record<string, number>;
}) {
  const { nodes, depth = 0, expanded, selected, onToggle, onSelect, onVersions, onFilter, counts } = props;
  return (
    <ul
      role={depth === 0 ? "tree" : "group"}
      className={depth === 0 ? "space-y-0.5" : "ml-3 border-l border-rule/30 pl-2 space-y-0.5"}
    >
      {nodes.map((n) => {
        const open = expanded.has(n.id);
        const hasKids = n.children.length > 0 || n.type === "topic";
        const isSel = selected.has(n.id);
        const nodeCount = counts[`${n.type}:${n.id}`] ?? n.children.length;

        return (
          <li
            key={`${n.type}:${n.id}`}
            role="treeitem"
            aria-expanded={hasKids ? open : undefined}
            aria-selected={isSel}
            aria-label={`${n.type}: ${n.title} (${n.status})`}
          >
            <div
              className={`flex items-center gap-1.5 text-xs py-0.5 px-1 rounded group hover:bg-bg-2/40 ${isSel ? "bg-bg-2" : ""}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && hasKids) { e.preventDefault(); onToggle(n.id); }
                if (e.key === "ArrowRight" && hasKids && !open) onToggle(n.id);
                if (e.key === "ArrowLeft" && hasKids && open) onToggle(n.id);
              }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => onSelect(n)}
                aria-label={`Select ${n.type} ${n.title}`}
                className="shrink-0"
              />
              {hasKids ? (
                <button
                  className="w-3.5 text-[10px] opacity-60 hover:opacity-100 shrink-0"
                  onClick={() => onToggle(n.id)}
                  aria-label={open ? `Collapse ${n.title}` : `Expand ${n.title}`}
                >
                  {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              ) : <span className="w-3.5 shrink-0" />}

              <span className="text-[9px] uppercase tracking-wide opacity-40 w-16 shrink-0 font-mono">{n.type}</span>

              <span
                className={`flex-1 truncate ${
                  n.status === "archived" ? "opacity-40 line-through" :
                  n.status === "draft" ? "opacity-70" : ""
                }`}
              >
                {n.title}
              </span>

              {nodeCount > 0 && (
                <span className="text-[9px] opacity-40 font-mono shrink-0">{nodeCount}</span>
              )}

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {n.type === "topic" && (
                  <button
                    onClick={() => onFilter(n.type, n.id, n.title)}
                    className="p-0.5 rounded hover:bg-bg-2 text-muted hover:text-ink"
                    title="Filter questions to this topic"
                  >
                    <Filter size={9} />
                  </button>
                )}
                <button
                  onClick={() => onVersions(n.type, n.id)}
                  className="p-0.5 rounded hover:bg-bg-2 text-muted hover:text-ink"
                  title="Version history"
                >
                  <RefreshCw size={9} />
                </button>
              </div>
            </div>

            {open && n.children.length > 0 && (
              <Tree {...props} nodes={n.children} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  subjects,
  onChange,
  onClear,
}: {
  filters: QuestionPageOpts;
  subjects: { id: string; title: string }[];
  onChange: (patch: Partial<QuestionPageOpts>) => void;
  onClear: () => void;
}) {
  const sel = "text-xs bg-bg-2 border border-rule rounded-lg px-2 py-1.5 text-ink h-8";
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "page" && k !== "pageSize" && v !== undefined && v !== "");

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        className={sel}
        value={filters.status ?? ""}
        onChange={(e) => onChange({ status: e.target.value || undefined, page: 1 })}
      >
        <option value="">Any status</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>

      <select
        className={sel}
        value={filters.difficulty ?? ""}
        onChange={(e) => onChange({ difficulty: e.target.value || undefined, page: 1 })}
      >
        <option value="">Any difficulty</option>
        <option value="standard">Standard</option>
        <option value="complex">Complex</option>
        <option value="extreme">Extreme</option>
      </select>

      <select
        className={sel}
        value={filters.subject ?? ""}
        onChange={(e) => onChange({ subject: e.target.value || undefined, page: 1 })}
      >
        <option value="">Any subject</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>

      <select
        className={sel}
        value={filters.reviewStatus ?? ""}
        onChange={(e) => onChange({ reviewStatus: e.target.value || undefined, page: 1 })}
      >
        <option value="">Any review status</option>
        <option value="pending">Pending</option>
        <option value="in_review">In review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 px-2 py-1.5 rounded-lg"
        >
          <X size={11} />Clear
        </button>
      )}
    </div>
  );
}

// ── Bulk toolbar ─────────────────────────────────────────────────────────

function BulkToolbar({
  count,
  onPublish,
  onArchive,
  onRestore,
  onClear,
  onBulkField,
}: {
  count: number;
  onPublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onClear: () => void;
  onBulkField: (field: string, value: string) => void;
}) {
  const [fieldModal, setFieldModal] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState("");

  const fields = [
    { key: "difficulty", label: "Difficulty", options: ["standard", "complex", "extreme"] },
    { key: "review_status", label: "Review Status", options: ["pending", "in_review", "approved", "rejected"] },
    { key: "question_source", label: "Source", options: ["manual", "csv", "json", "ai"] },
    { key: "question_type", label: "Type", options: ["standalone", "scenario", "passage", "image", "case_study"] },
  ];

  function doField() {
    if (fieldModal && fieldValue) {
      onBulkField(fieldModal, fieldValue);
      setFieldModal(null);
      setFieldValue("");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <span className="text-xs font-semibold text-amber-800 font-mono">{count} selected</span>
      <div className="h-4 w-px bg-amber-200" />
      <button onClick={onPublish} className="text-xs border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded-lg">Publish</button>
      <button onClick={onArchive} className="text-xs border border-rule bg-bg-2 text-muted hover:bg-bg-2/80 px-2 py-1 rounded-lg">Archive</button>
      <button onClick={onRestore} className="text-xs border border-rule bg-bg-2 text-muted hover:bg-bg-2/80 px-2 py-1 rounded-lg">→ Draft</button>
      {fields.map((f) => (
        <button
          key={f.key}
          onClick={() => { setFieldModal(f.key); setFieldValue(""); }}
          className="flex items-center gap-1 text-xs border border-rule bg-bg-2 text-muted hover:bg-bg-2/80 px-2 py-1 rounded-lg"
        >
          <Tag size={10} />{f.label}
        </button>
      ))}
      <button onClick={onClear} className="ml-auto text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 px-2 py-1 rounded-lg"><X size={10} /></button>

      {fieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFieldModal(null)}>
          <div className="bg-paper border border-rule rounded-2xl p-5 shadow-xl min-w-[300px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Bulk set: {fields.find((f) => f.key === fieldModal)?.label}</h3>
            <select
              className="w-full text-xs bg-bg-2 border border-rule rounded-lg px-2 py-2 mb-3"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
            >
              <option value="">Choose value…</option>
              {fields.find((f) => f.key === fieldModal)?.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFieldModal(null)} className="text-xs border border-rule px-3 py-1.5 rounded-lg">Cancel</button>
              <button
                onClick={doField}
                disabled={!fieldValue}
                className="text-xs bg-ink text-bg px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                Apply to {count} questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────

export default function ContentCmsView() {
  const { flags } = useFeatureFlags();
  const enabled = !!flags.contentCms;
  const [searchParams, setSearchParams] = useSearchParams();

  // Tree state
  const [tree, setTree] = useState<ContentNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selType, setSelType] = useState<EntityType | null>(null);
  const [versionsFor, setVersionsFor] = useState<{ type: EntityType; id: string } | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; title: string }[]>([]);

  // Question table state
  const [page, setPage] = useState<QuestionPage | null>(null);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set());
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);

  // Filter state — read initial status from URL query param (?status=draft)
  const [filters, setFilters] = useState<QuestionPageOpts>({
    page: 1,
    pageSize: 50,
    status: searchParams.get("status") ?? undefined,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Tab
  const [tab, setTab] = useState<CmsTab>("questions");

  // Error
  const [opError, setOpError] = useState<string | null>(null);

  // ── Load tree ────────────────────────────────────────────────────────

  async function loadTree() {
    setTreeLoading(true); setTreeError(null);
    try {
      const { tree: t } = await loadContentTree();
      setTree(t);
      // extract subjects for filter bar
      const flat = flattenTree(t);
      const subjectMap = new Map<string, string>();
      flat.filter((n) => n.type === "subject").forEach((n) => subjectMap.set(n.id, n.title));
      setSubjects([...subjectMap.entries()].map(([id, title]) => ({ id, title })));
    } catch (e: any) {
      setTreeError(e?.message ?? "Failed to load tree.");
    } finally {
      setTreeLoading(false);
    }
  }

  useEffect(() => { if (enabled) loadTree(); else setTreeLoading(false); }, [enabled]);

  // ── Load questions (paginated) ────────────────────────────────────────

  const loadQuestions = useCallback(async (opts: QuestionPageOpts) => {
    setQLoading(true); setQError(null);
    try {
      const result = await fetchQuestionsPaginated({ ...opts, query: searchQuery || undefined });
      setPage(result);
    } catch (e: any) {
      setQError(e?.message ?? "Failed to load questions.");
    } finally {
      setQLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (enabled && tab === "questions") loadQuestions(filters);
  }, [enabled, filters, tab]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (tab === "questions") loadQuestions({ ...filters, page: 1 });
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  // ── Tree counts ──────────────────────────────────────────────────────

  const treeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    flattenTree(tree).forEach((n) => {
      c[n.type] = (c[n.type] ?? 0) + 1;
    });
    return c;
  }, [tree]);

  // ── Tree interactions ────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleSelect(node: ContentNode) {
    setSelType(node.type);
    setSelected((s) => {
      const n = selType === node.type ? new Set(s) : new Set<string>();
      n.has(node.id) ? n.delete(node.id) : n.add(node.id);
      return n;
    });
  }

  function expandAll() {
    setExpanded(new Set(flattenTree(tree).filter((n) => n.children.length > 0).map((n) => n.id)));
  }

  function collapseAll() { setExpanded(new Set()); }

  function filterToNode(_type: EntityType, id: string, _title: string) {
    setFilters((f) => ({ ...f, topic: id, page: 1 }));
    setTab("questions");
  }

  // ── Bulk ops (tree selection) ────────────────────────────────────────

  async function treeOp(action: "publish" | "archive" | "restore") {
    if (!selType || selected.size === 0) return;
    setOpError(null);
    try {
      const ids = [...selected];
      if (action === "publish") await publishEntities(selType, ids);
      else if (action === "archive") await archiveEntities(selType, ids);
      else await restoreEntities(selType, ids);
      setSelected(new Set()); await loadTree();
    } catch (e: any) { setOpError(e?.message ?? "Bulk op failed."); }
  }

  // ── Question bulk ops ────────────────────────────────────────────────

  async function qBulk(action: "publish" | "archive" | "restore") {
    if (selectedQIds.size === 0) return;
    setOpError(null);
    try {
      const ids = [...selectedQIds];
      if (action === "publish") await publishEntities("question", ids);
      else if (action === "archive") await archiveEntities("question", ids);
      else await restoreEntities("question", ids);
      setSelectedQIds(new Set()); await loadQuestions(filters);
    } catch (e: any) { setOpError(e?.message ?? "Bulk op failed."); }
  }

  async function qBulkField(field: string, value: string) {
    if (selectedQIds.size === 0) return;
    setOpError(null);
    try {
      await bulkUpdateField([...selectedQIds], field, value);
      setSelectedQIds(new Set()); await loadQuestions(filters);
    } catch (e: any) { setOpError(e?.message ?? `Bulk field update failed: ${e.message}`); }
  }

  // ── Versions ─────────────────────────────────────────────────────────

  async function openVersions(type: EntityType, id: string) {
    setVersionsFor({ type, id });
    try { setVersions(await listVersions(type, id)); }
    catch (e: any) { setOpError(e?.message ?? "Failed to load versions."); }
  }

  async function doRollback(versionId: number) {
    if (!versionsFor) return;
    try {
      await rollbackToVersion(versionsFor.type, versionsFor.id, versionId);
      await loadTree();
      setVersionsFor(null);
    } catch (e: any) { setOpError(e?.message ?? "Rollback failed."); }
  }

  // ── Feature gate ─────────────────────────────────────────────────────

  if (!enabled) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-xl font-bold">Content CMS</h1>
        <p className="mt-2 opacity-80 text-sm">
          Enable <code>contentCms</code> in Feature Control to access.
        </p>
      </div>
    );
  }

  const allQSelected = page && page.data.length > 0 && page.data.every((q) => selectedQIds.has(q.id));

  return (
    <div className="h-full flex flex-col gap-0 font-sans text-ink">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-rule pb-4 mb-4 px-1">
        <div className="flex-1">
          <div className="font-mono text-[9px] tracking-widest text-[#00a3ff] uppercase mb-0.5 font-semibold">Content Foundation · Phase 7</div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">Content CMS</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 text-xs">
          {(["tree", "questions", "editor"] as CmsTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg capitalize ${
                tab === t
                  ? "bg-ink text-bg"
                  : "border border-rule text-muted hover:text-ink hover:bg-bg-2"
              }`}
            >
              {t === "tree" ? "Tree" : t === "questions" ? `Questions${page ? ` (${page.total.toLocaleString()})` : ""}` : "Editor"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 shrink-0">
          <Link
            to="/admin/content-quality"
            className="text-xs border border-rule hover:bg-bg-2 px-3 py-1.5 rounded-lg text-muted hover:text-ink transition-colors"
          >
            Quality Dashboard →
          </Link>
          <Link
            to="/admin/content-import"
            className="text-xs border border-rule hover:bg-bg-2 px-3 py-1.5 rounded-lg text-muted hover:text-ink transition-colors"
          >
            Import →
          </Link>
        </div>
      </div>

      {opError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs mb-3">
          <AlertCircle size={14} />
          {opError}
          <button onClick={() => setOpError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {/* ── Tree tab ── */}
      {tab === "tree" && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5 min-h-0 flex-1">
          {/* Left: Tree */}
          <div className="border border-rule rounded-2xl p-4 overflow-auto bg-paper shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted font-bold">Content tree</span>
              <div className="ml-auto flex gap-1">
                <button onClick={expandAll} className="text-[9px] font-mono text-muted hover:text-ink">expand</button>
                <span className="text-muted opacity-40">·</span>
                <button onClick={collapseAll} className="text-[9px] font-mono text-muted hover:text-ink">collapse</button>
              </div>
            </div>

            {/* Type counts */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 pb-3 border-b border-rule/40">
              {Object.entries(treeCounts).map(([t, n]) => (
                <span key={t} className="text-[9px] font-mono text-muted">
                  {t}: <span className="text-ink">{n}</span>
                </span>
              ))}
            </div>

            {/* Bulk toolbar (tree selection) */}
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1 mb-3 text-xs items-center bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                <span className="text-amber-800 font-mono text-[10px]">{selected.size} {selType}</span>
                <button className="px-1.5 py-0.5 border border-emerald-200 text-emerald-700 rounded text-[10px]" onClick={() => treeOp("publish")}>Publish</button>
                <button className="px-1.5 py-0.5 border border-rule text-muted rounded text-[10px]" onClick={() => treeOp("archive")}>Archive</button>
                <button className="px-1.5 py-0.5 border border-rule text-muted rounded text-[10px]" onClick={() => treeOp("restore")}>→Draft</button>
                <button className="ml-auto" onClick={() => setSelected(new Set())}><X size={10} /></button>
              </div>
            )}

            {treeLoading ? (
              <div className="flex items-center justify-center h-24"><Loader2 size={16} className="animate-spin text-muted" /></div>
            ) : treeError ? (
              <p className="text-rose-600 text-xs">{treeError}</p>
            ) : (
              <Tree
                nodes={tree}
                expanded={expanded}
                selected={selected}
                onToggle={toggleExpand}
                onSelect={toggleSelect}
                onVersions={openVersions}
                onFilter={filterToNode}
                counts={{}}
              />
            )}
          </div>

          {/* Right: Inspector / Versions */}
          <div className="border border-rule rounded-2xl p-4 bg-paper shadow-sm">
            <h2 className="font-mono text-[9px] uppercase tracking-widest text-muted font-bold mb-3">Inspector</h2>
            {!versionsFor ? (
              <p className="text-sm text-muted">Click <RefreshCw size={10} className="inline" /> on a tree node to view its version history.</p>
            ) : (
              <div>
                <div className="text-xs text-muted mb-2 font-mono">{versionsFor.type}: {versionsFor.id}</div>
                <ul className="space-y-2 text-sm">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 border-b border-rule/40 pb-2">
                      <span className="font-mono text-xs">v{v.version}</span>
                      <span className="text-xs text-muted truncate flex-1">{v.reason ?? "—"}</span>
                      <button className="text-xs text-blue-600 hover:underline shrink-0" onClick={() => doRollback(v.id)}>rollback</button>
                    </li>
                  ))}
                  {versions.length === 0 && <li className="text-muted text-xs">No revisions yet.</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Questions tab ── */}
      {tab === "questions" && (
        <div className="flex flex-col gap-3 min-h-0 flex-1">
          {/* Search + filters */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search prompt or ID…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-bg-2 border border-rule rounded-lg text-ink focus:outline-none focus:border-rule-strong"
                />
              </div>
              <button
                onClick={() => loadQuestions(filters)}
                className="p-2 border border-rule hover:bg-bg-2 rounded-lg text-ink"
                aria-label="Refresh"
              >
                <RefreshCw size={13} className={qLoading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setTab("editor")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink text-bg rounded-lg"
              >
                <Edit2 size={12} />New Question
              </button>
            </div>

            <FilterBar
              filters={filters}
              subjects={subjects}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              onClear={() => { setFilters({ page: 1, pageSize: 50 }); setSearchQuery(""); setSearchParams({}); }}
            />
          </div>

          {/* Bulk toolbar for question selection */}
          {selectedQIds.size > 0 && (
            <BulkToolbar
              count={selectedQIds.size}
              onPublish={() => qBulk("publish")}
              onArchive={() => qBulk("archive")}
              onRestore={() => qBulk("restore")}
              onClear={() => setSelectedQIds(new Set())}
              onBulkField={qBulkField}
            />
          )}

          {qError && <div className="text-rose-600 text-xs">{qError}</div>}

          {/* Question table */}
          <div className="rounded-xl border border-rule overflow-auto flex-1 bg-paper shadow-sm">
            {qLoading && !page ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={18} className="animate-spin text-muted" />
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-bg-2/90 backdrop-blur-sm border-b border-rule">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={!!allQSelected}
                        onChange={(e) => {
                          if (e.target.checked && page) setSelectedQIds(new Set(page.data.map((q) => q.id)));
                          else setSelectedQIds(new Set());
                        }}
                        aria-label="Select all"
                      />
                    </th>
                    {["ID", "Prompt", "Subject", "Difficulty", "Status", "Review", "Updated"].map((h) => (
                      <th key={h} className="py-2.5 px-3 font-mono text-[9px] uppercase tracking-wide text-muted whitespace-nowrap">{h}</th>
                    ))}
                    <th className="py-2.5 px-3 font-mono text-[9px] uppercase tracking-wide text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(page?.data ?? []).map((q) => (
                    <tr
                      key={q.id}
                      className="border-b border-rule/50 hover:bg-bg-2/20 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedQIds.has(q.id)}
                          onChange={() => setSelectedQIds((s) => {
                            const n = new Set(s);
                            n.has(q.id) ? n.delete(q.id) : n.add(q.id);
                            return n;
                          })}
                        />
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-muted">{q.id}</td>
                      <td className="py-2 px-3 max-w-[280px]">
                        <p className="text-xs text-ink line-clamp-2">{q.prompt}</p>
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-muted">{q.subject_id ?? "—"}</td>
                      <td className="py-2 px-3">
                        <span className={diffBadge(q.difficulty)}>{q.difficulty}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={statusBadge(q.status)}>{q.status}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-mono text-muted">{q.review_status ?? "—"}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[9px] text-muted whitespace-nowrap">
                        {q.updated_at ? new Date(q.updated_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={async () => {
                            try {
                              const full = await fetchQuestionById(q.id);
                              setEditingQuestion(full);
                            } catch { setEditingQuestion(q); }
                            setTab("editor");
                          }}
                          className="p-1 rounded hover:bg-bg-2 text-muted hover:text-ink transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(page?.data ?? []).length === 0 && !qLoading && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-muted text-xs">No questions match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {page && (
            <div className="flex items-center justify-between bg-paper border border-rule rounded-xl px-4 py-2.5 shadow-sm">
              <span className="font-mono text-[10px] text-muted">
                {page.total === 0 ? "No results" : `Showing ${((filters.page! - 1) * (filters.pageSize ?? 50)) + 1}–${Math.min(filters.page! * (filters.pageSize ?? 50), page.total)} of ${page.total.toLocaleString()}`}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={!filters.page || filters.page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  className="text-xs border border-rule px-2.5 py-1 rounded-lg disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="text-xs font-mono text-muted px-1 py-1">
                  {filters.page ?? 1} / {page.pages}
                </span>
                <button
                  disabled={(filters.page ?? 1) >= page.pages}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  className="text-xs border border-rule px-2.5 py-1 rounded-lg disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Editor tab ── */}
      {tab === "editor" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => { setTab("questions"); setEditingQuestion(null); }}
              className="text-xs text-muted hover:text-ink flex items-center gap-1"
            >
              ← Back to questions
            </button>
          </div>
          <QuestionEditor
            initialQuestion={editingQuestion}
            onSaved={() => { loadTree(); loadQuestions(filters); setEditingQuestion(null); setTab("questions"); }}
            onCancel={() => { setTab("questions"); setEditingQuestion(null); }}
          />
        </div>
      )}
    </div>
  );
}
