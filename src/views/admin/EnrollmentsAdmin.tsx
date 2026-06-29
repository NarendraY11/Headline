// Phase 2 — hidden admin enrollment ops. Reached at /admin/registry/enrollments.
// Gated by the `contentRegistry` flag (Phase 1 admin gate). Create / list /
// activate / deactivate. No bulk tools yet.

import { useEffect, useState } from "react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import {
  adminActivateEnrollment,
  adminCreateEnrollment,
  adminDeactivateEnrollment,
  adminListEnrollments,
} from "../../lib/learningContextDb";
import { CERTIFICATION_IDS } from "../../lib/contentRegistry";
import type { EnrollmentRow } from "../../lib/learningContext";

export default function EnrollmentsAdmin() {
  const { flags } = useFeatureFlags();
  const enabled = !!flags.contentRegistry;

  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [cert, setCert] = useState<string>(CERTIFICATION_IDS[0]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await adminListEnrollments());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load enrollments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    load();
  }, [enabled]);

  async function create() {
    setError(null);
    if (!userId.trim()) { setError("user_id (uuid) required."); return; }
    try {
      await adminCreateEnrollment({ user_id: userId.trim(), certification_id: cert });
      setUserId("");
      await load();
    } catch (e: any) { setError(e?.message ?? "Create failed."); }
  }

  async function activate(r: EnrollmentRow) {
    try { await adminActivateEnrollment(r); await load(); }
    catch (e: any) { setError(e?.message ?? "Activate failed."); }
  }
  async function deactivate(id: string) {
    try { await adminDeactivateEnrollment(id); await load(); }
    catch (e: any) { setError(e?.message ?? "Deactivate failed."); }
  }

  if (!enabled) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Enrollments</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Enable the <code>contentRegistry</code> flag to manage enrollments.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <AdminBreadcrumb crumbs={[{ label: "Registry", to: "/admin/registry" }, { label: "Enrollments" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Enrollments</h1>
      {error && <div style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input placeholder="user_id (uuid)" value={userId} style={{ flex: 1 }}
               onChange={(e) => setUserId(e.target.value)} />
        <select value={cert} onChange={(e) => setCert(e.target.value)}>
          {CERTIFICATION_IDS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={create}>Create (inactive)</button>
      </div>

      {loading ? <p>Loading…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>user</th><th>certification</th><th>status</th><th>active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td><code>{r.user_id.slice(0, 8)}…</code></td>
                <td>{r.certification_id}</td>
                <td>{r.status}</td>
                <td>{r.is_active ? "✅" : ""}</td>
                <td style={{ textAlign: "right" }}>
                  {r.is_active
                    ? <button onClick={() => deactivate(r.id)}>deactivate</button>
                    : <button onClick={() => activate(r)}>activate</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 12, opacity: 0.6 }}>No enrollments.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
