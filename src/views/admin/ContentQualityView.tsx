// Phase 7 — Content Quality Dashboard.
// Route: /admin/content-quality (gated by contentCms flag).
// No new tables — all stats derived from existing questions + registry tables.

import { useEffect, useState } from "react";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileQuestion,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import {
  fetchContentQualityStats,
  loadContentTree,
  type ContentQualityStats,
} from "../../lib/cms/cmsDb";
import { flattenTree } from "../../lib/cms/contentModel";

// ── Mini components ──────────────────────────────────────────────────────

function StatRow({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-rule/40 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`font-mono text-xs font-bold ${warn && Number(value) > 0 ? "text-amber-600" : "text-ink"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-muted" />
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── View ─────────────────────────────────────────────────────────────────

export default function ContentQualityView() {
  const { flags } = useFeatureFlags();
  const enabled = !!flags.contentCms;

  const [stats, setStats] = useState<ContentQualityStats | null>(null);
  const [treeData, setTreeData] = useState<{ subjects: number; modules: number; topics: number; emptyTopics: number }>({
    subjects: 0, modules: 0, topics: 0, emptyTopics: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [s, { tree }] = await Promise.all([
        fetchContentQualityStats(),
        loadContentTree(),
      ]);
      setStats(s);
      const flat = flattenTree(tree);
      const subjects = flat.filter((n) => n.type === "subject").length;
      const modules  = flat.filter((n) => n.type === "module").length;
      const topics   = flat.filter((n) => n.type === "topic").length;
      const emptyTopics = flat.filter((n) => n.type === "topic" && n.children.length === 0).length;
      setTreeData({ subjects, modules, topics, emptyTopics });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load quality stats.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (enabled) load(); else setLoading(false); }, [enabled]);

  if (!enabled) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-xl font-bold">Content Quality</h1>
        <p className="mt-2 opacity-80 text-sm">Enable <code>contentCms</code> flag to access.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-rose-600 text-sm">{error}</div>;
  }

  const s = stats!;
  const total = s.totalQuestions;
  const published = s.byStatus["published"] ?? 0;
  const draft = s.byStatus["draft"] ?? 0;
  const archived = s.byStatus["archived"] ?? 0;
  const coveragePct = total > 0 ? Math.round((published / total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      <AdminBreadcrumb crumbs={[{ label: "Content Quality" }]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-[#00a3ff] uppercase mb-1 font-semibold">Content Foundation · Phase 7</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Content Quality Dashboard</h1>
          <p className="text-xs text-muted mt-1">{total.toLocaleString()} questions · {coveragePct}% published</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 border border-rule hover:bg-bg-2 rounded-full transition-colors inline-flex items-center text-ink disabled:opacity-50 h-9 w-9"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/admin/cms"
            className="flex items-center gap-1.5 text-xs font-semibold border border-rule hover:bg-bg-2 px-3 py-1.5 rounded-lg text-ink transition-colors"
          >
            Open CMS <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Questions", value: total, color: "text-ink" },
          { label: "Published", value: published, color: "text-emerald-700" },
          { label: "Draft", value: draft, color: "text-amber-600" },
          { label: "Archived", value: archived, color: "text-muted-2" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-paper border border-rule rounded-2xl p-5 shadow-sm text-center">
            <div className={`text-3xl font-mono font-bold ${color}`}>{value.toLocaleString()}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Coverage */}
        <SectionCard title="Coverage" icon={BarChart3}>
          <StatRow label="Subjects in tree" value={treeData.subjects} />
          <StatRow label="Modules in tree" value={treeData.modules} />
          <StatRow label="Topics in tree" value={treeData.topics} />
          <StatRow label="Topics with no questions" value={treeData.emptyTopics} warn />
          <div className="mt-3 pt-3 border-t border-rule/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted">Questions by subject (top 5)</span>
            </div>
            {s.bySubject.slice(0, 5).map(({ subject_id, count }) => (
              <div key={subject_id} className="flex justify-between items-center py-1">
                <span className="text-xs text-ink font-mono truncate max-w-[120px]">{subject_id}</span>
                <span className="font-mono text-xs text-muted">{count}</span>
              </div>
            ))}
            {s.bySubject.length === 0 && <p className="text-xs text-muted italic">No subject data.</p>}
          </div>
        </SectionCard>

        {/* Quality */}
        <SectionCard title="Quality Gaps" icon={AlertTriangle}>
          <StatRow label="Missing explanation" value={s.missingExplanation} warn />
          <StatRow label="Missing references" value={s.missingRefs} warn />
          <StatRow label="Missing tags" value={s.missingTags} warn />
          <StatRow label="Missing authority" value={s.missingAuthority} warn />
          <StatRow label="Missing subject" value={s.missingSubject} warn />
          <StatRow label="Missing module" value={s.missingModule} warn />
          <StatRow label="Missing topic link" value={s.missingTopic} warn />
          <div className="mt-3 pt-3 border-t border-rule/40">
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted">Difficulty: Standard</span>
              <span className="font-mono text-xs">{(s.byDifficulty["standard"] ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted">Difficulty: Complex</span>
              <span className="font-mono text-xs">{(s.byDifficulty["complex"] ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted">Difficulty: Extreme</span>
              <span className="font-mono text-xs">{(s.byDifficulty["extreme"] ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </SectionCard>

        {/* Publishing */}
        <SectionCard title="Publishing" icon={CheckCircle2}>
          <StatRow label="Draft (hidden from students)" value={draft} />
          <StatRow label="Published (live)" value={published} />
          <StatRow label="Archived" value={archived} />
          <StatRow label="Pending review" value={s.pendingReview} warn />
          <StatRow label="Approved" value={s.approvedCount} />
          <StatRow label="Modified in last 7 days" value={s.recentlyModified} />
          <div className="mt-4">
            <div className="h-2 rounded-full bg-bg-2 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted mt-1 font-mono">{coveragePct}% questions published</p>
          </div>
        </SectionCard>

        {/* Analytics placeholder */}
        <SectionCard title="Analytics" icon={FileQuestion}>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileQuestion size={24} className="text-muted mb-2" />
            <p className="text-xs text-muted font-mono">Question attempt stats</p>
            <p className="text-[10px] text-muted-2 mt-1">Available when student attempts data accumulates.</p>
          </div>
          <div className="mt-2 pt-3 border-t border-rule/40">
            <p className="text-[10px] text-muted italic">
              Attempts, accuracy, and solve-time analytics will populate here as students use the platform.
            </p>
          </div>
        </SectionCard>

        {/* Quick actions */}
        <div className="bg-paper border border-rule rounded-2xl p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">Quick Actions</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to="/admin/cms?status=draft"
              className="flex items-center gap-3 p-3 rounded-xl border border-rule hover:bg-bg-2 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Review Drafts</p>
                <p className="text-[10px] text-muted">{draft} questions waiting</p>
              </div>
              <ChevronRight size={14} className="text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              to="/admin/content-import"
              className="flex items-center gap-3 p-3 rounded-xl border border-rule hover:bg-bg-2 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <FileQuestion size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Import Content</p>
                <p className="text-[10px] text-muted">CSV / JSON pipeline</p>
              </div>
              <ChevronRight size={14} className="text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              to="/admin/questions"
              className="flex items-center gap-3 p-3 rounded-xl border border-rule hover:bg-bg-2 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Questions Manager</p>
                <p className="text-[10px] text-muted">{total.toLocaleString()} total questions</p>
              </div>
              <ChevronRight size={14} className="text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              to="/admin/cms"
              className="flex items-center gap-3 p-3 rounded-xl border border-rule hover:bg-bg-2 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                <BarChart3 size={14} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Content CMS</p>
                <p className="text-[10px] text-muted">Tree browser + editor</p>
              </div>
              <ChevronRight size={14} className="text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
