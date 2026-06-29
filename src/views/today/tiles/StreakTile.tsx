import { Flame } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { TILE_BASE } from "./tileClasses";

interface StreakTileProps {
  streak: number;
  streakWeek: Array<{ isActive: boolean }>;
}

export function StreakTile({ streak, streakWeek }: StreakTileProps) {
  const hasStreak = streak > 0;
  return (
    <div className={TILE_BASE}>
      <div className="flex items-center gap-1.5 mb-1 text-muted-2">
        <Flame size={14} className={hasStreak ? "text-signal" : "text-muted-2"} />
        <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
          STREAK
        </span>
      </div>
      {hasStreak ? (
        <>
          <div className="font-serif text-[26px] text-ink leading-none mt-2">
            <AnimatedCounter value={streak} />
            <span className="font-sans text-xl font-normal lowercase text-muted tracking-normal">
              d
            </span>
          </div>
          <div className="flex justify-between items-center mt-4 pointer-events-none w-full">
            {streakWeek.map((d, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 text-[10px]"
              >
                <div
                  className={`w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center
                    ${d.isActive ? "bg-signal-soft border-signal/30 text-signal" : "bg-bg border-rule text-transparent"}
                  `}
                >
                  {d.isActive && (
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-signal rounded-full"></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col justify-center items-center py-2 text-center h-full min-h-[50px] animate-in fade-in duration-300">
          <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide font-semibold">No Active Streak</span>
          <span className="text-[10px] text-muted leading-tight mt-0.5">Start a session today!</span>
        </div>
      )}
    </div>
  );
}
