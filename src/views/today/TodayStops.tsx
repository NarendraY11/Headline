import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export function TodayStops() {
  return (
    <>
      <div className="font-mono text-[10px] text-muted-2 tracking-widest uppercase mb-4 mt-8">
        TODAY · 4 STOPS
      </div>
      <div className="border-t border-rule" />

      <Link
        to="/quiz/mock-exam"
        className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-signal border border-signal/30 bg-signal/10">
            MOCK
          </span>
          <span className="font-serif text-lg text-ink font-medium">
            EASA Paper VI
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
            90m
          </span>
          <ArrowUpRight
            size={16}
            className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </Link>
      <Link
        to="/quiz/drill"
        className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-amber border border-amber/30 bg-amber/10">
            DRILL
          </span>
          <span className="font-serif text-lg text-ink font-medium">
            Met · Icing & TS
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
            22m
          </span>
          <ArrowUpRight
            size={16}
            className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </Link>
      <Link
        to="/topic/a320-systems"
        className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-navy border border-navy/30 bg-navy/5">
            ATA
          </span>
          <span className="font-serif text-lg text-ink font-medium">
            A320 · 36 Pneu
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
            18m
          </span>
          <ArrowUpRight
            size={16}
            className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </Link>
      <Link
        to="/quiz/viva"
        className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-mint border border-mint/30 bg-mint/10">
            VIVA
          </span>
          <span className="font-serif text-lg text-ink font-medium">
            Type · Evac
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
            12m
          </span>
          <ArrowUpRight
            size={16}
            className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </Link>
    </>
  );
}
