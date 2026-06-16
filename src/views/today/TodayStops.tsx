import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { SubjectItem } from "../../data/topics";

type StopType = "MOCK" | "DRILL" | "REVIEW" | "VIVA";

interface TodayStopsProps {
  subjectsList: SubjectItem[];
  subjectMastery: Record<string, number>;
  dueCount: number;
  hasAttempts: boolean;
}

const HUE: Record<string, { text: string; border: string; bg: string }> = {
  navy:   { text: "text-navy",   border: "border-navy/30",   bg: "bg-navy/5"    },
  sky:    { text: "text-sky",    border: "border-sky/30",    bg: "bg-sky/10"    },
  amber:  { text: "text-amber",  border: "border-amber/30",  bg: "bg-amber/10"  },
  signal: { text: "text-signal", border: "border-signal/30", bg: "bg-signal/10" },
  mint:   { text: "text-mint",   border: "border-mint/30",   bg: "bg-mint/10"   },
};

function stopDuration(questionCount: number): string {
  if (questionCount >= 300) return "45m";
  if (questionCount >= 100) return "30m";
  return "20m";
}

const SHORT_TITLES: Record<string, string> = {
  "Air Navigation":             "Air Navigation",
  "Aviation Meteorology":       "Meteorology",
  "Air Regulation":             "Air Regulation",
  "Aircraft General Knowledge": "Aircraft Gen.",
  "Airbus A320 Systems":        "A320 Systems",
  "DGCA Technical General":     "Tech General",
  "Principles of Flight":       "Flight Principles",
};

function shortTitle(title: string): string {
  return SHORT_TITLES[title] ?? title.split(" ").slice(0, 2).join(" ");
}

export function TodayStops({ subjectsList, subjectMastery, dueCount }: TodayStopsProps) {
  const stops: {
    type: StopType;
    label: string;
    subLabel: string;
    to: string;
    duration: string;
    hue: string;
  }[] = [];

  if (dueCount > 0) {
    stops.push({
      type: "REVIEW",
      label: "Spaced Review",
      subLabel: `${dueCount} ${dueCount === 1 ? "item" : "items"} due`,
      to: "/quiz/review",
      duration: `${Math.min(45, Math.ceil(dueCount * 1.5))}m`,
      hue: "signal",
    });
  }

  const weakest = [...subjectsList]
    .filter(s => s.status === "active")
    .map(s => ({ ...s, m: subjectMastery[s.id] ?? 0 }))
    .sort((a, b) => a.m - b.m)
    .slice(0, dueCount > 0 ? 2 : 3);

  for (const sub of weakest) {
    stops.push({
      type: "DRILL",
      label: shortTitle(sub.title),
      subLabel: `${Math.round(sub.m)}% mastery`,
      to: `/topic/${sub.id}`,
      duration: stopDuration(sub.questionCount),
      hue: sub.hue ?? "navy",
    });
  }

  if (stops.length < 4) {
    stops.push({
      type: "MOCK",
      label: "DGCA Mock Paper",
      subLabel: "Full simulation",
      to: "/mock-exams",
      duration: "90m",
      hue: "navy",
    });
  }

  if (stops.length === 0) {
    stops.push(
      { type: "MOCK",  label: "DGCA Mock Paper", subLabel: "Full simulation", to: "/mock-exams",              duration: "90m", hue: "navy" },
      { type: "DRILL", label: "Air Navigation",  subLabel: "Core questions",  to: "/topic/air-navigation",   duration: "30m", hue: "navy" },
      { type: "DRILL", label: "Meteorology",     subLabel: "Core questions",  to: "/topic/meteorology",      duration: "20m", hue: "sky"  },
    );
  }

  return (
    <>
      <div className="font-mono text-[10px] text-muted-2 tracking-widest uppercase mb-4 mt-8">
        TODAY · {stops.length} STOPS
      </div>
      <div className="border-t border-rule" />

      {stops.map((stop, i) => {
        const h = HUE[stop.hue] ?? HUE.navy;
        return (
          <Link
            key={i}
            to={stop.to}
            className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
          >
            <div className="flex items-center gap-4">
              <span className={`font-mono text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border ${h.text} ${h.border} ${h.bg}`}>
                {stop.type}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-serif text-lg text-ink font-medium block truncate">{stop.label}</span>
                <span className="font-mono text-[10px] text-muted-2 tracking-wide">{stop.subLabel}</span>
              </div>
              <span className="font-mono text-[10px] text-muted-2 uppercase shrink-0">{stop.duration}</span>
              <ArrowUpRight size={16} className="text-muted ml-1 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        );
      })}
    </>
  );
}
