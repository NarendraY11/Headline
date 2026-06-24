// =====================================================================
// Phase 7.2 — Compact achievement surface (Today, always-on)
//
// Small read-only retention nudge: newest unlocked badge + "N / M unlocked".
// NOT a full gallery (that lives in Profile). Always-on — achievements persist
// regardless of the xpSystem flag. Renders nothing until at least one unlock.
// =====================================================================

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAchievements } from "../../hooks/useAchievements";
import { ACHIEVEMENTS } from "../../lib/achievements";
import { AchievementBadge } from "../../components/AchievementBadge";

export function TodayAchievements() {
  const { unlocked, loading } = useAchievements();
  const total = Object.keys(ACHIEVEMENTS).length;

  // Nothing earned yet → don't clutter Today.
  if (loading || unlocked.length === 0) return null;

  // Newest unlock = last id returned (load order is fetch order; good enough for a nudge).
  const newest = unlocked[0];

  return (
    <Link
      to="/profile"
      className="block border border-rule rounded-[20px] p-4 bg-paper hover:border-rule-strong transition-colors group"
    >
      <div className="flex items-center gap-3">
        <AchievementBadge achievementId={newest} size="compact" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-signal">§ ACHIEVEMENTS</div>
          <div className="font-sans text-[13px] text-ink">
            {unlocked.length} / {total} unlocked
          </div>
        </div>
        <ArrowRight size={14} className="text-muted-2 group-hover:text-ink group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>
    </Link>
  );
}
