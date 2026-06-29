// Phase 2 — hidden admin enrollment ops. Reached at /admin/registry/enrollments.
// Gated by the `contentRegistry` flag (Phase 1 admin gate). Create / list /
// activate / deactivate. No bulk tools yet.

import { useEffect, useState } from "react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { FeatureDisabled } from "../../components/FeatureDisabled";
import {
  adminActivateEnrollment,
  adminCreateEnrollment,
  adminDeactivateEnrollment,
  adminListEnrollments,
} from "../../lib/learningContextDb";
import { CERTIFICATION_IDS } from "../../lib/contentRegistry";
import type { EnrollmentRow } from "../../lib/learningContext";

const inp = "text-xs bg-bg border border-rule rounded-lg px-2 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-ink/20";

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

  if (!enabled) return <FeatureDisabled title="Enrollments" featureKey="contentRegistry" />;

  return (
    <div className="p-6 max-w-4xl space-y-6 font-sans text-ink">
      <AdminBreadcrumb crumbs={[{ label: "Registry", to: "/admin/registry" }, { label: "Enrollments" }]} />
      <h1 className="font-serif text-2xl font-medium text-ink">Enrollments</h1>

      {error && (
        <div className="text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-paper border border-rule rounded-2xl p-4 shadow-sm">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted mb-3 font-bold">Create Enrollment</p>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inp} flex-1 min-w-[200px]`}
            placeholder="user_id (uuid)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <select className={inp} value={cert} onChange={(e) => setCert(e.target.value)}>
            {CERTIFICATION_IDS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={create}
            className="text-xs bg-ink text-bg px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity font-mono"
          >
            Create (inactive)
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="bg-paper border border-rule rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-rule bg-bg-2/40">
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">User</th>
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Certification</th>
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Status</th>
                <th className="text-left font-mono uppercase tracking-wider text-muted px-4 py-2.5 text-[9px]">Active</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule/40 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-muted-2">{r.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 text-ink">{r.certification_id}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold uppercase border ${
                      r.status === "active" ? "bg-mint/10 text-emerald-700 border-mint/30" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">{r.is_active ? "✓" : ""}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.is_active ? (
                      <button
                        onClick={() => deactivate(r.id)}
                        className="text-[10px] font-mono text-muted hover:text-rose-600 transition-colors"
                      >deactivate</button>
                    ) : (
                      <button
                        onClick={() => activate(r)}
                        className="text-[10px] font-mono text-muted hover:text-emerald-600 transition-colors"
                      >activate</button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-xs">
                    No enrollments. Create one above.
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
