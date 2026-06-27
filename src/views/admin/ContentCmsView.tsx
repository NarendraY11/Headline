// Phase 3 — Admin Content Management System. Single place to manage all
// learning content. Hidden behind the `contentCms` flag (OFF); admin-only;
// no nav link; no production UI change. Reuses the Phase 1 registry +
// relation tables and the Phase 3 pure core (contentModel) + DB (cmsDb).
//
// Tabs: Tree (hierarchy + bulk + search) · Question editor (draft only).
// Tree is expandable/collapsible with lazy question loading per topic.

import { useEffect, useMemo, useState } from "react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import {
  flattenTree,
  type ContentNode,
  type EntityType,
  type SearchResult,
} from "../../lib/cms/contentModel";
import {
  archiveEntities,
  listVersions,
  loadContentTree,
  loadQuestionsForTopic,
  publishEntities,
  restoreEntities,
  rollbackToVersion,
  searchContentServer,
} from "../../lib/cms/cmsDb";
import QuestionEditor from "./cms/QuestionEditor";

type Tab = "tree" | "question";

export default function ContentCmsView() {
  const { flags } = useFeatureFlags();
  const enabled = !!flags.contentCms;

  const [tab, setTab] = useState<Tab>("tree");
  const [tree, setTree] = useState<ContentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selType, setSelType] = useState<EntityType | null>(null);
  const [versionsFor, setVersionsFor] = useState<{ type: EntityType; id: string } | null>(null);
  const [versions, setVersions] = useState<any[]>([]);

  async function load() {
    setLoading(true); setError(null);
    try { setTree((await loadContentTree()).tree); }
    catch (e: any) { setError(e?.message ?? "Failed to load content tree."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (enabled) load(); else setLoading(false); }, [enabled]);

  // Phase 3.1: server-side search (includes questions; scales to 50k+).
  const [results, setResults] = useState<SearchResult[]>([]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      searchContentServer(query)
        .then((r) => { if (alive) setResults(r); })
        .catch((e) => { if (alive) { setResults([]); setError(e?.message ?? "Search failed."); } });
    }, 250); // debounce
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    flattenTree(tree).forEach((n) => { c[n.type] = (c[n.type] ?? 0) + 1; });
    return c;
  }, [tree]);

  function toggleExpand(id: string) {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelect(node: ContentNode) {
    // Bulk ops act on one entity type at a time.
    setSelType(node.type);
    setSelected((s) => {
      const n = selType === node.type ? new Set(s) : new Set<string>();
      n.has(node.id) ? n.delete(node.id) : n.add(node.id);
      return n;
    });
  }

  // Phase 3.1: no hard delete. Bulk = publish / archive / restore, each
  // versioned + chunked in the DB layer.
  async function bulk(action: "publish" | "archive" | "restore") {
    if (!selType || selected.size === 0) return;
    try {
      const ids = [...selected];
      if (action === "publish") await publishEntities(selType, ids);
      else if (action === "archive") await archiveEntities(selType, ids);
      else await restoreEntities(selType, ids);
      setSelected(new Set());
      await load();
    } catch (e: any) { setError(e?.message ?? "Bulk op failed."); }
  }

  async function openVersions(type: EntityType, id: string) {
    setVersionsFor({ type, id });
    try { setVersions(await listVersions(type, id)); }
    catch (e: any) { setError(e?.message ?? "Failed to load versions."); }
  }
  async function doRollback(versionId: number) {
    if (!versionsFor) return;
    try { await rollbackToVersion(versionsFor.type, versionsFor.id, versionId); await load(); setVersionsFor(null); }
    catch (e: any) { setError(e?.message ?? "Rollback failed."); }
  }

  if (!enabled) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-xl font-bold">Content CMS</h1>
        <p className="mt-2 opacity-80 text-sm">
          The <code>contentCms</code> feature flag is OFF. Enable it in Feature
          Control to open the CMS. No student-facing behaviour is affected.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-xl font-bold">Content CMS</h1>
        <div className="flex gap-1 text-sm">
          <button className={`px-3 py-1 rounded ${tab === "tree" ? "bg-black text-white dark:bg-white dark:text-black" : "border"}`} onClick={() => setTab("tree")}>Tree</button>
          <button className={`px-3 py-1 rounded ${tab === "question" ? "bg-black text-white dark:bg-white dark:text-black" : "border"}`} onClick={() => setTab("question")}>Question editor</button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {tab === "question" ? (
        <QuestionEditor onSaved={load} />
      ) : (
        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          {/* LEFT: search + tree + bulk */}
          <div>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search content (instant)…"
              className="w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm mb-3"
            />
            <div className="text-xs opacity-60 mb-3">
              {Object.entries(counts).map(([t, n]) => <span key={t} className="mr-3">{t}: {n}</span>)}
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 text-xs items-center">
                <span className="opacity-70">{selected.size} {selType} selected:</span>
                <button className="px-2 py-1 border rounded" onClick={() => bulk("publish")}>Publish</button>
                <button className="px-2 py-1 border rounded" onClick={() => bulk("archive")}>Archive</button>
                <button className="px-2 py-1 border rounded" onClick={() => bulk("restore")}>Restore→draft</button>
              </div>
            )}

            {loading ? <p>Loading…</p> : query ? (
              <ul className="space-y-1 text-sm">
                {results.map((r) => (
                  <li key={`${r.type}:${r.id}`} className="flex gap-2">
                    <span className="opacity-50 text-xs w-28 shrink-0">{r.type}</span>
                    <span>{r.title}</span>
                    <span className="opacity-40 text-xs ml-auto">{r.status}</span>
                  </li>
                ))}
                {results.length === 0 && <li className="opacity-50">No matches.</li>}
              </ul>
            ) : (
              <Tree
                nodes={tree} expanded={expanded} selected={selected}
                onToggle={toggleExpand} onSelect={toggleSelect} onVersions={openVersions}
              />
            )}
          </div>

          {/* RIGHT: version history panel */}
          <aside className="rounded-lg border border-black/10 dark:border-white/10 p-4 h-fit">
            <h2 className="font-semibold text-sm mb-2">Version history</h2>
            {!versionsFor ? <p className="text-sm opacity-60">Select a node's “history” to view revisions.</p> : (
              <div>
                <div className="text-xs opacity-60 mb-2">{versionsFor.type}: {versionsFor.id}</div>
                <ul className="space-y-2 text-sm">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center gap-2">
                      <span className="font-mono text-xs">v{v.version}</span>
                      <span className="opacity-60 text-xs truncate">{v.reason ?? "—"}</span>
                      <button className="ml-auto text-xs underline" onClick={() => doRollback(v.id)}>rollback</button>
                    </li>
                  ))}
                  {versions.length === 0 && <li className="opacity-50">No revisions yet.</li>}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

