// Phase 2: Mission Control Hero — compact today-at-a-glance strip.
// Answers "what should I do today?" without overwhelming the viewport.

import { Flame, Loader2, Play, Sparkles, Target } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useTodayMissions } from "../../../hooks/useStudyMissions";
import { launchMission } from "../../../lib/launchMission";
import { completionPct, formatMin } from "./calendarHelpers";
import type { StudyMissionRow } from "../../../types/studyScheduler";

interface Props {
  launchingId: string | null;
  onLaunch: (id: string | null) => void;
}

export function MissionControlHero({ launchingId, onLaunch }: Props) {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const { missions, loading, needsMaterialization } = useTodayMissions();

  const pending = useMemo(
    () => missions.filter((m) => m.status === "pending" || m.status === "in_progress"),
    [missions],
  );
  const totalMin = useMemo(
    () => missions.reduce((s, m) => s + (m.estimated_min || 20), 0),
    [missions],
  );
  const pct = completionPct(missions);
  const streak = userData?.streakCount ?? 0;
  const hasMissions = missions.length > 0;

  async function handleStart(m: StudyMissionRow) {
    if (launchingId) return;
    onLaunch(m.id);
    try { await launchMission(m, navigate, user?.id ?? null); }
    finally { onLaunch(null); }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-4 flex items-center gap-3">
        <Loader2 size={14} className="text-muted-2 animate-spin flex-shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
          Loading today's schedule…
        </span>
      </div>
    );
  }

  // No plan — generate CTA
  if (!hasMissions && !needsMaterialization) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-navy flex-shrink-0" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
            Mission Control
          </span>
        </div>
        <p className="font-sans text-sm text-muted-2 leading-relaxed">
          No study plan yet. Generate one to start tracking missions.
        </p>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-navy text-paper font-sans text-[12px] font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Sparkles size={12} aria-hidden="true" />
          Generate Study Plan
        </Link>
      </div>
    );
  }

  // Has missions — show dashboard strip
  const firstPending = pending[0];

  return (
    <div className="bg-paper border border-rule rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-navy flex-shrink-0" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
            Mission Control
          </span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 font-mono text-[10px] text-amber">
            <Flame size={11} aria-hidden="true" />
            {streak} day streak
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-rule border-y border-rule mx-0 mt-1">
        <div className="px-3 py-2.5 text-center">
          <p className="font-mono text-[18px] font-bold text-ink leading-none">
            {missions.length}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-2 mt-0.5">
            Missions
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="font-mono text-[18px] font-bold text-ink leading-none">
            {formatMin(totalMin)}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-2 mt-0.5">
            Est. time
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className={`font-mono text-[18px] font-bold leading-none ${pct === 100 ? "text-mint" : "text-ink"}`}>
            {pct}%
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-2 mt-0.5">
            Done
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-2">
        <div
          className="h-full bg-mint transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct}% of today's missions complete`}
        />
      </div>

      {/* CTA */}
      <div className="px-4 py-3">
        {firstPending ? (
          <button
            type="button"
            disabled={!!launchingId}
            onClick={() => handleStart(firstPending)}
            className="w-full h-10 rounded-xl bg-navy text-paper dark:bg-paper dark:text-ink font-sans text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {launchingId === firstPending.id
              ? <Loader2 size={14} className="animate-spin" />
              : <Play size={13} aria-hidden="true" />}
            {pct === 0 ? "Start Studying" : "Continue Mission"}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 h-10 font-mono text-[11px] text-mint uppercase tracking-wide">
            ✓ All done for today
          </div>
        )}
      </div>
    </div>
  );
}
