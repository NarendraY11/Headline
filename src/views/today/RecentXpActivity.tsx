// =====================================================================
// Phase 7.2 — Recent XP activity strip (Today, xpSystem-gated)
//
// Read-only feed of the last few XP events, in the Today retention area near
// the mission loop. Returns null when xpSystem is OFF (nothing accrues).
// =====================================================================

import { Award, BookOpen, Flame, Target, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useFeature } from "../../hooks/useFeatureFlags";
import { useXp } from "../../hooks/useXp";
import type { XpEventType } from "../../lib/xpValues";

const TYPE_META: Record<XpEventType, { label: string; icon: ReactNode }> = {
  question_answered: { label: "Questions answered", icon: <BookOpen size={12} /> },
  quiz_completed:    { label: "Quiz completed",     icon: <Zap size={12} /> },
  mission_completed: { label: "Mission completed",  icon: <Target size={12} /> },
  streak_bonus:      { label: "Streak bonus",       icon: <Flame size={12} /> },
  achievement_unlock:{ label: "Achievement unlocked", icon: <Award size={12} /> },
};

export function RecentXpActivity() {
  const xpEnabled = useFeature("xpSystem");
  const { events, loading } = useXp(8);

  if (!xpEnabled) return null;
  if (!loading && events.length === 0) return null;

  return (
    <section className="border border-rule rounded-[20px] p-5 bg-paper">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-amber-soft flex items-center justify-center">
          <Zap size={13} className="text-[#855807] dark:text-amber" />
        </div>
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-signal">§ RECENT XP</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-bg-2/50 animate-pulse" />)}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {events.slice(0, 5).map((e) => {
            const meta = TYPE_META[e.type] ?? TYPE_META.quiz_completed;
            return (
              <li key={e.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <span className="w-6 h-6 rounded-md bg-bg-2 flex items-center justify-center text-muted-2 flex-shrink-0">
                  {meta.icon}
                </span>
                <span className="flex-1 font-sans text-[13px] text-ink truncate">{meta.label}</span>
                <span className="font-mono text-[12px] font-semibold text-mint tabular-nums flex-shrink-0">
                  +{e.amount}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
