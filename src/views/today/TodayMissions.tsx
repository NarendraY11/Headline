// =====================================================================
// AI Study Scheduler — TodayMissions panel (M7: production rollout)
//
// Primary recommendation surface when aiStudyScheduler is enabled.
// Shows today's scheduled missions above TodayStops in TodayView.
//
// M7 additions:
//   - Safety guards: empty→Generate CTA, materialize-fail→retry flow
//   - Regenerate Plan button (uses useRegenerate + current mastery)
//   - Analytics: mission_started on launch
// =====================================================================

import {
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Repeat,
  SkipForward,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFeature } from "../../hooks/useFeatureFlags";
import { useMaterialize, useRegenerate, useTodayMissions } from "../../hooks/useStudyMissions";
import { launchMission } from "../../lib/launchMission";
import type { MissionStatus, MissionType, StudyMissionRow } from "../../types/studyScheduler";

// ── Mission type metadata ────────────────────────────────────────────────────

const TYPE_META: Record<MissionType, { label: string; icon: ReactNode; chipCls: string }> = {
  drill:     { label: "Drill",     icon: <Zap size={10} />,          chipCls: "bg-signal-soft text-[#a83020] dark:text-signal border-signal/15" },
  review:    { label: "Review",    icon: <Repeat size={10} />,       chipCls: "bg-sky-soft text-sky border-sky/15" },
  viva:      { label: "Viva",      icon: <Mic size={10} />,          chipCls: "bg-amber-soft text-[#855807] dark:text-amber border-amber/15" },
  flashcard: { label: "Flashcard", icon: <Brain size={10} />,        chipCls: "bg-mint-soft text-mint border-mint/15" },
  mini_test: { label: "Mini Test", icon: <ClipboardList size={10} />, chipCls: "bg-bg-2 text-ink-2 border-rule" },
  mock:      { label: "Mock Exam", icon: <Layers size={10} />,       chipCls: "bg-navy/10 text-navy dark:text-navy border-navy/20" },
  read:      { label: "Read",      icon: <BookOpen size={10} />,     chipCls: "bg-bg-2 text-ink-2 border-rule" },
};

// ── Status helpers ───────────────────────────────────────────────────────────

function statusDot(status: MissionStatus) {
  const cfg: Record<MissionStatus, { cls: string; label: string }> = {
    pending:     { cls: "bg-rule-strong",    label: "Pending"     },
    in_progress: { cls: "bg-amber animate-pulse", label: "In progress" },
    completed:   { cls: "bg-mint",           label: "Completed"   },
    skipped:     { cls: "bg-muted-2",        label: "Skipped"     },
  };
  const { cls, label } = cfg[status] ?? cfg.pending;
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} title={label} aria-label={label} />;
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Skeleton loader ──────────────────────────────────────────────────────────

function MissionSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-paper border border-rule/50 rounded-xl h-[60px]" />
      ))}
    </div>
  );
}

// ── Single mission card ──────────────────────────────────────────────────────

interface MissionCardProps {
  mission: StudyMissionRow;
  onStart: (m: StudyMissionRow) => void;
  launching: boolean;
  showScores?: boolean;
}

