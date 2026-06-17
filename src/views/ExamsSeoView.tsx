import {
    ArrowRight,
    Award,
    BookMarked,
    CheckCircle,
    ChevronRight,
    Clock,
    FileText,
    HelpCircle,
    Info,
    Shield
} from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { AdSlot } from "../components/AdSlot";
import { Button, Card } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";

interface ExamDetails {
  id: string;
  seoTitle: string;
  title: string;
  authority: string;
  passMark: number;
  duration: string;
  questionCount: number;
  pattern: string;
  metaDesc: string;
  tagline: string;
  subjects: {
    name: string;
    description: string;
    count: number;
    linkId: string;
  }[];
  faq: {
    q: string;
    a: string;
  }[];
  prepTime: string;
  directAnswer: string;
  overview: string;
  syllabusOverview: string;
  weightageText: string;
}

const examsData: Record<string, ExamDetails> = {
  "dgca-cpl": {
    id: "dgca-cpl",
    seoTitle: "DGCA CPL Exam Prep 2026 — Mock Papers & Technical Syllabus",
    title: "DGCA Commercial Pilot License (CPL) Exams",
    authority: "Directorate General of Civil Aviation (DGCA), India",
    passMark: 70,
    duration: "2.5 hours per subject",
    questionCount: 100,
    pattern: "Multiple Choice Questions, Computer-Based Examinations (On-Demand / Quarterly)",
    metaDesc: "Pass your DGCA CPL theory papers on your first attempt. Free trial mock exams, complete Air Navigation, Meteorology, Regulations, and Technical syllabus.",
    tagline: "India's Premiere Syllabus-Aligned Pilot Theory Simulation Deck",
    prepTime: "3 to 4 Months",
    directAnswer: "The DGCA CPL theory exam covers 5 subjects — Air Navigation, Aviation Meteorology, Air Regulations, Technical General, and Technical Specific. Each paper is 100 multiple-choice questions in 2.5 hours with a 70% passing mark. No negative marking applies.",
    overview: "The Directorate General of Civil Aviation (DGCA) CPL theory exams assess core pilot knowledge across five highly competitive papers. Known for rigorous testing environments and high precision margins, passing requires structured conceptual reading alongside active exam simulation. Heading provides Indian flight cadets with modern, syllabus-aligned simulation interfaces that build speed, accuracy, and stress resilience.",
    syllabusOverview: "The exam structure is parted into Air Navigation, Aviation Meteorology, Air Regulations, Technical General, and Technical Specific. Air Navigation remains the most challenging subject, featuring heavy wind triangle calculations on the mechanical physical computer (E6B/CX-3) and complex radial track geometries.",
    weightageText: "Navigation formulas, VOR tracking, and Altimeter altimetry correction calculations carry approximately 60% of the total marking weight in the Air Navigation paper.",
    subjects: [
      { name: "Air Navigation", description: "General navigation mathematics, chart projections, radio beacons, and pitot-static instrumentation systems.", count: 450, linkId: "air-navigation" },
      { name: "Aviation Meteorology", description: "Weather reporting (METAR/TAF/SIGMET), pressure areas, fronts boundary tracking, and cloud physics.", count: 100, linkId: "meteorology" },
      { name: "Air Regulations", description: "ICAO annexes, National law acts, rules of the air, airfield marking schemes, and distress signals.", count: 200, linkId: "air-regulations" },
      { name: "Technical General", description: "Thermodynamics of jet turbines, direct-current systems, landing gear hydraulics, and high-altitude flight mechanics.", count: 120, linkId: "technical-general" }
    ],
    faq: [
      { q: "Is the CX-3 computer allowed inside the DGCA hall?", a: "Yes, both the physical mechanical flight computer (E6B slide rule) and the electronic flight computer (ASA CX-3) are fully permitted for navigation charting calculations." },
      { q: "What is the passing score for the DGCA CPL exam?", a: "The minimum passing score is exactly 70% for each paper. There is currently no negative marking for wrong options." },
      { q: "How many questions are asked in the Air Navigation paper?", a: "The Air Navigation paper consists of 100 multiple choice questions to be completed in 150 minutes (2.5 hours)." }
    ]
  },
  "dgca-atpl": {
    id: "dgca-atpl",
    seoTitle: "DGCA ATPL Exam Prep 2026 — Mock Papers & Technical Syllabus",
    title: "DGCA Airline Transport Pilot License (ATPL) Exams",
    authority: "Directorate General of Civil Aviation (DGCA), India",
    passMark: 70,
    duration: "3.0 hours per subject",
    questionCount: 100,
    pattern: "Multiple Choice Questions, Computer-Based Examinations (On-Demand / Quarterly)",
    metaDesc: "Pass your DGCA ATPL theoretical knowledge examinations. High-quality mock papers for General Navigation, Aviation Meteorology, and Air Regulations.",
    tagline: "India's Premiere Syllabus-Aligned ATPL Theory Simulation Deck",
    prepTime: "4 to 6 Months",
    directAnswer: "The DGCA ATPL theory exam spans 3 subjects — General Navigation, Aviation Meteorology, and Air Regulations — each 100 questions over 3 hours with a 70% cutoff. Passing all three is mandatory for an Indian Airline Transport Pilot License.",
    overview: "The Directorate General of Civil Aviation (DGCA) ATPL theory exams represent the highest tier of pilot licensing in India. Designed to evaluate commanders-in-waiting, these papers require unmatched conceptual depth, advanced mathematical charting under extreme time pressure, and a total mastery of instrumentation abnormal profiles. Heading offers active simulation decks to secure your command papers.",
    syllabusOverview: "The ATPL syllabus spans Aviation Meteorology, Air Regulations, and General Navigation (including Instruments & Radio Aids). General Navigation requires navigating around spherical geometry, complex scale conversions, and high-latitude charts.",
    weightageText: "Advanced spherical calculations, grid-navigation tracks, and high-density weather charts make up 65% of the ATPL exam layout.",
    subjects: [
      { name: "General Navigation", description: "Grid navigation, spherical coordinates, Great Circle and Rhumb line track corrections, and flight planning computer solutions.", count: 450, linkId: "air-navigation" },
      { name: "Aviation Meteorology", description: "Global weather models, jet streams, tropical meteorology, CAT (Clear Air Turbulence), and SIGMET charts interpretation.", count: 100, linkId: "meteorology" },
      { name: "Air Regulations", description: "Civil Aviation Requirements (CARs), AICs, Aircraft Act 1934, rules of the air, and separation standards.", count: 200, linkId: "air-regulations" }
    ],
    faq: [
      { q: "What is the passing cutoff for DGCA ATPL theory exams?", a: "The minimum passing score is exactly 70% for each subject. You must clear all three core subjects to be eligible for command license issue." },
      { q: "Is a flight computer required for the ATPL exams?", a: "Yes. General Navigation is highly computational and requires either the ASA CX-3 electronic computer or the mechanical E6B slide rule." },
      { q: "What is the validity of the DGCA ATPL theory results?", a: "Passed ATPL exam results are valid for a period of 5 years from the date of passing to complete your multi-engine type rating requirements." }
    ]
  },
  "easa-atpl": {
    id: "easa-atpl",
    seoTitle: "EASA ATPL Theoretical Knowledge Exam Guide & Practice Trials",
    title: "EASA Airline Transport Pilot License (ATPL) Exams",
    authority: "European Union Aviation Safety Agency (EASA)",
    passMark: 75,
    duration: "Varies (45 mins to 3 hours per subject)",
    questionCount: 1400,
    pattern: "Multiple Choice Questions sourced from the European Central Question Bank (ECQB)",
    metaDesc: "Comprehensive study guides and active simulations for EASA 14 ATPL subjects. Realistic mock trials matching actual ECQB criteria and Jeppesen map grids.",
    tagline: "High-Fidelity Theoretical Stress Training For European Flight Cadets",
    prepTime: "9 to 12 Months",
    directAnswer: "EASA ATPL theoretical knowledge tests cover 14 subjects drawn from the European Central Question Bank (ECQB). Candidates need 75% on each subject and must pass all 14 within 6 sittings over 18 months to qualify for an EASA ATPL.",
    overview: "EASA Part-FCL theoretical knowledge tests represent the global gold standard for commercial aviation theory. To secure an ATPL, pilots must pass 14 theoretical exams covering air law, instruments, performance, human performance, and meteorological tracking. Heading's smart analytics tracking isolates system-level memory gaps in these wide-extent subject sheets.",
    syllabusOverview: "The curriculum spans 14 discrete subjects, normally studied in three modules. Exams are highly technical, utilizing Jeppesen student route manuals, performance tables, and flight planning computers. Success requires a thorough grasp of structural aerodynamics, meteorology, and operational limits.",
    weightageText: "Performance calculation tasks, Jeppesen route computations, and Mass & Balance grids are highly weighted across Flight Planning fields.",
    subjects: [
      { name: "Human Performance & Limitations", description: "Hypoxia, decompression sickness, spatial disorientation, and crew resource management (CRM) strategies.", count: 140, linkId: "human-performance" },
      { name: "Aviation Meteorology", description: "Global climate belts, winds, frontal movements, weather chart decoding, and winter operations icing triggers.", count: 100, linkId: "meteorology" },
      { name: "Air Navigation", description: "General navigation geometry, grid navigation, and radio-navigation signals.", count: 450, linkId: "air-navigation" }
    ],
    faq: [
      { q: "Does Heading use current ECQB questions?", a: "Heading's questions are carefully structured based on standard EASA learning objectives and aligned with ECQB syllabus guidelines to ensure high-fidelity retention." },
      { q: "What is the EASA ATPL cut-off pass score?", a: "Candidates must achieve at least 75% on each of the 14 subjects. There is no negative marking, but you must pass all papers within 6 sittings and 18 months." },
      { q: "Are Jeppesen reference charts necessary to study?", a: "Yes. General Navigation and Flight Planning require standard Jeppesen student manuals. Practice referencing routes in our exams suite." }
    ]
  },
  "faa-written": {
    id: "faa-written",
    seoTitle: "FAA Knowledge Tests Prep — Private, Instrument & Commercial",
    title: "FAA Knowledge Exam Preparation Tests",
    authority: "Federal Aviation Administration (FAA), United States",
    passMark: 70,
    duration: "2 hours to 3 hours based on test code",
    questionCount: 60,
    pattern: "Multiple Choice Questions, Computer-Based via PSI Testing Centers",
    metaDesc: "Master the FAA Knowledge Tests with Heading guidance. Practice Private Pilot (PAR), Instrument Rating (IRA), and Commercial (CAX) aligned with current ACS rules.",
    tagline: "Airman Certification Standards (ACS) Aligned Mock Tests",
    prepTime: "1 to 2 Months",
    directAnswer: "FAA Knowledge Tests are computer-based exams at PSI Testing Centers covering FAR regulations, aerodynamics, weather, and cross-country planning. The Private Pilot (PAR) and Instrument (IRA) tests are 60 questions; the Commercial (CAX) is 100. All require 70% to pass.",
    overview: "The Federal Aviation Administration utilizes FAA Knowledge Exams to test commercial theoretical competencies before flight checkrides. These written papers are strictly mapped to the current FAA Airman Certification Standards (ACS), stressing safe risk management alongside raw flight math.",
    syllabusOverview: "The exams verify practical airmanship regulations, airport lighting schemes, Federal Aviation Regulations (FAR) Part 61/91, cross-country chart reading (Sectionals), weight and balance, and weather briefings (METAR, TAF, Winds Aloft).",
    weightageText: "Airspace limitations, weather charts, and aerodynamic force laws cover 70% of FAA written test tasks.",
    subjects: [
      { name: "Air Regulations", description: "Federal Aviation Regulations (FAR) definitions, cloud clearances, and operational flight limitations.", count: 200, linkId: "air-regulations" },
      { name: "Aviation Meteorology", description: "Reading METAR, TAF, weather prognostic charts, and pilot weather reports (PIREPs).", count: 100, linkId: "meteorology" }
    ],
    faq: [
      { q: "How long is my FAA written test endorsement certificate valid?", a: "Your FAA written test results remain fully valid for 24 calendar months after passing. You must complete your checkride within this window." },
      { q: "How do I use the Airman Certification Standards (ACS) to study?", a: "Every answer in Heading is tagged with its active ACS subject code, showing you exactly which knowledge elements or risk factors require review." }
    ]
  },
  "a320-type-rating": {
    id: "a320-type-rating",
    seoTitle: "Airbus A320 Type Rating Prep — System Systems & FCOM Exams",
    title: "Airbus A320 Type Rating Systems Prep",
    authority: "Type Rating Training Organizations (TRTO) & Global Operators",
    passMark: 80,
    duration: "2 hours",
    questionCount: 100,
    pattern: "Multiple Choice Questions, Systems Technical Paper (FCOM-based)",
    metaDesc: "The ultimate training suite for A320 flight rating exam prep. Study flight control computers (ELAC, SEC, FAC), hydraulics, pneumatic valves, and ECAM abnormal logic.",
    tagline: "High-Fidelity Airbus System Training For Cadet & Active Transition Pilots",
    prepTime: "2 to 4 Weeks",
    directAnswer: "The A320 Type Rating systems exam tests FCOM knowledge across ATA chapters 21–80: flight controls (ELAC/SEC/FAC), hydraulics, electrical bus architecture, pneumatics, and ECAM abnormal procedures. Most airlines and TRTOs require a minimum score of 80% to proceed to simulator entries.",
    overview: "Transitioning to the active fleet of Airbus A320 family aircraft demands precision limits knowledge. The systems rating theoretical examination checks your memory of pneumatic configs, hydraulic pumps, fuel flow valves, flight computer transfers, and ECAM commands. Heading offers an intense interactive engine simulating technical system failures.",
    syllabusOverview: "Topics correspond strictly to standard FCOM (Flight Crew Operating Manual) chapters (ATA Subject Chapters 21 to 80). Systems include ATA 27 (Flight Controls), ATA 24 (Electrical Power), ATA 29 (Hydraulics), and ATA 36 (Pneumatics).",
    weightageText: "Flight Control computer configurations (ELAC/SEC/FAC) and Electrical bus distribution have critical marking weighting in technical exams.",
    subjects: [
      { name: "Airbus A320 Family Systems", description: "FCOM systems, limits, electrical line feeds, automatic pilot logic, flight laws, and landing configurations.", count: 1478, linkId: "a320-systems" }
    ],
    faq: [
      { q: "What is the passing threshold margin for A320 Systems rating tests?", a: "Most airlines and regulators demand a minimum score of 80% to pass the technical systems knowledge evaluation paper before sim entries." },
      { q: "How does Heading simulate fly-by-wire flight laws?", a: "Our database contains custom scenarios mapping transition triggers between Normal Law, Alternate Law, and Direct Flight Law." }
    ]
  }
};

