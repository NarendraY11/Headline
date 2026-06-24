// =====================================================================
// Phase 7.2 — AchievementBadge (shared, presentational)
//
// One badge visual from an ACHIEVEMENTS[id] definition. Locked badges render
// dimmed/grayscale. Used by both the Today compact surface and the Profile
// gallery. No data fetching — caller supplies id + locked.
// =====================================================================

import { Award, Lock } from "lucide-react";
import { ACHIEVEMENTS } from "../lib/achievements";

interface AchievementBadgeProps {
  achievementId: string;
  locked?: boolean;
  /** compact = small chip (Today); default = full card (gallery). */
  size?: "compact" | "full";
}

export function AchievementBadge({ achievementId, locked = false, size = "full" }: AchievementBadgeProps) {
  const def = ACHIEVEMENTS[achievementId];
  if (!def) return null;

  if (size === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border ${
          locked
            ? "border-rule bg-bg-2/40 text-muted-2"
            : "border-amber/30 bg-amber-soft text-[#855807] dark:text-amber"
        }`}
        title={def.title}
      >
        {locked ? <Lock size={11} /> : <Award size={11} />}
        <span className="font-mono text-[9px] uppercase tracking-wide font-semibold">{def.badge}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center text-center gap-2 p-4 rounded-[16px] border transition-all ${
        locked
          ? "border-rule bg-bg-2/30 opacity-55 grayscale"
          : "border-amber/30 bg-amber-soft/40"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center ${
          locked ? "bg-bg-2 text-muted-2" : "bg-amber/15 text-[#855807] dark:text-amber"
        }`}
      >
        {locked ? <Lock size={20} /> : <Award size={20} />}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink">{def.badge}</div>
      <div className="font-serif text-[13px] text-ink leading-tight">{def.title}</div>
      <p className="font-sans text-[11px] text-muted-2 leading-snug">{def.desc}</p>
    </div>
  );
}
