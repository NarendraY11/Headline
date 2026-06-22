// Phase 5B: Career objective secondary mission block.
// Shown only when careerObjective === "airline-recruitment" (or future values).
// Does NOT replace the primary academic mission — adds alongside it.

import { ArrowRight, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { getCareerMission } from "../../config/missionConfig";

interface CareerObjectiveMissionsProps {
  careerObjective: string | null | undefined;
}

export function CareerObjectiveMissions({ careerObjective }: CareerObjectiveMissionsProps) {
  const mission = getCareerMission(careerObjective);
  if (!mission) return null;

  return (
    <section
      aria-labelledby="career-mission-heading"
      className="border border-rule rounded-[20px] p-5 bg-paper"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
          <Briefcase size={15} className="text-navy" />
        </div>
        <div>
          <h2
            id="career-mission-heading"
            className="font-mono text-[10px] font-bold uppercase tracking-widest text-navy"
          >
            {mission.title}
          </h2>
          <p className="font-sans text-[11px] text-muted-2 mt-0.5">{mission.description}</p>
        </div>
      </div>

      <div className="space-y-2">
        {mission.items.map(item => (
          <Link
            key={item.label}
            to={item.to}
            className="flex items-center justify-between p-3.5 rounded-[14px] border border-rule hover:border-ink/30 bg-bg hover:bg-bg-2 transition-all group"
          >
            <div>
              <div className="font-sans text-[13px] font-medium text-ink">{item.label}</div>
              <div className="font-mono text-[10px] text-muted-2 mt-0.5">{item.duration}</div>
            </div>
            <ArrowRight
              size={14}
              className="text-muted-2 group-hover:text-ink group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-3"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
