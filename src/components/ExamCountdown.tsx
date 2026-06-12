// M13: ExamCountdown — compact widget showing days to next exam

import { Clock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  className?: string;
}

export function ExamCountdown({ className = "" }: Props) {
  const { userData } = useAuth();
  const examDate = userData?.nextExam ?? "";

  if (!examDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(examDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return null; // exam passed

  const urgent = diff <= 7;
  const soon = diff <= 30;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
        urgent
          ? "bg-signal/10 border-signal/20"
          : soon
          ? "bg-amber/10 border-amber/20"
          : "bg-bg-2 border-rule"
      } ${className}`}
    >
      <Clock
        size={13}
        className={urgent ? "text-signal" : soon ? "text-amber" : "text-muted-2"}
      />
      <div>
        <p
          className={`font-serif text-[18px] leading-none ${
            urgent ? "text-signal" : soon ? "text-amber" : "text-ink"
          }`}
        >
          {diff}
          <span className="font-sans text-xs font-normal ml-1 text-muted">
            day{diff !== 1 ? "s" : ""}
          </span>
        </p>
        <p className="font-mono text-[7px] uppercase tracking-wide text-muted-2">to exam</p>
      </div>
      {urgent && (
        <span className="ml-auto font-mono text-[8px] uppercase tracking-wide text-signal font-bold">
          Final approach
        </span>
      )}
    </div>
  );
}
