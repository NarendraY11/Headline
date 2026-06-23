// =====================================================================
// Phase 6 — Mission Activation Engine: completion screen
//
// Reached after an engine-launched quiz finishes (QuizView routes here).
// Shows mission name, accuracy, time spent, questions completed, and the
// readiness impact, then offers "Generate Next Mission" — closing the loop:
//   complete → readiness updated → next mission.
// =====================================================================

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, Loader2, Target, TrendingUp } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useUserProgress } from "../lib/progress";
import { useActiveMission } from "../hooks/useActiveMission";
import { finalizeReadinessImpact, getEngineMissionById } from "../lib/studyScheduler";
import type { StudyMissionRow } from "../types/studyScheduler";

function formatDuration(startISO?: string, endISO?: string | null): string {
  if (!startISO || !endISO) return "—";
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (!isFinite(ms) || ms <= 0) return "—";
  const min = Math.round(ms / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function MissionCompleteView() {
  const location = useLocation();
  const navigate = useNavigate();
  const missionId = (location.state as { missionId?: string } | null)?.missionId;

  const { userData } = useAuth();
  const { stats: progressStats, loading: progressLoading } = useUserProgress();
  const { generate, busy } = useActiveMission();

  const [mission, setMission] = useState<StudyMissionRow | null>(null);
  const [impact, setImpact] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // No mission id (e.g. hard refresh) → back to Today.
  useEffect(() => {
    if (!missionId) navigate("/today", { replace: true });
  }, [missionId, navigate]);

  useEffect(() => {
    if (!missionId || progressLoading) return;
    let active = true;
    (async () => {
      try {
        const row = await getEngineMissionById(missionId);
        if (!active) return;
        setMission(row);
        // Persist + read readiness impact using the current (post-quiz) score.
        const delta =
          row?.payload?.readinessImpact ??
          (await finalizeReadinessImpact(missionId, progressStats.examReadiness));
        if (active) setImpact(delta);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [missionId, progressLoading, progressStats.examReadiness]);

  const handleGenerateNext = async () => {
    const row = await generate({
      targetExam: userData?.targetExam,
      mastery: progressStats.subjectMastery,
      dailyGoal: userData?.dailyGoal,
      readinessScore: progressStats.examReadiness,
      careerObjective: userData?.careerObjective,
    });
    navigate("/today", { replace: true });
    void row;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-muted-2" />
      </div>
    );
  }

  const title = mission?.payload?.title ?? "Mission Complete";
  const accuracy = mission?.score;
  const questionsDone = mission?.payload?.targetCount ?? 0;
  const duration = formatDuration(mission?.payload?.startedAt, mission?.completed_at);
  const impactStr = impact == null ? "—" : `${impact >= 0 ? "+" : ""}${impact}%`;

  return (
    <div className="min-h-screen bg-bg px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-mint-soft flex items-center justify-center mb-3">
            <CheckCircle2 size={28} className="text-mint" />
          </div>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-mint mb-1">
            § MISSION COMPLETE
          </span>
          <h1 className="font-serif text-[26px] text-ink leading-tight">{title}</h1>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Accuracy" value={accuracy == null ? "—" : `${accuracy}%`} icon={<Target size={14} />} />
          <Stat label="Time Spent" value={duration} icon={<Clock size={14} />} />
          <Stat label="Questions" value={`${questionsDone}`} icon={<CheckCircle2 size={14} />} />
          <Stat label="Readiness" value={impactStr} icon={<TrendingUp size={14} />} accent />
        </div>

        {/* Readiness impact highlight */}
        <div className="rounded-[16px] border border-mint/20 bg-mint-soft px-4 py-4 mb-5 text-center">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-2 mb-1">
            Readiness Impact
          </div>
          <div className="font-serif text-[40px] leading-none text-mint">{impactStr}</div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGenerateNext()}
          className="w-full h-12 rounded-[14px] bg-ink text-paper flex items-center justify-center gap-2 font-sans text-base font-medium hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={15} />}
          Generate Next Mission
        </button>

        <Link
          to="/today"
          className="w-full mt-2 h-10 rounded-lg flex items-center justify-center font-mono text-[11px] uppercase tracking-wide text-muted-2 hover:text-ink transition-colors"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-[14px] border border-rule bg-paper p-3.5">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-muted-2 mb-1.5">
        {icon}
        {label}
      </div>
      <div className={`font-serif text-[24px] leading-none ${accent ? "text-mint" : "text-ink"}`}>{value}</div>
    </div>
  );
}
