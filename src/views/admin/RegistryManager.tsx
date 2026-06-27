// Phase 1 — hidden admin registry CRUD. Gated by the `contentRegistry`
// feature flag (OFF by default) and not linked in any nav. Generic over
// the four registry tables. CRUD only; no question upload (Phase 3).
//
// ponytail: one generic component for all four entities instead of four
// near-identical managers. Add columns per entity only where they matter.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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

  if (!enabled) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Content Registry</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          The <code>contentRegistry</code> feature flag is OFF. Enable it in
          Feature Control to use the registry CRUD pages. The canonical resolver
          runs underneath regardless of this flag.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Content Registry — {entity}</h1>

      <nav style={{ display: "flex", gap: 8, margin: "12px 0 20px" }}>
        {ENTITIES.map((e) => (
          <a key={e} href={`/admin/registry/${e}`}
             style={{ padding: "4px 10px", borderRadius: 6,
                      fontWeight: e === entity ? 700 : 400,
                      border: "1px solid #ccc", textDecoration: "none" }}>
            {e}
          </a>
        ))}
      </nav>

      {error && <div style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
        <input placeholder="slug" value={draft.slug}
               onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
        <input placeholder="title" value={draft.title}
               onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <input placeholder="description" value={draft.description}
               onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <select value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
        <input type="number" placeholder="sort" value={draft.sort_order}
               onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
      </div>
      <button onClick={save} style={{ padding: "6px 14px", marginBottom: 20 }}>
        {editingId ? "Update" : "Add"}
      </button>
      {editingId && (
        <button onClick={() => { setEditingId(null); setDraft(BLANK); }}
                style={{ padding: "6px 14px", marginLeft: 8 }}>Cancel</button>
      )}

      {loading ? <p>Loading…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>sort</th><th>slug</th><th>title</th><th>status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0", opacity: r.status === "archived" ? 0.5 : 1 }}>
                <td>{r.sort_order}</td>
                <td><code>{r.slug}</code></td>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => editRow(r)}>edit</button>{" "}
                  {r.status !== "archived" && <button onClick={() => archive(r.id)}>archive</button>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={5} style={{ padding: 12, opacity: 0.6 }}>No rows.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
