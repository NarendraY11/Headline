// UX-Nav Phase 2C: Enrollment tab — re-homes the old Learning Context page inside
// the Profile workspace, presented as a learning *journey* (current stage →
// milestones) rather than a flat field grid. Read-only; all values rendered
// human-readable (no raw IDs surfaced).

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Plane, Compass, Target, Layers, BadgeCheck, BookOpen } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { resolveActiveLearningContext } from "../../lib/learningContextDb";
import { fetchMergedSubjects } from "../../lib/content";
import { trackEvent } from "../../lib/track";
import type { ActiveLearningContext } from "../../lib/learningContext";
import type { SubjectItem } from "../../data/topics";

// Curated labels for the common canonical slugs; anything unmapped falls back to
// prettify() so a raw slug never reaches the UI as-is.
const CERT_LABELS: Record<string, string> = {
  "dgca-cpl": "DGCA CPL", "dgca-atpl": "DGCA ATPL", "dgca-rtr": "DGCA RTR", "dgca-ppl": "DGCA PPL",
  "faa-ppl": "FAA PPL", "faa-cpl": "FAA CPL", "faa-atpl": "FAA ATPL", "easa-atpl": "EASA ATPL",
};
const AIRCRAFT_LABELS: Record<string, string> = {
  a320: "Airbus A320", a330: "Airbus A330", b737: "Boeing 737", b777: "Boeing 777", atr72: "ATR 72",
};
const FAMILY_LABELS: Record<string, string> = {
  dgca: "DGCA", type_rating: "Type Rating", faa: "FAA", easa: "EASA",
};
const CAREER_LABELS: Record<string, string> = {
  "airline-recruitment": "Airline Recruitment",
};

function prettify(slug: string | null | undefined): string {
  if (!slug) return "—";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slug)) return "—"; // hide accidental UUIDs
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function label(map: Record<string, string>, slug: string | null | undefined): string {
  if (!slug) return "—";
  return map[slug] ?? prettify(slug);
}

export default function EnrollmentTab() {
  const { user, userData } = useAuth();
  const [ctx, setCtx] = useState<ActiveLearningContext | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent("profile_enrollment_viewed");
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      resolveActiveLearningContext(user?.uid, {
        targetExam: (userData as any)?.targetExam ?? null,
        careerObjective: (userData as any)?.careerObjective ?? null,
      }),
      fetchMergedSubjects().catch(() => [] as SubjectItem[]),
    ])
      .then(([c, subs]) => { if (alive) { setCtx(c); setSubjects(subs); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.uid, userData]);

  const subjectTitle = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of subjects) m[s.id] = s.title;
    return m;
  }, [subjects]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 rounded-2xl bg-rule/40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-rule/40" />)}
        </div>
      </div>
    );
  }

  const enrolled = ctx?.source === "enrollment";
  const statusText =
    ctx?.source === "enrollment" ? "Active enrollment" :
    ctx?.source === "profile" ? "Set from preferences" :
    ctx?.source === "legacy" ? "From study profile" : "No active enrollment";

  const certLabel = label(CERT_LABELS, ctx?.certificationId);
  const scopeTitles = (ctx?.subjectScope ?? []).map((id) => subjectTitle[id] ?? prettify(id));

  // Journey milestones, ordered from program → certification → track → subjects.
  const milestones: { icon: typeof Plane; k: string; v: string }[] = [
    { icon: Layers,        k: "Training Program", v: prettify(ctx?.programId) },
    { icon: GraduationCap, k: "Certification",    v: certLabel },
    { icon: Compass,       k: "Track",            v: label(FAMILY_LABELS, ctx?.family) },
    { icon: Plane,         k: "Aircraft",         v: label(AIRCRAFT_LABELS, ctx?.aircraftId) },
    { icon: Target,        k: "Career Objective", v: label(CAREER_LABELS, ctx?.careerObjectiveId) },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Current-stage header */}
      <div className="rounded-2xl border border-rule bg-paper p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
          <BadgeCheck size={22} className="text-navy" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-2 mb-1">Current Stage</div>
          <div className="font-serif text-2xl text-ink truncate">{certLabel !== "—" ? certLabel : "Not enrolled yet"}</div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-2 mt-1">{statusText}</div>
        </div>
      </div>

      {/* Journey timeline — vertical rail through the milestones. */}
      <div className="relative pl-7">
        <div className="absolute left-[10px] top-2 bottom-2 w-px bg-rule" aria-hidden />
        <div className="space-y-3">
          {milestones.map(({ icon: Icon, k, v }) => (
            <div key={k} className="relative">
              <div className="absolute -left-7 top-3.5 w-[21px] h-[21px] rounded-full bg-paper border border-rule flex items-center justify-center">
                <Icon size={11} className="text-muted-2" />
              </div>
              <div className="rounded-xl border border-rule bg-paper px-5 py-3.5 flex items-center justify-between gap-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">{k}</span>
                <span className="font-serif text-lg text-ink text-right truncate">{v}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next milestone: subjects in the learning path. */}
      <div className="rounded-2xl border border-rule bg-paper p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 inline-flex items-center gap-2">
            <BookOpen size={13} /> Subjects in your learning path
          </span>
          <span className="font-mono text-[10px] text-muted-2 tabular-nums">{scopeTitles.length}</span>
        </div>
        {scopeTitles.length ? (
          <div className="flex flex-wrap gap-2">
            {scopeTitles.map((t, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-bg-2 border border-rule font-sans text-xs text-ink">{t}</span>
            ))}
          </div>
        ) : (
          <p className="font-sans text-sm text-muted-2">
            {enrolled ? "No subjects scoped yet." : "Pick a target certification to build your learning path."}
          </p>
        )}
      </div>
    </div>
  );
}
