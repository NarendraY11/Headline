import type { ComponentType } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Layers3,
  Newspaper,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/Atoms";
import { FlightControlsDiagram } from "../../components/SystemDiagram";
import type { FlagKeys } from "../../hooks/useFeatureFlags";
import { featureRegistry } from "./featureRegistry";

export interface PreviewRouteDefinition {
  featureKey: FlagKeys;
  path: string;
  title: string;
  summary: string;
  component: ComponentType;
}

function MockExamsRoutePreview() {
  const exams = [
    {
      code: "DGCA CPL",
      title: "Commercial Pilot License Mock Deck",
      duration: "150 min",
      questions: 100,
      cta: "Explore syllabus",
    },
    {
      code: "EASA ATPL",
      title: "Fourteen-subject practice feed",
      duration: "90 min",
      questions: 60,
      cta: "Open simulator",
    },
    {
      code: "A320 TYPE",
      title: "Systems technical paper",
      duration: "120 min",
      questions: 80,
      cta: "Review modules",
    },
  ];

  return (
    <div className="bg-bg min-h-full">
      <div className="border-b border-rule bg-paper px-5 py-4">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-2">
          <Plane size={12} className="text-sky" />
          Mock Exam Catalog
        </div>
        <h2 className="mt-2 font-serif text-2xl text-ink">Authority-aligned simulator decks</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Practice timed mock exams, topic drills, and full-paper simulations with a route surface
          that stays entirely local inside preview mode.
        </p>
      </div>

      <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
        {exams.map((exam) => (
          <div
            key={exam.code}
            className="rounded-xl border border-rule-strong bg-paper p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                {exam.code}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-mint">
                available
              </span>
            </div>
            <h3 className="mt-4 font-serif text-xl text-ink">{exam.title}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-rule bg-bg-2/40 p-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
                  duration
                </div>
                <div className="mt-1 text-sm font-semibold text-ink">{exam.duration}</div>
              </div>
              <div className="rounded-lg border border-rule bg-bg-2/40 p-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
                  question set
                </div>
                <div className="mt-1 text-sm font-semibold text-ink">{exam.questions} items</div>
              </div>
            </div>
            <button
              type="button"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-ink bg-ink px-4 text-xs font-mono uppercase tracking-widest text-bg"
            >
              {exam.cta}
              <ArrowRight size={12} />
            </button>
          </div>
        ))}

        <div className="rounded-xl border border-rule-strong bg-panel p-5 md:col-span-2">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-2">
            <Layers3 size={12} className="text-amber" />
            Mock history snapshot
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Recent score", "84%"],
              ["Best streak", "6 passed"],
              ["Active deck", "DGCA CPL"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-rule bg-paper p-4">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
                  {label}
                </div>
                <div className="mt-2 font-serif text-xl text-ink">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogRoutePreview() {
  const posts = [
    {
      title: "DGCA Air Navigation Study Blueprint",
      category: "Study Guide",
      meta: "8 min read",
    },
    {
      title: "How cadets structure A320 systems revision",
      category: "Type Rating",
      meta: "6 min read",
    },
    {
      title: "FAA written prep: high-yield weather blocks",
      category: "Exam Tactics",
      meta: "5 min read",
    },
  ];

  return (
    <div className="bg-bg min-h-full">
      <div className="border-b border-rule bg-paper px-5 py-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-navy/20 bg-navy/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-navy">
          <Sparkles size={11} />
          Pilot Knowledge Center
        </div>
        <h2 className="mt-3 font-serif text-3xl text-ink">Theoretical Flight Blog</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Public content route with static preview cards, local search scaffolding, and no live
          Supabase reads.
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-rule-strong bg-paper p-4">
            <div className="flex items-center gap-3 rounded-lg border border-rule bg-bg-2/30 px-3 py-3 text-sm text-muted-2">
              <BookOpen size={15} />
              Search aviation articles, exam questions, systems...
            </div>
          </div>

          {posts.map((post) => (
            <div key={post.title} className="rounded-xl border border-rule-strong bg-paper p-5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                <span>{post.category}</span>
                <span className="text-rule-strong">|</span>
                <span>{post.meta}</span>
              </div>
              <h3 className="mt-3 font-serif text-xl text-ink">{post.title}</h3>
              <p className="mt-2 text-sm text-muted">
                Mocked article card previewing the public blog index without fetching database posts.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-navy"
              >
                Read chapter
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-rule-strong bg-paper p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              <Newspaper size={12} className="text-amber" />
              Sidebar module
            </div>
            <p className="mt-3 text-sm text-muted">
              Related exam centers, CTA blocks, and sponsored areas stay visible in route preview
              mode.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-rule bg-bg-2/50 p-5 text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
              Ad slot placeholder
            </div>
            <div className="mt-6 text-xs text-muted">No third-party scripts loaded in preview.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExamSeoPagesRoutePreview() {
  const subjects = [
    "Air Navigation",
    "Aviation Meteorology",
    "Air Regulations",
    "Technical General",
  ];

  return (
    <div className="bg-bg min-h-full">
      <div className="border-b border-rule bg-paper px-5 py-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-2">
          <ShieldCheck size={12} className="text-navy" />
          Public exam landing page
        </div>
        <h2 className="mt-2 font-serif text-3xl text-ink">DGCA Commercial Pilot License Exams</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Search-facing route preview with static syllabus data, FAQ scaffolding, and no auth or
          remote content dependencies.
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="rounded-xl border border-rule-strong bg-paper p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Pass mark", "70%"],
                ["Duration", "2.5 hours"],
                ["Question count", "100"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-rule bg-bg-2/40 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
                    {label}
                  </div>
                  <div className="mt-2 font-serif text-lg text-ink">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-rule-strong bg-paper p-5">
            <h3 className="font-serif text-xl text-ink">Syllabus blocks</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {subjects.map((subject) => (
                <div key={subject} className="rounded-lg border border-rule bg-bg-2/30 p-4">
                  <div className="font-serif text-base text-ink">{subject}</div>
                  <p className="mt-2 text-sm text-muted">
                    Sample subject card used to preview public SEO route composition.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-rule-strong bg-navy p-5 text-bg shadow-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber">
            conversion block
          </div>
          <h3 className="mt-3 font-serif text-2xl">Simulator practice deck</h3>
          <p className="mt-3 text-sm text-bg/80">
            CTA area remains mocked in preview mode. No auth modal, checkout flow, or payment
            integration is triggered here.
          </p>
          <Button
            variant="primary"
            className="mt-5 h-10 border-0 bg-amber px-4 text-xs font-mono uppercase tracking-widest text-navy hover:bg-amber"
          >
            Launch Free Trials
          </Button>
        </aside>
      </div>
    </div>
  );
}

function A320SystemsRoutePreview() {
  return (
    <div className="bg-bg min-h-full">
      <div className="border-b border-rule bg-paper px-5 py-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-2">
          <Plane size={12} className="text-signal" />
          ATA 21-80 systems
        </div>
        <h2 className="mt-2 font-serif text-3xl text-ink">Interactive A320 Schematics</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Product-style route preview with static marketing shell and a local systems diagram.
        </p>
      </div>

      <div className="grid gap-6 px-5 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-2">
            Type rating preview
          </div>
          <h3 className="mt-4 font-serif text-4xl leading-tight text-ink">
            Stop memorizing static PDFs.
          </h3>
          <p className="mt-4 text-sm leading-6 text-muted">
            Explore dynamic ECAM logic, ATA chapter structure, and cockpit-grade schematics through
            a safe mock route that never reaches networked services.
          </p>
          <button
            type="button"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-xs font-mono uppercase tracking-widest text-bg"
          >
            Access the module
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="rounded-[24px] border border-rule bg-paper p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
                Systems canvas
              </div>
              <div className="mt-1 text-sm text-muted">Mocked diagram surface for route preview.</div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted">
              <Clock3 size={11} />
              live mock
            </div>
          </div>
          <div className="min-h-[260px] overflow-hidden rounded-2xl border border-rule bg-bg/40 p-4">
            <FlightControlsDiagram />
          </div>
        </div>
      </div>
    </div>
  );
}

export const previewRoutes: Partial<Record<FlagKeys, PreviewRouteDefinition>> = {
  mockExams: {
    featureKey: "mockExams",
    path: "/admin/features/preview/mockExams",
    title: featureRegistry.mockExams.title,
    summary: "Mock exam catalog and selection deck preview.",
    component: MockExamsRoutePreview,
  },
  blog: {
    featureKey: "blog",
    path: "/admin/features/preview/blog",
    title: featureRegistry.blog.title,
    summary: "Public blog list layout with static article cards.",
    component: BlogRoutePreview,
  },
  examSeoPages: {
    featureKey: "examSeoPages",
    path: "/admin/features/preview/examSeoPages",
    title: featureRegistry.examSeoPages.title,
    summary: "Public exam SEO landing page preview.",
    component: ExamSeoPagesRoutePreview,
  },
  a320Systems: {
    featureKey: "a320Systems",
    path: "/admin/features/preview/a320Systems",
    title: featureRegistry.a320Systems.title,
    summary: "A320 systems marketing route with local schematic canvas.",
    component: A320SystemsRoutePreview,
  },
};