export default function ExamsSeoView() {
  const { examId } = useParams<{ examId: string }>();
  const { openAuthModal } = useAuth();
  
  const exam = examId ? examsData[examId] : null;

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [examId]);

  if (!exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold mb-4 text-ink">Exam Framework Not Found</h1>
        <p className="text-muted mb-8">The requested commercial pilot exam portal could not be loaded.</p>
        <Link to="/">
          <Button variant="primary">Return Flight Plan to Home</Button>
        </Link>
      </div>
    );
  }

  // Generate Structured Data (JSON-LD) dynamically
  const jsonLdData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        "name": exam.title,
        "description": exam.metaDesc,
        "provider": {
          "@type": "Organization",
          "name": "Heading",
          "url": window.location.origin
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": exam.faq.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a
          }
        }))
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": window.location.origin
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Exams",
            "item": `${window.location.origin}/exams/${exam.id}`
          }
        ]
      }
    ]
  };

  return (
    <div className="bg-bg min-h-screen pb-16 animate-[fadeIn_0.4s_ease-out]">
      {/* Inject Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLdData)}
      </script>

      {/* HEADER HERO ACCENT */}
      <div className="bg-paper border-b border-rule pt-12 pb-16 relative overflow-hidden">
        {/* Subtle grid pattern backgrounds */}
        <div className="absolute inset-0 bg-[radial-gradient(#0d1a2d_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03]" />
        
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-4 font-mono text-[10px] tracking-widest text-muted uppercase">
            <Link to="/" className="hover:text-ink transition-colors">Home</Link>
            <ChevronRight size={10} />
            <span className="text-ink font-semibold">Exams Overview</span>
            <ChevronRight size={10} />
            <span className="text-muted">{exam.id.toUpperCase()}</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-navy-soft/10 text-navy border border-navy/20">
              <Shield size={10} className="text-navy animate-pulse" /> Official Standard: {exam.authority}
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-ink leading-[1.1] tracking-tight">
              {exam.title}
            </h1>
            
            <p className="font-sans text-muted text-lg sm:text-xl max-w-2xl leading-relaxed">
              {exam.tagline}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* LEFT: PUBLIC SYLLABUS DOCUMENT & DATA DETAILED SPECS */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* EXAM STRUCTURE AND CRITICAL SPECS SPECIFICATION TABLE */}
            <section className="space-y-4">
              <h2 className="font-mono text-xs tracking-widest uppercase text-muted font-bold flex items-center gap-2">
                <FileText size={14} className="text-navy" /> Exam Specifications
              </h2>
              <Card className="bg-paper border border-rule p-6 shadow-sm overflow-hidden rounded relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                  
                  <div className="border-b md:border-b-0 md:border-r border-rule pb-4 md:pb-0 md:pr-6 space-y-4">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest block">Licensing Body / Authority</span>
                      <p className="text-ink text-sm font-semibold flex items-center gap-2">
                        <Award size={15} className="text-navy" /> {exam.authority}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest block">Minimum Passing Score</span>
                      <p className="text-ink text-sm font-semibold flex items-center gap-2">
                        <CheckCircle size={15} className="text-mint animate-bounce" /> {exam.passMark}% Correct Answers
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest block">General Prep Estimation</span>
                      <p className="text-ink text-sm font-semibold flex items-center gap-2">
                        <Clock size={15} className="text-amber" /> {exam.prepTime} Directed Study
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 md:pl-2">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest block">Subject Exam Duration</span>
                      <p className="text-ink text-sm font-semibold">{exam.duration}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest block">Core Question Frequency</span>
                      <p className="text-ink text-sm font-semibold">Varies, averaging {exam.questionCount} theoretical questions per set.</p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest block">Evaluation Format</span>
                      <p className="text-ink text-sm font-medium leading-relaxed">{exam.pattern}</p>
                    </div>
                  </div>

                </div>
              </Card>
            </section>

            <AdSlot slotId={import.meta.env.VITE_ADSENSE_SLOT_BANNER} className="my-8" />

            {/* EXECUTIVE SUMMARY OVERVIEW */}
            <section className="space-y-4">
              <h2 className="font-mono text-xs tracking-widest uppercase text-muted font-bold flex items-center gap-2">
                <Info size={14} className="text-navy" /> Exam Overview
              </h2>
              {/* Inverted pyramid: direct answer block first for AEO crawlers */}
              <p className="font-sans text-[15px] text-ink font-medium leading-relaxed border-l-4 border-navy pl-4 py-1 bg-navy-soft/5 rounded-r">
                {exam.directAnswer}
              </p>
              <div className="font-sans text-ink-2 space-y-4 leading-relaxed text-[15px]">
                <p>{exam.overview}</p>
                <p>{exam.syllabusOverview}</p>
                <p className="italic text-muted text-sm border-l-2 border-navy-soft pl-4">
                  🚀 <strong>High-yield focus:</strong> {exam.weightageText}
                </p>
              </div>
            </section>

            {/* ALIGNED SYLLABUS & QUIZ CHAT MODULES */}
            <section className="space-y-4">
              <h2 className="font-mono text-xs tracking-widest uppercase text-muted font-bold flex items-center gap-2">
                <BookMarked size={14} className="text-navy" /> Theoretical Subject Syllabus Blocks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exam.subjects.map((subj, index) => (
                  <Card key={index} className="bg-paper border border-rule p-5 shadow-sm rounded-md flex flex-col justify-between hover:border-navy-soft transition-all duration-300">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-navy tracking-widest uppercase font-bold">Sub-Chapter 0{index + 1}</span>
                        <span className="font-mono text-[9px] bg-bg-2 px-1.5 py-0.5 rounded text-muted">
                          {subj.count} Qs
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-ink">{subj.name}</h3>
                      <p className="font-sans text-xs text-muted-2 leading-relaxed">{subj.description}</p>
                    </div>

                    <div className="pt-4 border-t border-rule mt-4 flex items-center justify-between">
                      <Link 
                        to="/modules" 
                        className="text-navy font-mono text-[11px] tracking-wider uppercase font-semibold flex items-center gap-1 group-hover:underline"
                      >
                        Explore Module <ChevronRight size={10} />
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* COLLAPSED FAQPAGES FAQS */}
            <section className="space-y-4">
              <h2 className="font-mono text-xs tracking-widest uppercase text-muted font-bold flex items-center gap-2">
                <HelpCircle size={14} className="text-navy" /> Frequently Asked Questions (FAQ)
              </h2>
              <div className="space-y-3">
                {exam.faq.map((f, i) => (
                  <Card key={i} className="bg-paper border border-rule p-5 rounded-md shadow-sm space-y-2">
                    <h3 className="font-serif text-base font-bold text-ink flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-navy-soft/10 text-navy font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">Q</span>
                      {f.q}
                    </h3>
                    <p className="font-sans text-sm text-muted-2 leading-relaxed pl-7">
                      {f.a}
                    </p>
                  </Card>
                ))}
              </div>
            </section>

          </div>

          {/* RIGHT: CONTEXTUAL STRATEGY CALL TO ACTION */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            {/* DIRECT SYSTEM PRACTICE CTAS */}
            <Card className="bg-navy p-6 text-bg border border-navy/50 shadow-md relative overflow-hidden rounded">
              {/* background vector accent */}
              <div className="absolute -bottom-6 -right-6 w-32 h-32 border border-bg/10 rounded-full opacity-10 pointer-events-none" />
              
              <div className="space-y-4 relative z-10 font-sans">
                <div className="inline-block px-2 py-0.5 rounded text-[8px] bg-amber text-navy font-mono uppercase tracking-widest font-bold">
                  Syllabus Free Mode
                </div>
                
                <h3 className="font-serif text-2xl font-bold leading-tight">
                  Simulator Practice Deck
                </h3>
                
                <p className="text-bg-2 text-xs leading-relaxed opacity-90">
                  Access Heading's free on-line preparation suite. Master simulated cabin stressors and error logging indicators immediately.
                </p>

                <div className="space-y-2 pt-2">
                  <button 
                    onClick={() => openAuthModal && openAuthModal("signup")}
                    className="w-full h-10 rounded bg-amber text-navy font-mono text-xs uppercase tracking-widest hover:bg-amber-strong font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    Launch Free Trials <ArrowRight size={14} className="animate-pulse" />
                  </button>
                  
                  <div className="text-center">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-bg/60">No credit card required.</span>
                  </div>
                </div>

                <hr className="border-t border-bg/15" />

                <div className="space-y-2">
                  <h4 className="font-mono text-[9px] uppercase tracking-widest text-amber font-bold">Includes cadet features:</h4>
                  <ul className="space-y-1 text-xs text-bg-2">
                    <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-amber shrink-0" /> Spaced Repetition Engine</li>
                    <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-amber shrink-0" /> Custom Radar & METAR Weather</li>
                    <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-amber shrink-0" /> ATA-Standards Telemetry Logs</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* SIDEBAR MINI READOUT (RECOMMENDED BLOG) */}
            <Card className="bg-paper border border-rule p-5 rounded space-y-4 shadow-sm">
              <h3 className="font-mono text-[10px] tracking-wider uppercase text-muted font-bold">Related Studies & Articles</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Link to="/blog/dgca-cpl-air-navigation-syllabus-2026" className="font-serif text-sm font-bold text-ink hover:text-navy hover:underline block leading-snug">
                    DGCA CPL Air Navigation Syllabus 2026: Preparation Manual
                  </Link>
                  <span className="font-mono text-[9px] text-muted">8 min read &middot; Syllabus Guide</span>
                </div>
                <hr className="border-t border-rule" />
                <div className="space-y-1">
                  <Link to="/blog/how-to-pass-easa-meteorology" className="font-serif text-sm font-bold text-ink hover:text-navy hover:underline block leading-snug">
                    How to Pass EASA Meteorology: 5 Strategies from Captains
                  </Link>
                  <span className="font-mono text-[9px] text-muted">6 min read &middot; Study Guides</span>
                </div>
              </div>
            </Card>

            {/* AD PLACEMENT SIDEBAR */}
            <div className="bg-bg-2/40 border border-rule/50 rounded p-4 text-center select-none space-y-1">
              <span className="font-mono text-[8px] uppercase tracking-widest text-muted-2">Ad Unit ID: sidebar-ads-30</span>
              <div className="h-[250px] border border-dashed border-rule rounded bg-paper/60 flex flex-col items-center justify-center p-3">
                <span className="font-mono text-[9px] text-muted uppercase tracking-widest font-bold">Sponsored Link Port</span>
                <span className="text-[10px] text-muted-2 mt-1">High-Intent Student Traffic Core Placement</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
