// =====================================================================
// Phase 6 — Mission Activation Engine: mission history
//
// Lists completed + abandoned engine missions. Auth-safe: fetch only fires
// after the flag is ON and useAuth() has a userId (no query inside the auth
// callback, no cold-load loop).
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, History, SkipForward } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "../hooks/useFeatureFlags";
import { getEngineMissionHistory } from "../lib/studyScheduler";
import type { StudyMissionRow } from "../types/studyScheduler";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function MissionHistoryView() {
  const engineEnabled = useFeature("missionEngine");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [rows, setRows] = useState<StudyMissionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!engineEnabled || !userId) return;
    let active = true;
    setLoading(true);
    try {
      const data = await getEngineMissionHistory(userId);
      if (active) setRows(data);
    } catch {
      if (active) setRows([]);
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [engineEnabled, userId]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.((fn) => fn?.()); };
  }, [load]);

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="w-full max-w-lg mx-auto">
        <Link to="/today" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-2 hover:text-ink mb-5">
          <ArrowLeft size={13} /> Today
        </Link>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-full bg-bg-2 flex items-center justify-center">
            <History size={16} className="text-ink" />
          </div>
          <div>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-signal block">§ MISSION LOG</span>
            <h1 className="font-serif text-[22px] text-ink leading-none">Mission History</h1>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-[14px] bg-bg-2/50 animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[16px] border border-rule bg-paper px-5 py-8 text-center font-sans text-sm text-muted-2">
            No missions yet. Generate your first mission from Today.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((m) => {
              const done = m.status === "completed";
              const impact = m.payload?.readinessImpact;
              return (
                <div key={m.id} className="rounded-[14px] border border-rule bg-paper px-4 py-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-mint-soft" : "bg-bg-2"}`}>
                    {done ? <CheckCircle2 size={14} className="text-mint" /> : <SkipForward size={14} className="text-muted-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[13px] font-medium text-ink truncate">
                      {m.payload?.title ?? m.payload?.subjectId?.replace(/-/g, " ") ?? "Mission"}
                    </p>
                    <p className="font-mono text-[10px] text-muted-2 uppercase tracking-wide">
                      {fmtDate(m.completed_at ?? m.created_at)} · {done ? "Completed" : "Abandoned"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {done && m.score != null && (
                      <div className={`font-mono text-[13px] font-semibold ${m.score >= 80 ? "text-mint" : m.score >= 60 ? "text-amber" : "text-signal"}`}>
                        {m.score}%
                      </div>
                    )}
                    {done && impact != null && (
                      <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
                        {impact >= 0 ? "+" : ""}{impact}% rdy
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
