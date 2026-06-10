// =====================================================================
// AI Study Scheduler — TodayMissions panel (Phase M5)
//
// Shows today's scheduled missions above TodayStops in TodayView.
// Feature-flag gated (aiStudyScheduler).
//
// Behaviour:
//   - On mount: if needsMaterialization, auto-trigger materialize()
//     then refetch. Silent — no blocking modal.
//   - Each mission card: type chip, title, estimated time, status dot.
//   - "Start" CTA: calls launchMission(mission, navigate, userId).
//   - Completed/skipped missions shown but CTA replaced with status label.
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
  Repeat,
  SkipForward,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMaterialize, useTodayMissions } from "../../hooks/useStudyMissions";
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
}

function MissionCard({ mission, onStart, launching }: MissionCardProps) {
  const meta = TYPE_META[mission.type] ?? TYPE_META.drill;
  const isDone = mission.status === "completed" || mission.status === "skipped";

  return (
    <div
      className={`bg-paper border rounded-xl px-3.5 py-3 flex items-center gap-3 transition-colors ${
        isDone ? "border-rule/40 opacity-70" : "border-rule hover:border-rule-strong"
      }`}
    >
      {/* Status dot */}
      {statusDot(mission.status)}

      {/* Type chip + title */}
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

      {/* Duration */}
      <div className="flex items-center gap-1 font-mono text-[9px] text-muted-2 uppercase tracking-wide flex-shrink-0">
        <Clock size={9} aria-hidden="true" />
        {formatMin(mission.estimated_min || 20)}
      </div>

      {/* CTA */}
      {isDone ? (
        <div className="flex-shrink-0 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-muted-2 pl-1">
          {mission.status === "completed" ? (
            <><CheckCircle2 size={12} className="text-mint" /> Done</>
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

// ── Main component ───────────────────────────────────────────────────────────

export function TodayMissions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { missions, loading, error, needsMaterialization, refetch } = useTodayMissions();
  const { materialize, materializing } = useMaterialize();
  const [launchingId, setLaunchingId] = React.useState<string | null>(null);

  // FIX #10: The old materializeOnce ref had two failure modes:
  //   (a) On remount (tab switch / back-nav), a new ref instance is created
  //       (current=false), so materialize fires again unnecessarily.
  //   (b) After plan regeneration needsMaterialization goes true again, but the
  //       old ref stays true on the same component instance — skipping the
  //       required re-materialization silently.
  //
  // Replaced with a useEffect keyed on needsMaterialization. The `materializing`
  // guard inside the effect prevents a double-trigger while the first call is
  // in-flight. On each new true→false→true cycle (regen), the effect re-runs
  // correctly. The `materialize` guard (materializing check) prevents concurrent
  // calls if the effect fires twice before the first resolves.
  useEffect(() => {
    if (!needsMaterialization || materializing) return;
    materialize().then((r) => {
      if (r.ok) refetch();
    });
    // needsMaterialization is the intentional trigger; other deps are stable refs.
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

  // Section header
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
      {(materializing || loading) && (
        <Loader2 size={14} className="text-muted-2 animate-spin" />
      )}
    </div>
  );

  if (loading || (materializing && missions.length === 0)) {
    return (
      <div className="mb-8">
        {header}
        <MissionSkeleton />
      </div>
    );
  }

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

  if (missions.length === 0) {
    return (
      <div className="mb-8">
        {header}
        <div className="bg-paper border border-rule/50 rounded-xl px-5 py-6 text-center">
          <p className="font-sans text-sm text-muted-2 leading-relaxed">
            No missions scheduled for today.
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wide text-muted-2 mt-1">
            Ask the AI coach to generate a study plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {header}
      <div className="space-y-2">
        {missions.map((m) => (
          <MissionCard
            key={m.id}
            mission={m}
            onStart={handleStart}
            launching={launchingId === m.id}
          />
        ))}
      </div>
    </div>
  );
}
