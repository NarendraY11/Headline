import { Clock } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { TILE_BASE } from "./tileClasses";

interface HoursTileProps {
  hasAttempts: boolean;
  hoursThisWeek: number;
  hoursStudied: number;
}

export function HoursTile({ hasAttempts, hoursThisWeek, hoursStudied }: HoursTileProps) {
  return (
    <div className={TILE_BASE}>
      <div>
        <div className="flex items-center gap-1.5 mb-1 text-muted-2">
          <Clock size={14} />
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
            HOURS · 7D
          </span>
        </div>
        <div className="font-serif text-[26px] text-ink leading-none mt-2">
          {hasAttempts ? <AnimatedCounter value={hoursThisWeek} /> : 0}{" "}
          <span className="font-sans text-xl text-muted font-normal lowercase tracking-normal">
            hrs
          </span>
        </div>
        <div className="mt-2 font-mono text-[9px] text-muted-2 tracking-wide">
          Total: {hoursStudied}h
        </div>
        {hoursStudied === 0 && (
          <div className="mt-2 font-mono text-[9px] text-muted-2 tracking-wide leading-relaxed">
            Complete a session to track hours
          </div>
        )}
      </div>
    </div>
  );
}
