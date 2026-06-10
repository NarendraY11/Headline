import { ArrowLeft, CalendarRange, Compass, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useMaterialize } from "../hooks/useStudyMissions";
import { getActiveStudyPlan } from "../lib/studyScheduler";
import type { StudyPlanRow } from "../types/studyScheduler";
import { StudyPlanCard } from "./study/StudyPlanCard";

// ── Skeleton loader ──────────────────────────────────────────────────────────
function PlanSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header card skeleton */}
      <div className="bg-ink/10 rounded-2xl h-44" />
      {/* Weak areas */}
      <div className="bg-paper border border-rule/50 rounded-2xl overflow-hidden">
        <div className="h-11 bg-bg-2/60 border-b border-rule/40" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-rule/30 last:border-0">
            <div className="w-7 h-7 rounded-lg bg-bg-2" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-bg-2 rounded w-2/3" />
              <div className="h-1.5 bg-bg-2 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
      {/* Day cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-paper border border-rule/50 rounded-2xl h-16" />
      ))}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-bg-2 border border-rule flex items-center justify-center mb-4">
        <Compass size={28} className="text-muted-2" strokeWidth={1.2} />
      </div>
      <h3 className="font-serif text-xl text-ink mb-1.5">No active study plan</h3>
      <p className="font-sans text-sm text-muted-2 max-w-xs leading-relaxed">
        Ask the AI coach to generate a personalised study plan for your exam.
        It will appear here once created.
      </p>
      <Link
        to="/modules"
        className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-ink text-paper font-sans text-sm font-medium hover:bg-ink-2 transition-colors"
      >
        Go to Modules
      </Link>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export default function StudySchedulerView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [planRow, setPlanRow] = useState<StudyPlanRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const { materialize, materializing } = useMaterialize();

  useEffect(() => {
    if (!user?.id) return;
    setError(null);
    getActiveStudyPlan(user.id)
      .then((row) => setPlanRow(row))
      .catch((e) => {
        setError("Failed to load your study plan.");
        console.error("StudySchedulerView:", e);
        setPlanRow(null);
      });
  }, [user?.id]);

  const loading = planRow === undefined;
  const hasPlan = !loading && planRow !== null;

  return (
    <div className="relative min-h-screen pb-32">
      {/* Background texture */}
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 pt-14 pb-6 max-w-[820px] mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <Link
            to="/today"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-2 hover:text-ink transition-colors mb-4"
          >
            <ArrowLeft size={12} />
            Back to Briefing
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-signal mb-1.5">
                § STUDY PLAN · AI GENERATED
              </span>
              <h1 className="font-serif text-[34px] md:text-[42px] text-ink leading-tight tracking-tight">
                Flight Plan
              </h1>
              <p className="font-sans text-sm text-muted-2 mt-1">
                Your personalised study schedule, built by AI.
              </p>
            </div>
            {hasPlan && (
              <button
                type="button"
                disabled
                aria-label="Regenerate plan (coming soon)"
                title="Regenerate plan (M5)"
                className="mt-1 flex-shrink-0 h-9 px-3 rounded-xl border border-rule text-muted-2 font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5 cursor-not-allowed opacity-50"
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {error && (
          <div className="bg-signal-soft border border-signal/20 rounded-xl px-4 py-3 font-sans text-sm text-[#a83020] dark:text-signal mb-6">
            {error}
          </div>
        )}

        {loading && <PlanSkeleton />}
        {!loading && !hasPlan && !error && <EmptyState />}
        {!loading && hasPlan && planRow && (
          <StudyPlanCard
            plan={planRow.plan}
            generatedAt={planRow.generated_at}
          />
        )}
      </div>

      {/* ── Sticky "Add Entire Plan To Schedule" CTA ─────────────────────────
           Visual-only M3 placeholder. Will become the primary action in M6.
           Positioned above mobile nav (≈80px) via pb-32 on the outer wrapper. */}
      {hasPlan && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
          aria-hidden={!hasPlan}
        >
          {/* Fade-out mask so content isn't hard-clipped by the bar */}
          <div className="h-12 bg-gradient-to-t from-bg to-transparent pointer-events-none" />

          <div className="bg-bg/90 backdrop-blur-md border-t border-rule px-4 py-3 pointer-events-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            <div className="max-w-[820px] mx-auto flex items-center gap-3">
              {/* Plan info pill */}
              {planRow && (
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-2">
                    {planRow.plan.meta.horizonDays}d plan
                  </span>
                  <span className="w-1 h-1 rounded-full bg-rule-strong" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-2">
                    {planRow.plan.days.reduce((s, d) => s + d.tasks.length, 0)} tasks
                  </span>
                </div>
              )}

              {/* Primary CTA — full width on mobile, grows on desktop */}
              <button
                type="button"
                disabled={materializing}
                aria-label="Add entire plan to schedule"
                onClick={async () => {
                  const result = await materialize();
                  if (result.ok) navigate("/schedule");
                }}
                className="
                  flex-1 h-12 rounded-2xl
                  bg-navy text-paper
                  dark:bg-paper dark:text-ink
                  font-sans text-[14px] font-semibold
                  flex items-center justify-center gap-2
                  shadow-[0_4px_20px_rgba(20,48,90,0.35)]
                  dark:shadow-[0_4px_20px_rgba(245,242,234,0.12)]
                  hover:opacity-90
                  disabled:opacity-60 disabled:cursor-wait
                  select-none
                  transition-opacity
                "
              >
                {materializing
                  ? <Loader2 size={16} className="animate-spin" />
                  : <CalendarRange size={16} aria-hidden="true" />}
                {materializing ? "Scheduling…" : "Add Entire Plan To Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
