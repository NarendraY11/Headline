// Phase 5.1: Interview Prep Hub — /interview-prep and child routes.
// Career objective content for users with careerObjective === "airline-recruitment".
// Child paths /technical /aptitude /hr are MVP "Coming Soon" stubs — real content Phase 6+.

import { ArrowLeft, ArrowRight, Briefcase, Brain, Users, ClipboardList } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// ── Section definitions ─────────────────────────────────────────────────────

interface PrepSection {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  duration: string;
  status: "coming_soon" | "active";
}

const PREP_SECTIONS: PrepSection[] = [
  {
    id: "technical",
    label: "Technical Interview",
    description: "Aircraft systems, aerodynamics, meteorology, and ATPL-level oral questions that airline panels ask.",
    icon: Briefcase,
    duration: "15–20 min sessions",
    status: "coming_soon",
  },
  {
    id: "aptitude",
    label: "Aptitude Assessment",
    description: "Numerical reasoning, spatial awareness, and multi-tasking drills used in airline selection tests.",
    icon: Brain,
    duration: "10–15 min sessions",
    status: "coming_soon",
  },
  {
    id: "hr",
    label: "HR Preparation",
    description: "Competency-based interview scenarios, CRM questions, and situational judgement practice.",
    icon: Users,
    duration: "8–12 min sessions",
    status: "coming_soon",
  },
];

// ── Child page (stub) ────────────────────────────────────────────────────────

function InterviewPrepSection() {
  const { section } = useParams<{ section: string }>();
  const config = PREP_SECTIONS.find(s => s.id === section);

  if (!config) {
    return (
      <div className="max-w-[640px] mx-auto px-4 pt-16 pb-20">
        <Link
          to="/interview-prep"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft size={13} /> Interview Prep
        </Link>
        <p className="font-sans text-sm text-muted-2">Section not found.</p>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="max-w-[640px] mx-auto px-4 pt-16 pb-20">
      <Link
        to="/interview-prep"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors mb-8"
      >
        <ArrowLeft size={13} /> Interview Prep
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-navy" />
        </div>
        <div>
          <h1 className="font-serif text-[28px] text-ink leading-tight">{config.label}</h1>
          <span className="font-mono text-[10px] text-muted-2 uppercase tracking-wider">{config.duration}</span>
        </div>
      </div>

      <p className="font-sans text-[15px] text-ink-2 leading-relaxed mb-10">{config.description}</p>

      {/* Coming Soon state */}
      <div
        className="border border-rule rounded-[20px] p-8 bg-paper text-center"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy/10 font-mono text-[10px] text-navy uppercase tracking-widest font-bold mb-4">
          <ClipboardList size={11} /> Coming in Phase 6
        </span>
        <h2 className="font-serif text-[22px] text-ink mb-2">Content under construction</h2>
        <p className="font-sans text-[13px] text-muted-2 leading-relaxed max-w-sm mx-auto mb-6">
          {config.label} practice sessions are being built. You'll be notified when they launch.
        </p>
        <Link
          to="/interview-prep"
          className="inline-flex items-center gap-2 h-10 px-5 bg-ink text-bg rounded-full font-sans text-sm font-medium hover:bg-ink-2 transition-colors"
        >
          Back to Interview Prep
        </Link>
      </div>
    </div>
  );
}

// ── Hub page ─────────────────────────────────────────────────────────────────

export default function InterviewPrepView() {
  const { userData } = useAuth();
  const trackLabel = userData?.targetExam
    ? userData.targetExam.replace("dgca-", "DGCA ").replace("type-", "").toUpperCase()
    : "your track";

  return (
    <div className="max-w-[640px] mx-auto px-4 pt-12 md:pt-16 pb-20">
      {/* Header */}
      <div className="mb-10">
        <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-3">
          § CAREER OBJECTIVE · AIRLINE RECRUITMENT
        </div>
        <h1 className="font-serif text-[38px] md:text-[48px] leading-[1.05] text-ink tracking-tight mb-3">
          Interview <span className="italic text-navy">Prep</span>
        </h1>
        <p className="font-sans text-[15px] text-ink-2 leading-relaxed">
          Airline hiring preparation layered on top of {trackLabel} exam training. Tackle technical screening, aptitude tests, and HR rounds.
        </p>
      </div>

      {/* Section cards */}
      <div className="space-y-3 mb-10">
        {PREP_SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              to={`/interview-prep/${section.id}`}
              className="flex items-center gap-4 p-5 border border-rule rounded-[18px] bg-paper hover:border-ink/30 hover:bg-bg-2 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-sans text-[15px] font-medium text-ink">{section.label}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rule font-mono text-[8px] text-muted-2 uppercase tracking-widest">
                    Soon
                  </span>
                </div>
                <div className="font-sans text-[12px] text-muted-2 leading-snug">{section.description}</div>
                <div className="font-mono text-[10px] text-muted mt-1">{section.duration}</div>
              </div>
              <ArrowRight
                size={15}
                className="text-muted-2 group-hover:text-ink group-hover:translate-x-0.5 transition-all flex-shrink-0"
              />
            </Link>
          );
        })}
      </div>

      {/* Roadmap note */}
      <div className="border border-rule/60 rounded-[16px] p-4 bg-bg/60">
        <p className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mb-1 font-bold">ROADMAP</p>
        <p className="font-sans text-[12px] text-muted-2 leading-relaxed">
          Full interview prep content — question banks, mock panels, and hiring-readiness scores — launches in Phase 6. Your career objective is saved; all sections will auto-unlock when live.
        </p>
      </div>
    </div>
  );
}

// Named export for child route — used as Route element in App.tsx
export { InterviewPrepSection };
