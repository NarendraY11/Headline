// Admin-only read-only metrics panel for AI Study Scheduler (M7).
// Fetches aggregated stats from /api/study/metrics.

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface Metrics {
  activePlans: number;
  usersWithPlan: number;
  missionCompletionRate: number;
  completedMissions: number;
  totalMissions: number;
  dailyActivePlanners7d: number;
  asOf: string;
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-paper border border-rule rounded-xl px-4 py-3">
      <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-1">{label}</p>
      <p className="font-serif text-2xl text-ink">{value}</p>
      {sub && <p className="font-mono text-[9px] text-muted-2 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StudySchedulerMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch("/api/study/metrics", { method: "GET" }, 10_000)
      .then(async (r) => {
        if (!active) return;
        if (r.ok) {
          const data = (await r.response.json()) as Metrics;
          setMetrics(data);
        } else {
          setError("Failed to load study scheduler metrics.");
        }
      })
      .catch(() => { if (active) setError("Network error."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-paper border border-rule rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-2">AI Study Scheduler</span>
        <span className="h-[1px] flex-1 bg-rule" />
        <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Read-only</span>
      </div>

      {loading && (
        <div className="h-20 animate-pulse bg-bg-2 rounded-xl" />
      )}

      {!loading && error && (
        <p className="font-sans text-sm text-signal">{error}</p>
      )}

      {!loading && metrics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <Kpi label="Active Plans" value={metrics.activePlans} />
            <Kpi label="Users with Plan" value={metrics.usersWithPlan} />
            <Kpi label="Mission Completion" value={`${metrics.missionCompletionRate}%`} sub={`${metrics.completedMissions}/${metrics.totalMissions} missions`} />
            <Kpi label="Daily Active (7d)" value={metrics.dailyActivePlanners7d} sub="unique planners" />
            <Kpi label="Total Missions" value={metrics.totalMissions} sub="last 30 days" />
          </div>
          <p className="font-mono text-[8px] text-muted-2 text-right">
            Updated {new Date(metrics.asOf).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
