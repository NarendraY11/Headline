import { GraduationCap } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { Link } from "react-router-dom";
import { TILE_BASE } from "./tileClasses";

interface CertificationTileProps {
  readinessPercentage: number;
  passedCount: number;
  subjectCount: number;
}

export function CertificationTile({ readinessPercentage, passedCount, subjectCount }: CertificationTileProps) {
  return (
    <div className={TILE_BASE}>
      <div>
        <div className="flex items-center gap-1.5 mb-1 text-muted-2">
          <GraduationCap size={14} className="text-navy" />
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
            CERT PROGRESS
          </span>
        </div>
        <div className="font-serif text-[26px] text-ink leading-none mt-2">
          <AnimatedCounter value={readinessPercentage} />
          <span className="font-sans text-xl text-muted font-normal tracking-normal">%</span>
        </div>
        <div className="mt-2 font-mono text-[9px] text-muted-2 tracking-wide">
          {passedCount}/{subjectCount} subjects ≥80%
        </div>
        <div className="w-full bg-bg h-1.5 rounded-full mt-3 overflow-hidden border border-rule/50">
          <div
            className="bg-navy h-full transition-all duration-500 ease-out"
            style={{ width: `${readinessPercentage}%` }}
          />
        </div>
      </div>
      <Link to="/course" className="font-mono text-[9px] uppercase tracking-wide text-navy hover:opacity-70 transition-opacity mt-2 inline-block">
        View Course →
      </Link>
    </div>
  );
}