function MissionCard({ mission, onStart, launching, showScores }: MissionCardProps) {
  const meta = TYPE_META[mission.type] ?? TYPE_META.drill;
  const isDone = mission.status === "completed" || mission.status === "skipped";

  return (
    <div
      className={`bg-paper border rounded-xl px-3.5 py-3 flex items-center gap-3 transition-colors ${
        isDone ? "border-rule/40 opacity-70" : "border-rule hover:border-rule-strong"
      }`}
    >
      {statusDot(mission.status)}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full font-mono text-[8px] uppercase tracking-wider border ${meta.chipCls}`}
          >
            {meta.icon}
            {meta.label}
          </span>
        </div>
        <p className="font-sans text-[13px] font-medium text-ink leading-snug truncate">
          {mission.payload?.subjectId
            ? `${mission.payload.subjectId.replace(/-/g, " ")}`
            : "Mission"}
        </p>
      </div>

      <div className="flex items-center gap-1 font-mono text-[9px] text-muted-2 uppercase tracking-wide flex-shrink-0">
        <Clock size={9} aria-hidden="true" />
        {formatMin(mission.estimated_min || 20)}
      </div>

      {isDone ? (
        <div className="flex-shrink-0 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-muted-2 pl-1">
          {mission.status === "completed" ? (
            <>
              <CheckCircle2 size={12} className="text-mint" />
              {showScores && mission.score != null ? (
                <span
                  className={`text-[9px] font-mono font-semibold ${
                    mission.score >= 80 ? "text-mint" :
                    mission.score >= 60 ? "text-amber" : "text-signal"
                  }`}
                >
                  {mission.score}%
                </span>
              ) : (
                <span>Done</span>
              )}
            </>
          ) : (
            <><SkipForward size={12} /> Skipped</>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={launching}
          onClick={() => onStart(mission)}
          aria-label={`Start ${meta.label} mission`}
          className="flex-shrink-0 h-8 w-8 rounded-lg bg-ink text-paper flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {launching ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={12} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TodayMissionsProps {
  /** Current mastery scores forwarded for plan regeneration. */
  subjectMastery?: Record<string, number>;
  /** Active plan id forwarded for regen analytics. */
  activePlanId?: string | null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function TodayMissions({ subjectMastery, activePlanId }: TodayMissionsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const missionScoresEnabled = useFeature("missionScores");
  const { missions, loading, error, needsMaterialization, refetch } = useTodayMissions();
  const { materialize, materializing, error: matError, lastResult } = useMaterialize();
  const { regenerate, regenerating } = useRegenerate();
  const [launchingId, setLaunchingId] = React.useState<string | null>(null);
  const [regenError, setRegenError] = React.useState<string | null>(null);

  // Auto-materialize when plan exists but no missions for today.
  useEffect(() => {
    if (!needsMaterialization || materializing) return;
    materialize().then((r) => {
      if (r.ok) refetch();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMaterialization]);

  const handleStart = async (mission: StudyMissionRow) => {
    if (launchingId) return;
    setLaunchingId(mission.id);
    try {
      await launchMission(mission, navigate, user?.id ?? null);
    } finally {
      setLaunchingId(null);
    }
  };

  const handleRetryMaterialize = () => {
    materialize().then((r) => { if (r.ok) refetch(); });
  };

  const handleRegenerate = async () => {
    setRegenError(null);
    const scores: Record<string, { correct: number; total: number }> = {};
    for (const [subjectId, mastery] of Object.entries(subjectMastery ?? {})) {
      scores[subjectId] = { correct: Math.round(mastery), total: 100 };
    }
    const r = await regenerate(scores);
    if (r.ok) {
      refetch();
    } else {
      setRegenError(r.error ?? "Regeneration failed. Please try again.");
    }
  };

  const header = (
    <div className="flex items-center justify-between mb-3">
      <div>
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-signal block mb-1">
          § TODAY'S MISSIONS
        </span>
        <h2 className="font-serif text-[22px] text-ink leading-none tracking-tight">
          Flight Plan
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {(materializing || loading || regenerating) && (
          <Loader2 size={14} className="text-muted-2 animate-spin" />
        )}
        {/* Regenerate plan — only shown when missions exist and mastery data available */}
        {missions.length > 0 && !regenerating && Object.keys(subjectMastery ?? {}).length > 0 && (
          <button
            type="button"
            onClick={handleRegenerate}
            title="Regenerate study plan from current mastery"
            className="h-7 px-2.5 rounded-lg border border-rule text-muted-2 hover:border-rule-strong hover:text-ink transition-colors font-mono text-[8px] uppercase tracking-wide flex items-center gap-1"
          >
            <RefreshCw size={9} />
            Regen
          </button>
        )}
      </div>
    </div>
  );

  // Loading / materializing skeleton
  if (loading || (materializing && missions.length === 0)) {
    return (
      <div className="mb-8">
        {header}
        <MissionSkeleton />
      </div>
    );
  }

  // Materialize failure → retry flow
  if (!loading && (matError ?? lastResult?.ok === false) && missions.length === 0) {
    return (
      <div className="mb-8">
        {header}
        <div className="bg-signal-soft border border-signal/15 rounded-xl px-4 py-4 text-center">
          <p className="font-sans text-sm text-[#a83020] dark:text-signal mb-3">
            {matError ?? "Failed to load today's schedule."}
          </p>
          <button
            type="button"
            onClick={handleRetryMaterialize}
            disabled={materializing}
            className="h-8 px-4 rounded-lg bg-ink text-paper font-sans text-[12px] font-medium disabled:opacity-50"
          >
            {materializing ? "Retrying…" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  // Data error (fetch failed)
  if (error) {
    return (
      <div className="mb-8">
        {header}
        <div className="bg-signal-soft border border-signal/15 rounded-xl px-4 py-3 font-sans text-sm text-[#a83020] dark:text-signal">
          {error}
        </div>
      </div>
    );
  }

  // No missions + no active plan → Generate Plan CTA
  if (missions.length === 0 && !materializing && !needsMaterialization) {
    return (
      <div className="mb-8">
        {header}
        <div className="bg-paper border border-rule/50 rounded-xl px-5 py-6 text-center">
          <p className="font-sans text-sm text-muted-2 leading-relaxed mb-3">
            No study plan yet. Generate one from your Analytics view.
          </p>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-navy text-paper font-sans text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            <Play size={11} aria-hidden="true" />
            Generate Plan
          </Link>
        </div>
      </div>
    );
  }

  // Regen error toast
  const regenBanner = regenError ? (
    <div className="mb-2 bg-signal-soft border border-signal/15 rounded-xl px-4 py-2 font-sans text-[12px] text-[#a83020] dark:text-signal">
      {regenError}
    </div>
  ) : null;

  return (
    <div className="mb-8">
      {header}
      {regenBanner}
      <div className="space-y-2">
        {missions.map((m) => (
          <MissionCard
            key={m.id}
            mission={m}
            onStart={handleStart}
            launching={launchingId === m.id}
            showScores={missionScoresEnabled}
          />
        ))}
      </div>
    </div>
  );
}
