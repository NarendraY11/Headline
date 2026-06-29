import { ArrowUpRight, CheckCircle2, Menu, MoveRight, User, X } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Chip, CompassLogomark, Wordmark } from "../components/Atoms";
import DailyStudyGoal from "../components/DailyStudyGoal";
import LeadCapture from "../components/LeadCapture";
import { FlightControlsDiagram } from "../components/SystemDiagram";
import { useAuth } from "../contexts/AuthContext";
import { useHomeStats } from "../hooks/useHomeStats";
import { HOME_FAQ } from "../lib/jsonLd";
import { FadeUp } from "./home/FadeUp";
import { FAQItem } from "./home/FAQItem";
import { InteractiveSampleQuestion } from "./home/InteractiveSampleQuestion";
import { LazyChartWrapper } from "./home/LazyChartWrapper";

interface SiteContent {
  hero_subheadline?: string;
  hero_cta_primary?: string;
  hero_cta_secondary?: string;
  stats_question_count_label?: string;
  stats_subjects_label?: string;
  stats_pilots_label?: string;
}

export default function HomeView() {
  const { user, openAuthModal } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { stats, previewQuestions: questions } = useHomeStats();

  const liveQuestionsCount = stats.questionsCount;
  const liveSubjectsCount = stats.subjectsCount;
  const platformAnsweredCount = stats.attemptsCount;
  const activePilotsCount = stats.pilotsCount;
  const siteContent = stats.siteContent as SiteContent;

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Heading",
    "url": window.location.origin,
    "logo": `${window.location.origin}/icon.png`,
    "description": "Premium aviation exam preparation platform for commercial pilots. Simulated stress flight environments for EASA, FAA, and DGCA exams.",
    "sameAs": [
      "https://twitter.com/headingpilot",
      "https://github.com/headingpilot"
    ]
  };

  return (
    <div className="min-h-screen relative flex items-stretch flex-col bg-bg font-sans overflow-x-hidden">
      {/* Inject Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(orgJsonLd)}
      </script>

      {/* MARKETING TOP NAV */}
      <header className="h-[72px] flex items-center justify-between px-4 sm:px-6 lg:px-10 bg-bg z-50 absolute top-0 w-full left-0 right-0 border-b border-rule/50">
        <Link to="/" className="hover:opacity-90 transition-opacity flex items-center gap-3">
          <Wordmark compassSize={24} />
          <span className="hidden sm:inline-block font-mono text-[9px] text-muted tracking-[0.2em] uppercase border border-rule px-1.5 py-0.5 rounded-[4px] mt-0.5">FL · 380</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-8 font-sans text-[13px] tracking-wide text-ink-2" aria-label="Primary site navigation">
          <Link to="/modules" className="hover:text-ink transition-colors px-2 py-2">Question bank</Link>
          <Link to="/mock-exams" className="hover:text-ink transition-colors px-2 py-2">Mock exams</Link>
          <Link to="/a320-systems" className="hover:text-ink transition-colors px-2 py-2">A320 systems</Link>
          <Link to="/pricing" className="hover:text-ink transition-colors px-2 py-2">Pricing</Link>
        </nav>
        <div className="flex items-center gap-3 sm:gap-6">
          {user ? (
            <>
              <Link to="/today" className="text-[13px] font-sans font-medium text-ink hover:text-ink-2 transition-colors hidden sm:block">Dashboard</Link>
              <Link to="/today">
                <Button variant="primary" className="h-[44px] px-4 sm:px-5 text-[13px] font-sans font-medium rounded-full bg-ink text-bg border-0 hover:bg-ink-2">Resume studying <MoveRight size={14} className="ml-1.5" /></Button>
              </Link>
            </>
          ) : (
            <>
              <button onClick={() => openAuthModal("signin")} className="hidden sm:block text-[13px] font-sans font-medium text-ink hover:text-ink-2 transition-colors cursor-pointer">Sign in</button>
              <Button onClick={() => openAuthModal("signup")} variant="primary" className="h-[44px] px-4 sm:px-5 text-[13px] font-sans font-medium rounded-full bg-ink text-bg border-0 hover:bg-ink-2 hidden sm:flex">Start studying <MoveRight size={14} className="ml-1.5" /></Button>
            </>
          )}
          {/* Mobile hamburger — home has its own header so PublicLayout's menu doesn't apply here */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink hover:bg-rule/20 rounded-lg transition-colors"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* MOBILE NAV DRAWER */}
      {mobileNavOpen && (
        <div className="fixed inset-0 top-[72px] z-40 bg-bg/95 backdrop-blur-xl flex flex-col lg:hidden overflow-y-auto">
          <nav className="flex flex-col p-4 gap-1 font-sans text-base mt-2">
            <Link to="/qotd" onClick={() => setMobileNavOpen(false)} className="py-3 px-4 rounded-lg hover:bg-bg-2 transition-colors flex justify-between items-center text-ink">Try a free question <MoveRight size={16} className="text-muted" /></Link>
            <Link to="/modules" onClick={() => setMobileNavOpen(false)} className="py-3 px-4 rounded-lg hover:bg-bg-2 transition-colors flex justify-between items-center text-ink">Question bank <MoveRight size={16} className="text-muted" /></Link>
            <Link to="/mock-exams" onClick={() => setMobileNavOpen(false)} className="py-3 px-4 rounded-lg hover:bg-bg-2 transition-colors flex justify-between items-center text-ink">Mock exams <MoveRight size={16} className="text-muted" /></Link>
            <Link to="/a320-systems" onClick={() => setMobileNavOpen(false)} className="py-3 px-4 rounded-lg hover:bg-bg-2 transition-colors flex justify-between items-center text-ink">A320 systems <MoveRight size={16} className="text-muted" /></Link>
            <Link to="/pricing" onClick={() => setMobileNavOpen(false)} className="py-3 px-4 rounded-lg hover:bg-bg-2 transition-colors flex justify-between items-center text-ink">Pricing <MoveRight size={16} className="text-muted" /></Link>
            <div className="border-t border-rule mt-4 pt-4 flex flex-col gap-2 px-4">
              {user ? (
                <Link to="/today" onClick={() => setMobileNavOpen(false)}>
                  <Button variant="primary" className="w-full h-[48px] rounded-full bg-ink text-bg border-0">Resume studying <MoveRight size={14} className="ml-1.5" /></Button>
                </Link>
              ) : (
                <>
                  <button onClick={() => { setMobileNavOpen(false); openAuthModal("signup"); }} className="w-full h-[48px] rounded-full bg-ink text-bg font-sans text-[14px] font-medium flex items-center justify-center gap-2">Start studying <MoveRight size={14} /></button>
                  <button onClick={() => { setMobileNavOpen(false); openAuthModal("signin"); }} className="w-full h-[48px] rounded-full border border-rule text-ink font-sans text-[14px] font-medium flex items-center justify-center">Sign in</button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* MAIN CONTENT — plain wrapper; PublicLayout supplies the <main> landmark */}
      <div>
        {/* 1. SEC: HERO */}
        <section className="relative pt-[calc(72px+1.5rem)] pb-12 md:pt-20 md:pb-20 w-full flex justify-center overflow-hidden">
        {/* REPLACED WATERMARKED VIDEO WITH ELEGANT BLUEPRINT AND AMBIENT GRADIENT */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#f3eee0] via-[#f8f5ed] to-[#ede8dc] z-0" />
        <div className="absolute inset-0 blueprint pointer-events-none opacity-[0.25] z-[1]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_30%,#f2ede0_90%)] opacity-60 z-[1]" />

        {/* BIG BACKGROUND COMPASS */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] md:w-[300px] xl:w-[560px] aspect-square pointer-events-none" style={{ zIndex: 2 }}>
          <div className="anim-compass-intro w-full h-full">
            <CompassLogomark size="100%" spin="rotate" spinDuration={32} className="text-rule opacity-[0.13]" />
          </div>
        </div>
        
        {/* CONTENT ENVELOPE */}
        <div className="px-6 w-full max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center gap-12 md:gap-8 md:overflow-visible relative" style={{ zIndex: 3 }}>
          
          {/* LEFT COLUMN */}
          {/* The hero sits on a fixed cream gradient in BOTH themes, so pin the
              ink/navy/muted tokens to their light-theme values here. Otherwise
              the dark theme flips `text-ink` to near-white → invisible on cream.
              --color-bg is also pinned so bg-ink/text-bg buttons stay readable:
              button uses bg-ink (pinned dark navy) + text-bg (pinned cream) = ✓ */}
          <div
            className="flex-1 md:max-w-[50%] lg:max-w-2xl relative z-10 w-full min-w-0"
            style={{
              "--color-bg": "#f5f2ea",
              "--color-bg-2": "#ebe7dc",
              "--color-ink": "#0d1a2d",
              "--color-ink-2": "#1a2c47",
              "--color-navy": "#14305a",
              "--color-muted": "#334155",
              "--color-muted-2": "#475569",
              "--color-rule": "rgba(13, 26, 45, 0.10)",
            } as CSSProperties}
          >
          <FadeUp immediate>
            <span className="eyebrow block mb-5 font-mono text-[10px] uppercase tracking-widest text-muted-2 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
              <span className="tracking-[0.25em]">EXAM PREP · DGCA · EASA · ATPL · TYPE RATING</span>
            </span>
            <h1 
              className="font-serif text-[32px] sm:text-[38px] md:text-[48px] lg:text-[80px] xl:text-[100px] leading-[0.95] tracking-tight text-ink mb-6 md:mb-8 select-none whitespace-normal break-words min-w-0"
              style={{ textShadow: '0 2px 8px rgba(242, 238, 228, 0.7)' }}
            >
              Fly the <span className="italic text-navy">checkride</span><br />
              before the checkride.
            </h1>
            <p className="font-sans text-[16px] md:text-[18px] lg:text-[22px] text-ink-2 font-light max-w-[560px] mb-8 lg:mb-10 leading-relaxed md:leading-[1.6]">
              {siteContent.hero_subheadline || "Heading is a question bank, mock-exam engine, and A320 systems reference built for student pilots, line crews on type, and the instructors who sign them off."}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 md:mb-14 lg:mb-16">
               <Link to="/qotd" className="w-full sm:w-auto">
                 <Button variant="primary" className="h-[56px] min-h-[56px] px-8 text-[16px] font-medium w-full shadow-lg rounded-full bg-ink text-bg hover:bg-ink-2 transition-colors">
                   Try a free question <MoveRight size={16} className="ml-2" />
                 </Button>
               </Link>
               <Link to="/modules" className="w-full sm:w-auto">
                 <Button variant="ghost" className="h-[56px] min-h-[56px] px-8 text-[16px] font-medium w-full rounded-full border border-rule hover:bg-bg-2 text-ink transition-colors">
                   See the question bank
                 </Button>
               </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 border-t border-rule/30 pt-8 w-full mt-6">
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-ink tracking-tight leading-none">{liveQuestionsCount.toLocaleString()}</span>
                <span className="font-mono text-[11px] tracking-widest text-muted-2 uppercase">{siteContent.stats_question_count_label || "QUESTIONS AVAILABLE"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-ink tracking-tight leading-none">{liveSubjectsCount}</span>
                <span className="font-mono text-[11px] tracking-widest text-muted-2 uppercase">{siteContent.stats_subjects_label || "SUBJECTS COVERED"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-ink tracking-tight leading-none">{platformAnsweredCount.toLocaleString()}</span>
                <span className="font-mono text-[11px] tracking-widest text-muted-2 uppercase">PLATFORM RESPONSES</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-ink tracking-tight leading-none">{activePilotsCount}</span>
                <span className="font-mono text-[11px] tracking-widest text-muted-2 uppercase">{siteContent.stats_pilots_label || "PILOTS ENROLLED"}</span>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex-1 w-full flex justify-center md:justify-end shrink-0 relative min-w-0">
           <FadeUp delay={100} className="w-full flex justify-center md:block md:w-auto overflow-hidden sm:overflow-visible">
             <InteractiveSampleQuestion questions={questions} />
           </FadeUp>
        </div>
        
        </div>
      </section>

      {/* IMPLICIT SOCIAL-PROOF MATRIX */}
      <div className="w-full border-y border-rule bg-paper overflow-hidden py-8">
         <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="shrink-0 font-mono text-[10px] font-semibold text-muted-2 tracking-[0.2em] uppercase max-w-[180px] leading-tight">
              ASSISTING CADETS APPROVED FOR TYPE RATINGS AT SECURE CARRIERS
            </div>
            <div className="h-[30px] w-[1px] bg-rule hidden md:block" />
            <div className="relative flex-1 min-w-0">
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-paper to-transparent pointer-events-none z-10 md:hidden" />
              <div className="flex gap-10 md:gap-16 whitespace-nowrap overflow-x-auto no-scrollbar font-serif text-[22px] text-ink opacity-60 tracking-tight items-center w-full pr-8 md:pr-0">
               <span>Indigo Airlines</span>
               <span>Air India</span>
               <span>FlyDubai</span>
               <span>Akasa Air</span>
               <span>Air Arabia</span>
               <span>Emirates (Transition)</span>
              </div>
            </div>
         </div>
      </div>

      {/* 2. SEC: BUILT AROUND */}
      <section className="py-24 md:py-32 w-full max-w-[1400px] mx-auto px-6" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" }}>
        <FadeUp>
          <div className="mb-10">
            <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-4">
              § 01 / MODULES
            </div>
            <h2 className="font-serif text-[42px] md:text-[64px] text-ink leading-[1.0] tracking-tight">
              Built around how pilots <br className="hidden sm:block" />
              <span className="italic">actually</span> study.
            </h2>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
           {/* Card 1: Question Bank */}
           <FadeUp delay={100} className="h-full">
             <Card className="h-full bg-paper rounded-[24px] p-8 md:p-10 shadow-sm border border-rule relative overflow-hidden flex flex-col group">
               <div className="flex justify-between items-start mb-6">
                 <span className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase">QUESTION BANK</span>
                 <ArrowUpRight size={16} className="text-muted opacity-50 group-hover:opacity-100 transition-opacity" />
               </div>
               <h3 className="font-serif text-[28px] md:text-[34px] text-ink leading-tight mb-4 tracking-tight">Adaptive practice across {liveSubjectsCount || 13} subjects.</h3>
               <p className="font-sans font-light text-[15px] text-ink-2 leading-relaxed mb-8 flex-1">
                 Spaced repetition that surfaces your weak ATA chapters and rule-of-the-air gaps first.
               </p>
               <div className="flex flex-wrap gap-2 mb-10">
                 <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">ADAPTIVE</Chip>
                 <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">BOOKMARKS</Chip>
                 <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">NOTES</Chip>
               </div>
               {/* Graphic */}
               <div className="bg-bg border border-rule rounded-xl p-5 space-y-4">
                 {[
                   { n: '01', l: 'Air Reg', v: 82 },
                   { n: '02', l: 'Met', v: 58 },
                   { n: '03', l: 'Nav', v: 71 },
                   { n: '04', l: 'POF', v: 77 }
                 ].map(o => (
                   <div key={o.n} className="flex justify-between items-center text-[11px] font-mono border-b border-rule/50 pb-2 last:border-0 last:pb-0">
                     <span className="text-muted-2 w-6">{o.n}</span>
                     <span className="text-ink text-left flex-1 font-sans">{o.l}</span>
                     <div className="w-16 h-[2px] bg-rule shrink-0 mr-4 rounded-full overflow-hidden">
                        <div className="h-full bg-ink rounded-full" style={{ width: `${o.v}%` }} />
                     </div>
                     <span className="text-ink font-semibold">{o.v}%</span>
                   </div>
                 ))}
               </div>
             </Card>
           </FadeUp>

           {/* Card 2: Mock Exams */}
           <FadeUp delay={150} className="h-full">
             <Card className="h-full bg-paper rounded-[24px] p-8 md:p-10 shadow-sm border border-rule relative overflow-hidden flex flex-col group">
               <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                   <span className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase">MOCK EXAMS</span>
                   <span className="font-mono text-[9px] bg-amber text-paper px-2 py-[3px] rounded-sm uppercase tracking-widest font-bold shadow-sm leading-none">Unlock Pro</span>
                 </div>
                 <ArrowUpRight size={16} className="text-muted opacity-50 group-hover:opacity-100 transition-opacity" />
               </div>
               <h3 className="font-serif text-[28px] md:text-[34px] text-ink leading-tight mb-4 tracking-tight">Real timing. Real cutoffs.</h3>
               <p className="font-sans font-light text-[15px] text-ink-2 leading-relaxed mb-8 flex-1">
                 DGCA & EASA paper templates with the exact section weighting and pass marks.
               </p>
               <div className="flex flex-wrap gap-2 mb-10">
                 <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">TIMED</Chip>
                 <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">SECTIONAL</Chip>
                 <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">NEGATIVE MARKING</Chip>
               </div>
               {/* Graphic */}
               <div className="bg-bg border border-rule rounded-xl p-5 aspect-[4/3] flex flex-col justify-between">
                 <div className="flex justify-between font-mono text-[9px] text-muted-2 tracking-widest uppercase">
                   <span>CPL · PAPER II</span>
                   <span className="text-ink font-semibold tracking-wider">02:24:18</span>
                 </div>
                 
                 <div className="grid grid-cols-[repeat(auto-fill,minmax(12px,1fr))] gap-1 my-4">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div key={i} className={`aspect-square rounded-[2px] ${
                        i < 32 
                          ? (i % 8 === 0 ? 'bg-signal' : 'bg-ink') 
                          : 'bg-rule'
                      }`} />
                    ))}
                 </div>
                 
                 <div className="flex justify-between font-mono text-[9px] text-muted tracking-widest uppercase">
                   <span>32 OF 60</span>
                   <span className="text-signal">PASS 70%</span>
                 </div>
               </div>
             </Card>
           </FadeUp>

           {/* Card 3: A320 Systems */}
           <FadeUp delay={200} className="h-full">
             <Link to="/a320-systems" className="block h-full">
               <Card className="h-full bg-paper rounded-[24px] p-8 md:p-10 shadow-sm border border-rule relative overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
                 <div className="flex justify-between items-start mb-6">
                   <span className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase">A320 SYSTEMS</span>
                   <ArrowUpRight size={16} className="text-muted opacity-50 group-hover:opacity-100 transition-opacity" />
                 </div>
                 <h3 className="font-serif text-[28px] md:text-[34px] text-ink leading-tight mb-4 tracking-tight">ATA chapters, ECAM logic, schematics.</h3>
                 <p className="font-sans font-light text-[15px] text-ink-2 leading-relaxed mb-8 flex-1">
                   An interactive cockpit-grade reference you can study from — or quiz against.
                 </p>
                 <div className="flex flex-wrap gap-2 mb-10">
                   <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">ATA 21-80</Chip>
                   <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">ECAM</Chip>
                   <Chip variant="solid" className="bg-bg-2 text-ink-2 border border-rule text-[9px] uppercase tracking-wider font-semibold">SCHEMATICS</Chip>
                 </div>
                 {/* Graphic */}
                 <div className="bg-bg border border-rule rounded-xl p-5 overflow-hidden flex items-center justify-center blueprint relative" style={{ minHeight: '140px' }}>
                   <div className="absolute inset-0 bg-paper opacity-50 pointer-events-none mix-blend-overlay"></div>
                   <div className="scale-75 origin-center w-full z-10 flex justify-center">
                      <FlightControlsDiagram />
                   </div>
                 </div>
               </Card>
             </Link>
           </FadeUp>
        </div>
      </section>

      {/* 3. DARK SEC: METHOD */}
      <section className="bg-ink w-full text-paper py-24 md:py-32 shrink-0" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}>
        <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1.2fr] gap-16 lg:gap-24">
           {/* Left */}
           <div>
             <FadeUp>
               <div className="font-mono text-[10px] text-paper/70 tracking-[0.2em] uppercase mb-12">
                 § 02 / METHOD
               </div>
               <h2 className="font-serif text-[52px] md:text-[72px] leading-[0.95] tracking-tight mb-8 drop-shadow-md">
                 A flight plan,<br />not a flash<span className="italic opacity-80">card deck.</span>
               </h2>
               <p className="font-sans text-[18px] text-paper/70 font-light leading-relaxed max-w-[500px]">
                 Each session is a briefing — the topics you'll cover, the questions queued from your weak areas, the explanations that follow. You finish knowing what you learned.
               </p>
             </FadeUp>
           </div>
           
           {/* Right */}
           <div className="flex flex-col border-t border-paper/10">
             {[
               { id: '01', t: 'Briefing', d: 'A two-line plan for today: weakest topics, time budget, queued items.' },
               { id: '02', t: 'Block practice', d: 'Subject-grouped questions; explanations after every miss, not at the end.' },
               { id: '03', t: 'Mock & VIVA', d: 'Timed paper + spoken oral practice with the same examiner script you\'ll face.' },
               { id: '04', t: 'Debrief', d: 'A readiness score per syllabus heading, with the next session pre-loaded.' }
             ].map((row, i) => (
                <FadeUp key={row.id} delay={i * 100} className="w-full">
                  <div className="py-8 border-b border-paper/10 flex flex-col md:flex-row md:items-start gap-6 group hover:bg-white/5 transition-colors -mx-6 px-6 cursor-default">
                    <span className="font-mono text-[11px] text-paper/70 tracking-widest pt-2 w-12">{row.id}</span>
                    <div className="flex-1">
                      <h3 className="font-serif text-[28px] text-paper mb-2">{row.t}</h3>
                      <p className="font-sans font-light text-[15px] text-paper/60 leading-relaxed max-w-md">{row.d}</p>
                    </div>
                    <ArrowUpRight size={18} className="text-paper/20 mt-2 group-hover:text-paper group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
                  </div>
                </FadeUp>
             ))}
           </div>
        </div>
      </section>

      {/* 4. SEC: ANALYTICS */}
      <section className="py-24 md:py-32 max-w-[1400px] mx-auto px-6 w-full" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}>
         <FadeUp className="pb-16">
            <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-4">
              § 03 / ANALYTICS
            </div>
            <h2 className="font-serif text-[48px] md:text-[64px] text-ink leading-[1.0] tracking-tight">
              See exactly <span className="italic">how</span> you can<br/>improve.
            </h2>
         </FadeUp>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <FadeUp delay={100} className="w-full">
               <Card className="bg-paper border border-rule rounded-[24px] p-8 md:p-12 shadow-sm h-full flex flex-col justify-center relative group">
                 <div className="flex justify-between items-center mb-8">
                    <div className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase">MASTERY · BY SYLLABUS HEADING</div>
                    <Chip variant="signal" className="border-signal/20 text-[9px] uppercase tracking-widest font-semibold px-2">3 ACTIONS PENDING</Chip>
                 </div>
                 <h3 className="font-serif text-[26px] text-ink mb-12 tracking-tight">Strengthen your alignment.</h3>
                 
                 <div className="space-y-6">
                    {[
                      { l: 'Air Regulation', v: 82, m: false },
                      { l: 'A320 Systems', v: 44, m: true },
                      { l: 'Meteorology', v: 88, m: false },
                      { l: 'Mass & Balance', v: 54, m: true },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-4 text-[13px] font-sans">
                         <span className="font-mono text-[10px] text-muted-2 w-6 shrink-0 tracking-widest">0{i+1}</span>
                         <span className={`flex-1 ${row.m ? 'text-signal font-medium' : 'text-ink'}`}>{row.l}</span>
                         <div className="w-[120px] md:w-[200px] h-1 bg-rule rounded-full overflow-hidden shrink-0">
                           <div className={`h-full rounded-full transition-all ${row.m ? 'bg-signal' : 'bg-mint'}`} style={{ width: `${row.v}%` }} />
                         </div>
                         <span className={`w-8 text-right font-mono text-[11px] font-semibold ${row.m ? 'text-signal' : 'text-ink'}`}>{row.v}%</span>
                      </div>
                    ))}
                 </div>
               </Card>
            </FadeUp>

            <FadeUp delay={200} className="w-full">
               <Card className="bg-paper border border-rule rounded-[24px] p-8 md:p-12 shadow-sm h-full flex flex-col justify-center">
                 <div className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase mb-8">PROGRESS · LAST 7 SESSIONS</div>
                 <h3 className="font-serif text-[26px] text-ink mb-12 tracking-tight">Consistent upward trend.</h3>
                 
                 <LazyChartWrapper />
                 
                 <div className="mt-8 pt-6 border-t border-rule font-mono text-[11px] text-muted font-medium">
                   +26pts improvement across 7 sessions
                 </div>
               </Card>
            </FadeUp>

            <FadeUp delay={300} className="w-full">
               <DailyStudyGoal />
            </FadeUp>
         </div>
      </section>

      {/* 4.5 SEC: COMPARISON */}
      <section className="py-24 bg-paper w-full border-t border-rule" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" }}>
        <FadeUp className="max-w-[1000px] mx-auto px-6">
           <div className="text-center mb-16">
             <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-4">
               § 04 / COMPARISON
             </div>
             <h2 className="font-serif text-[40px] md:text-[48px] text-ink leading-[1.0] tracking-tight">
               Heading vs. Legacy Tools
             </h2>
           </div>
           
           <div className="border border-rule rounded-2xl overflow-x-auto bg-bg shadow-sm" tabIndex={0} role="region" aria-label="Feature comparison table">
             <div className="grid grid-cols-3 border-b border-rule bg-paper min-w-[480px]">
               <div className="p-4 md:p-6 font-mono text-[11px] text-muted-2 tracking-widest uppercase flex items-center">Feature</div>
               <div className="p-4 md:p-6 font-sans font-semibold text-ink border-l border-rule flex items-center bg-bg relative">
                 <div className="absolute top-0 left-0 w-full h-1 bg-ink"></div>
                 Heading Simulator
               </div>
               <div className="p-4 md:p-6 font-sans font-medium text-ink-2 border-l border-rule flex items-center">Standard Books / Websites</div>
             </div>
             
             {[
               { feat: 'Spaced Repetition', h: 'Adaptive routing based on weak areas', s: 'Linear reading, manual tracking' },
               { feat: 'Mock Exam Simulation', h: 'Exact sectional weighting & strict timers', s: 'Static PDFs or endless quizzes' },
               { feat: 'Negative Marking', h: 'Simulates strict region-specific penalties', s: 'Often ignored or manually scored' },
               { feat: 'A320 Type Rating Prep', h: 'Interactive schematics & ECAM logic', s: 'Dense manuals (FCOM/FCTM)' },
               { feat: 'Data Analytics', h: 'Session-by-session telemetry trends', s: 'Mental guesswork' }
             ].map((r, i) => (
               <div key={i} className="grid grid-cols-3 border-b border-rule last:border-0 hover:bg-bg-2 transition-colors min-w-[480px]">
                 <div className="p-4 md:p-6 font-sans text-[13px] md:text-[14px] text-ink font-medium">{r.feat}</div>
                 <div className="p-4 md:p-6 font-sans text-[13px] md:text-[14px] text-ink border-l border-rule bg-bg/50">
                    <div className="flex items-start gap-2">
                       <CheckCircle2 size={16} className="text-ink shrink-0 mt-0.5" />
                       <span className="leading-snug">{r.h}</span>
                    </div>
                 </div>
                 <div className="p-4 md:p-6 font-sans text-[13px] md:text-[14px] text-ink-2 border-l border-rule opacity-80">{r.s}</div>
               </div>
             ))}
           </div>
        </FadeUp>
      </section>

      {/* 4.75 MID-PAGE SECONDARY CTA — bridges the long gap between the hero
          CTA and the final CTA. Kept to link weight so it never competes with
          the two primary buttons. */}
      <section className="bg-paper w-full border-b border-rule">
        <div className="max-w-[1000px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="font-serif text-[22px] md:text-[26px] text-ink tracking-tight">
            Seen enough? Fly a paper before you commit.
          </p>
          <Link
            to="/qotd"
            className="shrink-0 inline-flex items-center gap-2 font-sans text-[15px] font-medium text-ink hover:text-navy transition-colors"
          >
            Try a free question <MoveRight size={16} />
          </Link>
        </div>
      </section>

      {/* 5. TESTIMONIALS */}
      <section className="py-24 bg-bg border-y border-rule overflow-hidden" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}>
        <FadeUp className="max-w-[1400px] mx-auto px-6">
           <h2 className="font-serif text-[40px] text-ink text-center mb-16 tracking-tight">Cleared for takeoff by pilot cadets.</h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card className="bg-paper border-rule shadow-sm p-8 md:p-10 rounded-2xl">
                <p className="font-serif text-[24px] tracking-tight leading-relaxed text-ink mb-10">
                  "Cleared my DGCA Air Nav paper on the first attempt after struggling for months. The exact mock environment builds real confidence. The negative marking simulation is unforgiving—just like the real thing."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-rule bg-bg-2 flex items-center justify-center text-muted"><User size={20} /></div>
                  <div>
                    <div className="font-sans font-medium text-[15px] text-ink">Aditya R.</div>
                    <div className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mt-0.5">ATPL Candidate</div>
                  </div>
                </div>
             </Card>
             
             <Card className="bg-paper border-rule shadow-sm p-8 md:p-10 rounded-2xl">
                <p className="font-serif text-[24px] tracking-tight leading-relaxed text-ink mb-10">
                  "The AI instructor is like having a type-rating examiner on call 24/7. It explained the A320 ELAC logic so simply. I ditched three different manuals and just drilled here."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-rule bg-bg-2 flex items-center justify-center text-muted"><User size={20} /></div>
                  <div>
                    <div className="font-sans font-medium text-[15px] text-ink">Capt. Sharma</div>
                    <div className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mt-0.5">A320 Transition Course</div>
                  </div>
                </div>
             </Card>
           </div>
        </FadeUp>
      </section>

      {/* Pricing moved to /pricing view */}

      {/* LEAD CAPTURE SYSTEM */}
      <section className="py-12 bg-bg w-full" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}>
         <div className="max-w-[1400px] mx-auto px-6">
            <FadeUp>
               <LeadCapture />
            </FadeUp>
         </div>
      </section>

      {/* 7. FAQ */}
      <section className="py-24 bg-bg w-full border-t border-rule" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" }}>
         <div className="max-w-[800px] mx-auto px-6">
            <FadeUp className="mb-16">
               <h2 className="font-serif text-[40px] text-ink mb-2 tracking-tight">Flight Briefing (FAQ)</h2>
            </FadeUp>
            
            <FadeUp delay={100} className="border-t border-rule-strong">
              {HOME_FAQ.map((item) => (
                <FAQItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </FadeUp>
         </div>
      </section>

      {/* 8. LAST CTA */}
      <section className="w-full bg-ink relative overflow-hidden flex flex-col pb-12" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}>
         <div className="absolute inset-0 blueprint opacity-10 pointer-events-none mix-blend-overlay" />
         
         <div className="max-w-[1400px] mx-auto px-6 py-24 md:py-32 text-center relative z-10 flex flex-col items-center">
            <h2 className="font-serif text-[56px] md:text-[88px] text-paper leading-[1.0] tracking-tight mb-10 max-w-4xl">
              Begin your final approach.
            </h2>
            <Link to="/quiz/ata27">
               <Button variant="primary" className="h-[64px] px-12 text-[16px] shadow-xl bg-paper text-ink hover:bg-bg rounded-full font-medium">Load Simulator</Button>
            </Link>
         </div>
      </section>
      </div>

      {/* 9. FOOTER */}
      <footer className="bg-bg py-16 border-t border-rule" style={{ borderColor: 'var(--rule-strong)' }}>
         <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
               <Link to="/" className="flex items-center gap-2 mb-6">
                 <Wordmark compassSize={20} />
               </Link>
               <p className="font-sans text-sm text-muted-2 leading-relaxed max-w-xs">
                 The ultimate simulator for commercial pilot exams. EASA & DGCA ground school prep, mock papers, and active spaced repetition.
               </p>
               <div className="mt-6 flex flex-col font-mono text-[10px] text-muted-2 tracking-widest gap-2">
                 <span>SUPPORT@HEADING.COM</span>
                 <span>MADE WITH PRECISION FOR AVIATORS</span>
               </div>
            </div>
            
            <div>
               <h3 className="font-sans font-medium text-ink mb-6 text-[15px]">Product</h3>
               <ul className="space-y-4 font-sans text-[13px] text-ink-2">
                 <li><Link to="/modules" className="hover:text-ink transition-colors">Question Bank</Link></li>
                 <li><Link to="/mock-exams" className="hover:text-ink transition-colors">Mock Exams</Link></li>
                 <li><Link to="/pricing" className="hover:text-ink transition-colors">Pricing</Link></li>
                 <li><Link to="/blog" className="hover:text-ink transition-colors">Blog</Link></li>
               </ul>
            </div>
            
            <div>
               <h3 className="font-sans font-medium text-ink mb-6 text-[15px]">Legal / Company</h3>
               <ul className="space-y-4 font-sans text-[13px] text-ink-2">
                 <li><Link to="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link></li>
                 <li><Link to="/terms" className="hover:text-ink transition-colors">Terms of Service</Link></li>
                 <li><Link to="/refund" className="hover:text-ink transition-colors">Refund Policy</Link></li>
                 <li><Link to="/contact" className="hover:text-ink transition-colors">Contact</Link></li>
               </ul>
            </div>
         </div>
         <div className="w-full max-w-[1400px] mx-auto px-6 mt-16 pt-8 border-t border-rule font-serif text-sm text-muted-2 text-center">
            <p>&copy; {new Date().getFullYear()} Heading Simulator. Built for flight crew capability.</p>
         </div>
      </footer>
    </div>
  );
}
