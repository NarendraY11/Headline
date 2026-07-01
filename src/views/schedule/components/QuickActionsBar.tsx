// Phase 2: Quick Actions — compact nav shortcuts for the planner right rail.

import { BarChart3, BookOpen, GraduationCap, Layers, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const ACTIONS = [
  { label: "Question Bank", to: "/modules",   icon: <Layers size={14} /> },
  { label: "Practice",      to: "/practice",  icon: <GraduationCap size={14} /> },
  { label: "Review",        to: "/review",    icon: <Zap size={14} /> },
  { label: "Progress",      to: "/analytics", icon: <BarChart3 size={14} /> },
  { label: "Today",         to: "/today",     icon: <BookOpen size={14} /> },
] as const;

export function QuickActionsBar() {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 block mb-3">
        Quick Actions
      </span>
      <div className="grid grid-cols-1 gap-1.5">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex items-center gap-2.5 h-9 px-3 rounded-lg border border-rule text-ink hover:bg-bg-2 hover:border-rule-strong transition-colors font-sans text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span className="text-muted-2 flex-shrink-0" aria-hidden="true">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
