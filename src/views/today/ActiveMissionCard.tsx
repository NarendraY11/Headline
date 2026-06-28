// =====================================================================
// Phase 6 — Mission Activation Engine: Active Mission card (Today hero)
// Phase 8.1 — Daily Flight Briefing: staleness signal, completed-today
//             state, comeback copy, XP preview.
//
// States (in priority order):
//   loading        → skeleton
//   completedToday → "Mission complete for today" — prevents immediate
//                    "Generate" fallback after same-day completion
//   no mission     → "Generate Today's Mission"
//   pending        → "Start Mission"
//   in_progress    → "Continue / Resume / Restart Momentum" (staleness-aware)
//
// No migration required. Staleness derived from payload.startedAt.
// XP preview is a pure client-side heuristic (mission XP + question XP).
// =====================================================================

import { ArrowRight, CheckCircle2, Clock, Flame, Loader2, Play, RotateCcw, Target, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeature } from "../../hooks/useFeatureFlags";
import { type GenerateInputs } from "../../hooks/useActiveMission";
import { useMissionStreak } from "../../hooks/useMissionStreak";
import { XP_VALUES } from "../../lib/xp";
import type { RankProgress } from "../../lib/xpValues";
import type { StudyMissionRow } from "../../types/studyScheduler";
import type { NavigateFunction } from "react-router-dom";

interface ActiveMissionCardProps extends GenerateInputs {
  /** Phase 8.1: passed from TodayView so no duplicate useXp call. */
  xpSystemEnabled?: boolean;
  xpRankProgress?: RankProgress | null;
  // Phase 9.3: mission state + actions lifted to TodayView (single useActiveMission call).
  mission: StudyMissionRow | null;
  completedToday: StudyMissionRow | null;
  missionLoading: boolean;
  missionError: string | null;
  missionBusy: boolean;
  onGenerate: (inputs: GenerateInputs) => Promise<StudyMissionRow | null>;
  onResume: (m: StudyMissionRow, navigate: NavigateFunction, inputs: GenerateInputs) => Promise<void>;
  onAbandon: (m: StudyMissionRow, inputs: GenerateInputs) => Promise<void>;
}

// ── Staleness helpers ─────────────────────────────────────────────────────────

function hoursAgoFromISO(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
}

function stalenessLabel(startedAt: string | undefined): string | null {
  const h = hoursAgoFromISO(startedAt);
  if (h === 0) return null;
  const d = Math.floor(h / 24);
  if (d >= 2) return `Started ${d} days ago`;
  if (d === 1) return "Started yesterday";
  return `Started ${h}h ago`;
}

// Fork 3: staleness-based CTA copy
function ctaLabel(started: boolean, startedAt: string | undefined): string {
  if (!started) return "Start Mission";
  const h = hoursAgoFromISO(startedAt);
  const d = Math.floor(h / 24);
  if (d >= 4) return "Restart Momentum";
  if (d >= 2) return "Resume Training";
  return "Continue Mission";
}

// Fork 3: staleness-based subtext for comeback users
function comebackSubtext(startedAt: string | undefined): string | null {
  const h = hoursAgoFromISO(startedAt);
  const d = Math.floor(h / 24);
  if (d >= 4) return "Pick up where you left off — your mission is still waiting.";
  if (d >= 2) return "Back in the cockpit. Resume where you left off.";
  return null;
}

