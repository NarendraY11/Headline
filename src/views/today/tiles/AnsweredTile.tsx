import { BookOpen } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { TILE_BASE } from "./tileClasses";

interface AnsweredTileProps {
  dailyGoal: number;
  answeredToday: number;
  totalQuestions: number;
}

export function AnsweredTile({ dailyGoal, answeredToday, totalQuestions }: AnsweredTileProps) {
  const remainingToGoal = Math.max(0, dailyGoal - answeredToday);
  return (
    <div className={TILE_BASE}>
      <div>
        <div className="flex items-center gap-1.5 mb-1 text-muted-2">
          <BookOpen size={14} />
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
            Q'S ANSWERED
          </span>
          </div>
        <div className="font-serif text-[26px] text-ink leading-none mt-2 flex items-baseline justify-between overflow-hidden">
          <div>
            <AnimatedCounter value={answeredToday} />
            <span className="font-sans text-xs text-muted-2 ml-1">
              /{dailyGoal}
            </span>
          </div>
          {answeredToday >= dailyGoal ? (
            <span className="font-mono text-[9px] font-bold text-mint uppercase tracking-wide bg-mint/10 border border-mint/20 px-1.5 py-0.5 rounded">
              Goal Met
            </span>
          ) : (
            <span className="font-mono text-[9px] text-amber uppercase tracking-wide">
              {remainingToGoal} to go
            </span>
          )}
        </div>
        <div className="w-full bg-bg h-1.5 rounded-full mt-3 overflow-hidden border border-rule/50">
          <div
            className="bg-mint h-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, (answeredToday / dailyGoal) * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-[9px] font-mono text-muted-2">
          Lifetime: {totalQuestions}
        </div>
      </div>
    </div>
  );
}
