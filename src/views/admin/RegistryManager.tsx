// Phase 1 — hidden admin registry CRUD. Gated by the `contentRegistry`
// feature flag (OFF by default) and not linked in any nav. Generic over
// the four registry tables. CRUD only; no question upload (Phase 3).
//
// ponytail: one generic component for all four entities instead of four
// near-identical managers. Add columns per entity only where they matter.

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { FeatureDisabled } from "../../components/FeatureDisabled";
import { supabase } from "../../lib/supabase";
import {
  clearRegistryCache,
  fetchRegistry,
  type RegistryEntity,
  type RegistryRow,
} from "../../lib/contentRegistryDb";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";

const ENTITIES: RegistryEntity[] = ["programs", "certifications", "aircraft", "topics"];

function isEntity(x: string | undefined): x is RegistryEntity {
  return !!x && (ENTITIES as string[]).includes(x);
}

const BLANK = { slug: "", title: "", description: "", status: "draft", sort_order: 0 };

export default function RegistryManager() {
  const { flags } = useFeatureFlags();
  const params = useParams();
  const entity: RegistryEntity = isEntity(params.entity) ? params.entity : "programs";

  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof BLANK>(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);

  const enabled = !!flags.contentRegistry;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRegistry(entity, true);
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load registry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    load();
    setDraft(BLANK);
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, enabled]);

  async function save() {
    setError(null);
    const payload = {
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      sort_order: Number(draft.sort_order) || 0,
    };
    if (!payload.slug || !payload.title) { setError("slug and title are required."); return; }
    const q = editingId
      ? supabase.from(entity).update(payload).eq("id", editingId)
      : supabase.from(entity).insert(payload);
    const { error: e } = await q;
    if (e) { setError(e.message); return; }
    clearRegistryCache(entity);
    setDraft(BLANK);
    setEditingId(null);
    await load();
  }

  async function archive(id: string) {
    // Soft delete = status 'archived' (matches platform convention).
    const { error: e } = await supabase.from(entity).update({ status: "archived" }).eq("id", id);
    if (e) { setError(e.message); return; }
    clearRegistryCache(entity);
    await load();
  }

  function editRow(r: RegistryRow) {
    setEditingId(r.id);
    setDraft({
      slug: r.slug, title: r.title, description: (r.description as string) ?? "",
      status: r.status, sort_order: r.sort_order,
    });
  }

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)),
    [rows]
  );

  if (!enabled) return <FeatureDisabled title="Content Registry" featureKey="contentRegistry" />;

  const inp = "text-xs bg-bg border border-rule rounded-lg px-2 py-1.5 text-ink w-full focus:outline-none focus:ring-1 focus:ring-ink/20";
  const entityLabel = entity ? entity.charAt(0).toUpperCase() + entity.slice(1) : "Hub";

  return (
    <div className="p-6 max-w-4xl space-y-6 font-sans text-ink">
      <AdminBreadcrumb crumbs={[{ label: "Registry", to: "/admin/registry" }, { label: entityLabel }]} />
      <div>
        <h1 className="font-serif text-2xl font-medium text-ink">Content Registry — {entityLabel}</h1>
        <nav className="flex flex-wrap gap-2 mt-3">
          {ENTITIES.map((e) => (
            <Link
              key={e}
              to={`/admin/registry/${e}`}
              className={`text-xs px-3 py-1.5 rounded-lg border font-mono uppercase tracking-wide transition-colors ${
                e === entity
                  ? "bg-ink text-bg border-ink font-semibold"
                  : "border-rule text-muted hover:text-ink hover:bg-bg-2"
              }`}
            >
              {e}
            </Link>
          ))}
        </nav>
      </div>

      {error && (
        <div className="text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-paper border border-rule rounded-2xl p-4 shadow-sm">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted mb-3 font-bold">
          {editingId ? "Edit Entry" : "Add Entry"}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          <input className={inp} placeholder="slug" value={draft.slug}
                 onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          <input className={inp} placeholder="title" value={draft.title}
                 onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <input className={inp} placeholder="description" value={draft.description}
                 onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <select className={inp} value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
          <input type="number" className={inp} placeholder="sort" value={draft.sort_order}
                 onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            className="text-xs bg-ink text-bg px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity font-mono"
          >
            {editingId ? "Update" : "Add"}
          </button>
          {editingId && (
            <button
              onClick={() => { setEditingId(null); setDraft(BLANK); }}
              className="text-xs border border-rule text-muted px-4 py-1.5 rounded-lg hover:text-ink hover:bg-bg-2 transition-colors font-mono"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="bg-paper border border-rule rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-rule bg-bg-2/40">
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Sort</th>
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Slug</th>
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Title</th>
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-rule/40 last:border-0 ${r.status === "archived" ? "opacity-40" : ""}`}
                >
                  <td className="px-4 py-2.5 font-mono text-muted">{r.sort_order}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-2">{r.slug}</td>
                  <td className="px-4 py-2.5 text-ink">{r.title}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold uppercase border ${
                      r.status === "published" ? "bg-mint/10 text-emerald-700 border-mint/30" :
                      r.status === "archived" ? "bg-muted/10 text-muted-2 border-muted/20" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => editRow(r)}
                      className="text-[10px] font-mono text-muted hover:text-ink mr-2 transition-colors"
                    >edit</button>
                    {r.status !== "archived" && (
                      <button
                        onClick={() => archive(r.id)}
                        className="text-[10px] font-mono text-muted hover:text-rose-600 transition-colors"
                      >archive</button>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-xs">
                    No entries. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
