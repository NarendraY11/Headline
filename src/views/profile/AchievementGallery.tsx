// =====================================================================
// Phase 7.2 — Full achievement gallery (Profile)
//
// Renders ALL achievements (unlocked vivid / locked dimmed) + "N / M unlocked".
// Always-on: achievements persist regardless of the xpSystem flag.
// =====================================================================

import { useAchievements } from "../../hooks/useAchievements";
import { ACHIEVEMENTS } from "../../lib/achievements";
import { AchievementBadge } from "../../components/AchievementBadge";

export function AchievementGallery() {
  const { unlocked, loading } = useAchievements();
  const unlockedSet = new Set(unlocked);
  const all = Object.keys(ACHIEVEMENTS);
  const count = all.filter((id) => unlockedSet.has(id)).length;

  return (
    <div className="bg-paper border border-rule rounded-[20px] overflow-hidden mb-8">
      <div className="px-6 pt-5 pb-3 border-b border-rule flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-signal">
          § ACHIEVEMENTS
        </span>
        <span className="font-mono text-[11px] text-muted-2 tabular-nums">
          {loading ? "—" : `${count} / ${all.length} unlocked`}
        </span>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {all.map((id) => (
          <AchievementBadge key={id} achievementId={id} locked={!unlockedSet.has(id)} />
        ))}
      </div>
    </div>
  );
}