export function ActiveMissionCard({
  xpSystemEnabled = false,
  xpRankProgress = null,
  mission,
  completedToday,
  missionLoading: loading,
  missionError: error,
  missionBusy: busy,
  onGenerate: generate,
  onResume: resume,
  onAbandon: abandon,
  ...inputs
}: ActiveMissionCardProps) {
  const engineEnabled = useFeature("missionEngine");
  const navigate = useNavigate();
  const { streak: missionStreak } = useMissionStreak();

  if (!engineEnabled) return null;

  // ── Section header ────────────────────────────────────────────────────────
  const sectionHeader = (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-signal-soft flex items-center justify-center flex-shrink-0">
        <Target size={15} className="text-signal" />
      </div>
      <div className="flex-1">
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-signal block">
          § ACTIVE MISSION
        </span>
        <h2 className="font-serif text-[20px] text-ink leading-none tracking-tight">
          Today's Mission
        </h2>
      </div>
      {missionStreak >= 1 && (
        <span
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-amber-soft border border-amber/20 text-[#855807] dark:text-amber flex-shrink-0"
          title={`${missionStreak}-day mission streak`}
        >
          <Flame size={12} />
          <span className="font-mono text-[10px] font-semibold tabular-nums">{missionStreak}d</span>
        </span>
      )}
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="border border-rule rounded-[20px] p-5 bg-paper">
        {sectionHeader}
        <div className="h-[88px] rounded-[14px] bg-bg-2/50 animate-pulse" />
      </section>
    );
  }

  const errorBanner = error ? (
    <div className="mb-3 bg-signal-soft border border-signal/15 rounded-xl px-3.5 py-2 font-sans text-[12px] text-[#a83020] dark:text-signal">
      {error}
    </div>
  ) : null;

  // ── Completed today — Fork 2 ──────────────────────────────────────────────
  // Prevents "Generate Today's Mission" fallback when user already trained today.
  if (!mission && completedToday) {
    const title = completedToday.payload?.title ?? "Today's Mission";
    const score = completedToday.score;
    return (
      <section className="border border-rule rounded-[20px] p-5 bg-paper">
        {sectionHeader}
        {errorBanner}
        <div className="rounded-[14px] border border-mint/20 bg-mint-soft p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={15} className="text-mint flex-shrink-0" />
            <span className="font-serif text-[16px] text-ink leading-tight truncate">{title}</span>
            {score != null && (
              <span className="ml-auto font-mono text-[11px] text-mint font-semibold tabular-nums flex-shrink-0">
                {score}%
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-muted-2 uppercase tracking-wide">
            Mission complete for today
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate(inputs)}
          className="w-full h-10 rounded-[12px] border border-rule bg-transparent text-ink flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wide hover:bg-panel/30 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={13} />}
          Generate Tomorrow's Mission
        </button>
        <p className="mt-2 text-center font-mono text-[9px] text-muted-2 tracking-wide">
          Rest up. Return tomorrow to keep your streak.
        </p>
      </section>
    );
  }

  // ── No active mission (and nothing completed today) ───────────────────────
  if (!mission) {
    return (
      <section className="border border-rule rounded-[20px] p-5 bg-paper">
        {sectionHeader}
        {errorBanner}
        <p className="font-sans text-[13px] text-muted-2 leading-relaxed mb-4">
          Stop browsing — start training. Generate a focused mission targeting your
          weakest subject right now.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate(inputs)}
          className="w-full h-12 rounded-[14px] bg-ink text-paper flex items-center justify-center gap-2 font-sans text-base font-medium hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={15} />}
          Generate Today's Mission
        </button>
      </section>
    );
  }

  // ── Active mission (pending / in_progress) ────────────────────────────────
  const started = mission.status === "in_progress";
  const startedAt = mission.payload?.startedAt as string | undefined;
  const total = mission.payload?.targetCount ?? mission.estimated_min ?? 0;
  const title = mission.payload?.title ?? mission.payload?.subjectId?.replace(/-/g, " ") ?? "Mission";
  const description = mission.payload?.description ?? "";

  // Fork 1 + Fork 3: staleness signals
  const staleLabel = started ? stalenessLabel(startedAt) : null;
  const comebackText = started ? comebackSubtext(startedAt) : null;
  const cta = ctaLabel(started, startedAt);
  const hoursAgo = hoursAgoFromISO(startedAt);
  const isStale = hoursAgo >= 48; // 2+ days

  // Fork 5: XP preview (subordinate — show only when xpSystem ON)
  const missionXpPreview = xpSystemEnabled
    ? XP_VALUES.missionCompleted + Math.round(Number(total) * 1.5)
    : null;
  // Rank proximity hook: show only when ≤200 XP from next rank
  const showRankHook = xpSystemEnabled && xpRankProgress && !xpRankProgress.isMax
    && xpRankProgress.xpRemaining <= 200;

  // CTA icon: stale missions get RotateCcw to signal "resume/restart"
  const ctaIcon = !started
    ? <Play size={15} />
    : isStale
    ? <RotateCcw size={15} />
    : <ArrowRight size={15} />;

  return (
    <section className="border border-rule rounded-[20px] p-5 bg-paper">
      {sectionHeader}
      {errorBanner}

      <div className="rounded-[14px] border border-rule bg-bg p-4 mb-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="font-serif text-[18px] text-ink leading-tight">{title}</h3>
          <span
            className={`font-mono text-[8px] uppercase tracking-wider px-1.5 h-[18px] inline-flex items-center rounded-full border flex-shrink-0 ${
              started
                ? "bg-amber-soft text-[#855807] dark:text-amber border-amber/15"
                : "bg-signal-soft text-[#a83020] dark:text-signal border-signal/15"
            }`}
          >
            {started ? "In progress" : "Ready"}
          </span>
        </div>

        {/* Fork 1: staleness line — only for started missions older than 1h */}
        {staleLabel && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock size={11} className="text-muted-2 flex-shrink-0" />
            <span className="font-mono text-[9px] text-muted-2 tracking-wide">{staleLabel}</span>
          </div>
        )}

        {description && !comebackText && (
          <p className="font-sans text-[12px] text-muted-2 leading-relaxed mb-2">{description}</p>
        )}

        {/* Fork 3: comeback subtext replaces description when stale */}
        {comebackText && (
          <p className="font-sans text-[12px] text-muted-2 leading-relaxed mb-2">{comebackText}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] text-muted-2 uppercase tracking-wide">
            {total} questions · ~{mission.estimated_min}m
          </div>

          {/* Fork 5: XP preview — compact, subordinate to the mission details */}
          {missionXpPreview != null && (
            <div className="flex items-center gap-1 font-mono text-[9px] text-[#855807] dark:text-amber tabular-nums flex-shrink-0">
              <Zap size={10} />
              +{missionXpPreview} XP
            </div>
          )}
        </div>

        {/* Fork 5: rank proximity hook */}
        {showRankHook && xpRankProgress && (
          <div className="mt-1.5 font-mono text-[9px] text-muted-2 tracking-wide">
            {xpRankProgress.xpRemaining} XP to {xpRankProgress.next!.name}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void resume(mission, navigate, inputs)}
        className="w-full h-12 rounded-[14px] bg-ink text-paper flex items-center justify-center gap-2 font-sans text-base font-medium hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : ctaIcon}
        {cta}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void abandon(mission, inputs)}
        className="w-full mt-2 h-8 rounded-lg text-muted-2 hover:text-ink flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wide transition-colors disabled:opacity-50"
      >
        <X size={11} /> Abandon mission
      </button>
    </section>
  );
}
