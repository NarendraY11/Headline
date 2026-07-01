import { CalendarDays, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function PlannerEmptyState() {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-10 flex flex-col items-center text-center gap-5">
      <div className="w-14 h-14 rounded-2xl bg-navy/8 dark:bg-navy/20 border border-navy/15 flex items-center justify-center">
        <CalendarDays size={26} className="text-navy" aria-hidden="true" />
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="font-serif text-[20px] text-ink leading-tight">No study plan yet</h2>
        <p className="font-sans text-sm text-muted-2 leading-relaxed">
          Generate your personalised study plan and start building your preparation schedule.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-navy text-paper font-sans text-[13px] font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Sparkles size={14} aria-hidden="true" />
          Generate Study Plan
        </Link>
        <Link
          to="/today"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-rule text-ink font-sans text-[13px] hover:border-rule-strong hover:bg-bg-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}
