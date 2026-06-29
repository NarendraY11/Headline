import { Award } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { TILE_BASE } from "./tileClasses";

function getScoreColor(score: number) {
  if (score >= 70) return "text-mint";
  if (score >= 40) return "text-amber";
  return "text-signal";
}

interface ScoreTileProps {
  avgScore: number;
  scoreTrendStr: string;
  scoreTrendSign: string;
}

export function ScoreTile({ avgScore, scoreTrendStr, scoreTrendSign }: ScoreTileProps) {
  return (
    <div className={TILE_BASE}>
      <div>
        <div className="flex items-center gap-1.5 mb-1 text-muted-2">
          <Award size={14} />
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
            AVG SCORE
          </span>
          </div>
        <div
          className={`font-serif text-[26px] leading-none mt-2 ${getScoreColor(avgScore)}`}
        >
          <AnimatedCounter value={avgScore} />
          <span className="font-sans text-xl text-muted font-normal tracking-normal">
            %
          </span>
        </div>
        <div className={`mt-2 font-mono text-[9px] tracking-wide ${
          scoreTrendSign === "↑" ? "text-mint" :
          scoreTrendSign === "↓" ? "text-signal" :
          "text-muted-2"
        }`}>
          Trend: {scoreTrendStr}
        </div>
      </div>
    </div>
  );
}
