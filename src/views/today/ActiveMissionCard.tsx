// =====================================================================
// Phase 6 — Mission Activation Engine: Active Mission card (Today hero)
//
// The mission is the core unit of study. This card is the first thing on
// Today when `missionEngine` is ON:
//   - no mission  → "Generate Today's Mission"
//   - pending     → "Start Mission"
//   - in_progress → "Continue Mission" (resumes the same subject quiz)
//
// All generation inputs (track, mastery, readiness) are passed in from
// TodayView, which already computes them — no duplicate fetching here.
// =====================================================================

import { ArrowRight, Flame, Loader2, Play, Target, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeature } from "../../hooks/useFeatureFlags";
import { useActiveMission, type GenerateInputs } from "../../hooks/useActiveMission";
import { useMissionStreak } from "../../hooks/useMissionStreak";

interface ActiveMissionCardProps extends GenerateInputs {}

export function ActiveMissionCard(inputs: ActiveMissionCardProps) {
  const engineEnabled = useFeature("missionEngine");
  const navigate = useNavigate();
  const { mission, loading, error, busy, generate, resume, abandon } = useActiveMission();
  const { streak: missionStreak } = useMissionStreak();

  if (!engineEnabled) return null;

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

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── No active mission → Generate ─────────────────────────────────────────────
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

  // ── Active mission (pending / in_progress) ───────────────────────────────────
  const started = mission.status === "in_progress";
  const total = mission.payload?.targetCount ?? mission.estimated_min ?? 0;
  const title = mission.payload?.title ?? mission.payload?.subjectId?.replace(/-/g, " ") ?? "Mission";
  const description = mission.payload?.description ?? "";

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
        {description && (
          <p className="font-sans text-[12px] text-muted-2 leading-relaxed mb-2">{description}</p>
        )}
        <div className="font-mono text-[10px] text-muted-2 uppercase tracking-wide">
          {total} questions · ~{mission.estimated_min}m
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void resume(mission, navigate, inputs)}
        className="w-full h-12 rounded-[14px] bg-ink text-paper flex items-center justify-center gap-2 font-sans text-base font-medium hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={15} />}
        {started ? "Continue Mission" : "Start Mission"}
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