// ── Recursive tree ────────────────────────────────────────────────────
function Tree(props: {
  nodes: ContentNode[]; depth?: number;
  expanded: Set<string>; selected: Set<string>;
  onToggle: (id: string) => void; onSelect: (n: ContentNode) => void;
  onVersions: (t: EntityType, id: string) => void;
}) {
  const { nodes, depth = 0, expanded, selected, onToggle, onSelect, onVersions } = props;
  return (
    // Phase 3.1 a11y: ARIA tree semantics.
    <ul role={depth === 0 ? "tree" : "group"}
        className={depth === 0 ? "space-y-1" : "ml-4 border-l border-black/10 dark:border-white/10 pl-2 space-y-1"}>
      {nodes.map((n) => {
        const open = expanded.has(n.id);
        const hasKids = n.children.length > 0 || n.type === "topic";
        const isSel = selected.has(n.id);
        return (
          <li key={`${n.type}:${n.id}`}
              role="treeitem"
              aria-expanded={hasKids ? open : undefined}
              aria-selected={isSel}
              aria-label={`${n.type}: ${n.title} (${n.status})`}>
            <div className="flex items-center gap-2 text-sm py-0.5"
                 tabIndex={0}
                 onKeyDown={(e) => {
                   if ((e.key === "Enter" || e.key === " ") && hasKids) { e.preventDefault(); onToggle(n.id); }
                   else if (e.key === "ArrowRight" && hasKids && !open) onToggle(n.id);
                   else if (e.key === "ArrowLeft" && hasKids && open) onToggle(n.id);
                 }}>
              <input type="checkbox" checked={isSel} onChange={() => onSelect(n)}
                     aria-label={`Select ${n.type} ${n.title}`} />
              {hasKids ? (
                <button className="w-4 text-xs opacity-70" onClick={() => onToggle(n.id)}
                        aria-label={open ? `Collapse ${n.title}` : `Expand ${n.title}`}>{open ? "▾" : "▸"}</button>
              ) : <span className="w-4" aria-hidden="true" />}
              <span className="text-[10px] uppercase tracking-wide opacity-40 w-24 shrink-0">{n.type}</span>
              <span className={n.status === "archived" ? "opacity-40 line-through" : n.status === "draft" ? "opacity-70" : ""}>{n.title}</span>
              <span className="text-[10px] opacity-40">{n.status}</span>
              <button className="ml-auto text-[10px] underline opacity-60" onClick={() => onVersions(n.type, n.id)}
                      aria-label={`Version history for ${n.title}`}>history</button>
            </div>
            {open && n.children.length > 0 && (
              <Tree {...props} nodes={n.children} depth={depth + 1} />
            )}
            {open && n.type === "topic" && n.children.length === 0 && <LazyQuestions topicId={n.id} />}
          </li>
        );
      })}
    </ul>
  );
}

function LazyQuestions({ topicId }: { topicId: string }) {
  const [qs, setQs] = useState<any[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadQuestionsForTopic(topicId).then((r) => { if (alive) setQs(r); }).catch(() => { if (alive) setQs([]); });
    return () => { alive = false; };
  }, [topicId]);
  if (qs === null) return <div className="ml-8 text-xs opacity-50">loading questions…</div>;
  if (qs.length === 0) return <div className="ml-8 text-xs opacity-40">no questions</div>;
  return (
    <ul className="ml-8 space-y-0.5">
      {qs.map((q) => (
        <li key={q.id} className="text-xs flex gap-2">
          <span className="opacity-40">question</span>
          <span className="truncate max-w-xs">{q.prompt}</span>
          <span className="opacity-40">{q.status}</span>
        </li>
      ))}
    </ul>
  );
}
