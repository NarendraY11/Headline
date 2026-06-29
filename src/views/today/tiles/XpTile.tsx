import { Zap } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { TILE_BASE } from "./tileClasses";

interface XpTileProps {
  xpBalance: number;
  xpLoading: boolean;
  xpRank: any;
  xpThisWeek: number;
}

export function XpTile({ xpBalance, xpLoading, xpRank, xpThisWeek }: XpTileProps) {
  return (
    <div className={TILE_BASE}>
      <div>
        <div className="flex items-center gap-1.5 mb-1 text-muted-2">
          <Zap size={14} className="text-amber" />
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
            XP
          </span>
        </div>
        <div className="font-serif text-[26px] text-ink leading-none mt-2">
          {xpLoading ? 0 : <AnimatedCounter value={xpBalance} />}{" "}
          <span className="font-sans text-xl text-muted font-normal lowercase tracking-normal">
            xp
          </span>
        </div>
        {/* Phase 7.3: rank chip + progress-to-next rail */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wide text-ink font-semibold truncate">
              {xpRank.rank.name}
            </span>
            <span className="font-mono text-[9px] text-muted-2 tracking-wide tabular-nums flex-shrink-0">
              {xpRank.isMax ? "MAX" : `${xpRank.xpRemaining} to ${xpRank.next!.name}`}
            </span>
          </div>
          <div className="h-1 rounded-full bg-bg-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber transition-all duration-500"
              style={{ width: `${Math.round(xpRank.progress * 100)}%` }}
            />
          </div>
        </div>
        <div className="mt-2 font-mono text-[9px] text-muted-2 tracking-wide">
          {xpThisWeek > 0 ? `+${xpThisWeek} this week` : "No XP this week yet"}
        </div>
      </div>
    </div>
  );
}
