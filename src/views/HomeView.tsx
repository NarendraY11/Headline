import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Button, Card, Chip, CompassLogomark, Wordmark } from "../components/Atoms";
import { MoveRight, ChevronDown, CheckCircle2, Clock, User, ArrowUpRight, X } from "lucide-react";
import { FlightControlsDiagram } from "../components/SystemDiagram";
import { Question, staticQuestionBank } from "../data/questions";
import { supabase } from "../lib/supabase";
import { fetchPublishedQuestions, fetchMergedSubjects } from "../lib/content";
import LeadCapture from "../components/LeadCapture";
import { useAuth } from "../contexts/AuthContext";

// Scroll reveal helper
const FadeUp: React.FC<{ children: React.ReactNode, delay?: number, className?: string }> = ({ children, delay = 0, className = "" }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-rule py-4">
      <button className="flex w-full justify-between items-center text-left py-2 focus:outline-none" onClick={() => setOpen(!open)}>
        <span className="font-sans font-medium text-ink">{question}</span>
        <ChevronDown size={18} className={`text-muted transition-transform duration-300 ${open ? '-rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
        <p className="font-sans font-light text-ink-2 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

function InteractiveSampleQuestion({ questions: initialQuestions }: { questions?: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [shake, setShake] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  // Load published questions safely with try-catch-finally
  useEffect(() => {
    let active = true;
    async function getDemoSet() {
      try {
        const dbQs = await fetchPublishedQuestions({ limit: 15 });
        if (!active) return;

        let filteredSet: Question[] = [];
        if (dbQs && dbQs.length > 0) {
          filteredSet = [...dbQs].sort(() => 0.5 - Math.random()).slice(0, 10);
        }

        // If DB returned empty/failed, fall back to the staticQuestionBank
        if (filteredSet.length === 0) {
          filteredSet = [...(staticQuestionBank || [])].sort(() => 0.5 - Math.random()).slice(0, 10);
        }

        setQuestions(filteredSet);
      } catch (err) {
        console.warn("Error fetching demo questions, using static fallback:", err);
        if (active) {
          setQuestions((staticQuestionBank || []).slice(0, 10));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    // Initialize with propQuestions first if available, then load/overwrite
    if (initialQuestions && initialQuestions.length > 0) {
      setQuestions([...initialQuestions].sort(() => 0.5 - Math.random()).slice(0, 10));
      setLoading(false);
    } else {
      getDemoSet();
    }

    return () => {
      active = false;
    };
  }, [initialQuestions]);

  // Handle auto-rotate interval: clean up correctly and pause on interaction or hover
  useEffect(() => {
    if (loading || questions.length === 0) return;

    // Pause if hovering, if an option is selected, or if the answer has been submitted
    const isPaused = isHovered || selected !== null || submitted;
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % questions.length);
    }, 6000);

    return () => {
      clearInterval(interval);
    };
  }, [loading, questions.length, isHovered, selected, submitted]);

  // Fallback Loading Skeleton - Never gets stuck loading!
  if (loading || questions.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm text-center relative overflow-hidden w-full max-w-[90vw] sm:max-w-sm md:max-w-md mx-auto md:mx-0 shrink-0 h-[450px] flex flex-col justify-between items-stretch animate-pulse">
        <div className="flex justify-between items-center pb-2">
          <div className="h-4 bg-muted-2/20 w-16 rounded font-mono"></div>
          <div className="h-4 bg-muted-2/20 w-10 rounded"></div>
        </div>
        <div className="space-y-3 py-4 flex-1 text-left">
          <div className="h-5 bg-ink/10 w-full rounded"></div>
          <div className="h-5 bg-ink/10 w-4/5 rounded pb-1"></div>
          <div className="space-y-2 pt-6">
            <div className="h-10 bg-muted/10 w-full rounded-lg"></div>
            <div className="h-10 bg-muted/10 w-full rounded-lg"></div>
            <div className="h-10 bg-muted/10 w-full rounded-lg"></div>
          </div>
        </div>
        <div className="h-10 bg-ink/10 w-full rounded-lg"></div>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || questions[0];

  const handleSelect = (id: string) => {
    if (submitted) return;
    setSelected(id);
  };

  const handleSubmit = () => {
    if (submitted) {
      // Move manually to next question (loops back) and reset interactions
      setCurrentIndex((prev) => (prev + 1) % questions.length);
      setSelected(null);
      setSubmitted(false);
      return;
    }

    if (!selected) {
      setShake(true);
      setTooltipMessage("Select an answer first");
      setShowTooltip(true);
      setTimeout(() => {
        setShake(false);
        setShowTooltip(false);
      }, 1500);
      return;
    }

    setSubmitted(true);
  };

  const handleToolbarClick = (action: string) => {
    if (action === "SKIP") {
      setCurrentIndex((prev) => (prev + 1) % questions.length);
      setSelected(null);
      setSubmitted(false);
    } else {
      setTooltipMessage("Sign in to save bookmarks/notes");
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    }
  };

  // Safe splitters to ensure parsing strings doesn't trigger crashes
  const getTopRightStamp = (ataStr?: string) => {
    if (!ataStr) return "27-04";
    const parts = ataStr.split(" ");
    return `${parts[1] || "27"}-04`;
  };

  const getAtaPrefix = (ataStr?: string) => {
    if (!ataStr) return "A320";
    return ataStr.split("·")[0]?.trim() || "A320";
  };

  return (
    <motion.div
      className="bg-paper border border-rule rounded-2xl py-5 px-6 shadow-sm text-left relative overflow-hidden w-full max-w-[90vw] sm:max-w-sm md:max-w-md mx-auto md:mx-0 shrink-0 min-h-[450px] flex flex-col justify-between"
      animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top right stamp */}
      <div className="absolute top-6 right-2 transform rotate-12 opacity-30 font-mono text-[10px] tracking-widest pointer-events-none select-none text-ink">
        {getTopRightStamp(currentQ.ata)} REV 1
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="flex-grow flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4 relative z-10 w-full">
              <div className="bg-bg py-1.5 px-3 rounded border border-rule font-mono text-[10px] text-ink font-semibold tracking-widest">
                {getAtaPrefix(currentQ.ata)}
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <div className="font-mono text-[9px] text-muted-2 tracking-[0.15em] uppercase">
                  Q {String(currentIndex + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
                </div>
                <div className="font-mono text-[10px] text-muted-2 tracking-widest flex items-center gap-1.5">
                  <Clock size={12} className="text-muted" /> 00:42
                </div>
              </div>
            </div>

            <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase mb-1.5 font-bold">QUESTION</div>
            <p className="font-serif text-[18px] md:text-[19px] leading-snug text-ink mb-4 tracking-tight min-h-[64px]">
              {currentQ.prompt}
            </p>

            <div className="space-y-2 mb-4">
              {currentQ.choices.map((o) => {
                const isSel = selected === o.id;

                let borderClass = 'border-rule bg-bg hover:border-ink/30 hover:bg-paper text-ink transition-colors';
                let iconClass = 'bg-paper border-rule text-muted';
                let iconContent: React.ReactNode = o.id.toUpperCase();

                if (submitted) {
                  if (o.id === currentQ.correct) {
                    borderClass = 'border-mint bg-mint/10 text-ink';
                    iconClass = 'bg-mint border-transparent text-bg';
                    iconContent = <CheckCircle2 size={12} className="text-bg" />;
                  } else if (isSel && o.id !== currentQ.correct) {
                    borderClass = 'border-signal bg-signal/10 text-ink';
                    iconClass = 'bg-signal border-transparent text-bg';
                    iconContent = <X size={12} className="text-bg" />;
                  } else {
                    borderClass = 'border-rule bg-bg opacity-50 text-ink';
                    iconClass = 'bg-paper border-rule text-muted';
                  }
                } else {
                  if (isSel) {
                    borderClass = 'border-ink bg-ink/5 text-ink shadow-sm';
                    iconClass = 'bg-ink border-transparent text-bg font-semibold text-[10px]';
                  }
                }

                return (
                  <button
                    key={o.id}
                    onClick={() => handleSelect(o.id)}
                    className={`w-full text-left flex items-center py-[10px] px-[14px] border rounded-[12px] transition-all duration-200 ${borderClass}`}
                  >
                    <span className={`font-mono text-[10px] shrink-0 w-6 h-6 flex items-center justify-center rounded-full border ${iconClass}`}>
                      {iconContent}
                    </span>
                    <span className="font-sans text-[13.5px] font-medium ml-3 sm:ml-4 leading-snug">
                      {o.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 font-sans text-[13px] text-ink-2 bg-rule/30 p-3 rounded-lg border border-rule overflow-hidden"
                >
                  <span className="font-semibold text-ink">Explanation:</span> {currentQ.explanation.split('.')[0]}.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between mt-auto border-t border-rule/20 pt-4 relative">
        <div className="flex gap-2 sm:gap-3 font-mono text-[8px] sm:text-[9px] text-muted-2 tracking-[0.1em] sm:tracking-[0.2em] uppercase">
          <button onClick={() => handleToolbarClick("BOOKMARK")} className="hover:text-ink transition-colors outline-none focus-visible:ring-2">BOOKMARK</button>
          <span>·</span>
          <button onClick={() => handleToolbarClick("NOTE")} className="hover:text-ink transition-colors outline-none focus-visible:ring-2">NOTE</button>
          <span>·</span>
          <button onClick={() => handleToolbarClick("SKIP")} className="hover:text-ink transition-colors outline-none focus-visible:ring-2">SKIP</button>
        </div>

        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-14 left-0 font-sans text-xs bg-ink text-bg px-3 py-1.5 rounded shadow-lg whitespace-nowrap z-20"
            >
              {tooltipMessage}
              <div className="absolute -bottom-1 left-4 w-2 h-2 bg-ink transform rotate-45"></div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button onClick={handleSubmit} variant="primary" className="h-9 sm:h-10 px-4 sm:px-5 bg-ink text-bg text-[13px] sm:text-[14px] rounded-full hover:bg-ink-2 shrink-0">
          {submitted ? (
            <>Next Question <MoveRight size={14} className="ml-1.5" /></>
          ) : (
            <>Submit <MoveRight size={14} className="ml-1.5" /></>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default function HomeView() {
  const { user, openAuthModal } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [liveQuestionsCount, setLiveQuestionsCount] = useState<number>(0);
  const [liveSubjectsCount, setLiveSubjectsCount] = useState<number>(0);
  const [platformAnsweredCount, setPlatformAnsweredCount] = useState<number>(42520);
  const [activePilotsCount, setActivePilotsCount] = useState<number>(230);

  useEffect(() => {
    async function loadStatsAndContent() {
      try {
        const [previewQuestions, mergedSubjects, countResponse, profilesResponse, attemptsResponse] = await Promise.all([
          fetchPublishedQuestions({ limit: 10 }),
          fetchMergedSubjects(),
          supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "published"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("attempts").select("total")
        ]);

        setQuestions(previewQuestions);
        setLiveQuestionsCount(countResponse.count ?? previewQuestions.length);
        setLiveSubjectsCount(mergedSubjects.length);

        if (profilesResponse?.count) {
          setActivePilotsCount(profilesResponse.count);
        }

        if (attemptsResponse?.data && attemptsResponse.data.length > 0) {
          const sum = attemptsResponse.data.reduce((acc, curr) => acc + (curr.total || 0), 0);
          if (sum > 0) {
            setPlatformAnsweredCount(sum);
          }
        }
      } catch (e) {
        console.warn("Error loading home stats and content:", e);
      }
    }
    loadStatsAndContent();
  }, []);

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
      <header className="h-[72px] flex items-center justify-between px-6 lg:px-10 bg-bg z-50 absolute top-0 w-full left-0 right-0 border-b border-rule/50">
        <Link to="/" className="hover:opacity-90 transition-opacity flex items-center gap-3">
          <Wordmark compassSize={24} />
          <span className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase border border-rule px-1.5 py-0.5 rounded-[4px] mt-0.5 opacity-80">FL · 380</span>
        </Link>
        <div className="hidden lg:flex items-center gap-8 font-sans text-[13px] tracking-wide text-ink-2">
          <Link to="/modules" className="hover:text-ink transition-colors px-2 py-2">Question bank</Link>
          <Link to="/mock-exams" className="hover:text-ink transition-colors px-2 py-2">Mock exams</Link>
          <Link to="/a320-systems" className="hover:text-ink transition-colors px-2 py-2">A320 systems</Link>
          <Link to="/modules" className="hover:text-ink transition-colors px-2 py-2">VIVA</Link>
          <Link to="/pricing" className="hover:text-ink transition-colors px-2 py-2">Pricing</Link>
        </div>
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link to="/today" className="text-[13px] font-sans font-medium text-ink hover:text-ink-2 transition-colors hidden sm:block">Dashboard</Link>
              <Link to="/today">
                <Button variant="primary" className="h-[38px] px-5 text-[13px] font-sans font-medium rounded-full bg-ink text-bg border-0 hover:bg-ink-2">Resume studying <MoveRight size={14} className="ml-1.5" /></Button>
              </Link>
            </>
          ) : (
            <>
              <button onClick={() => openAuthModal("signin")} className="text-[13px] font-sans font-medium text-ink hover:text-ink-2 transition-colors hidden sm:block cursor-pointer">Sign in</button>
              <Button onClick={() => openAuthModal("signup")} variant="primary" className="h-[38px] px-5 text-[13px] font-sans font-medium rounded-full bg-ink text-bg border-0 hover:bg-ink-2">Start studying <MoveRight size={14} className="ml-1.5" /></Button>
            </>
          )}
        </div>
      </header>

      {/* 1. SEC: HERO */}
      <section className="relative pt-10 pb-12 md:pt-20 md:pb-20 w-full flex justify-center overflow-hidden">
        {/* REPLACED WATERMARKED VIDEO WITH ELEGANT BLUEPRINT AND AMBIENT GRADIENT */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#f3eee0] via-[#f8f5ed] to-[#ede8dc] z-0" />
        <div className="absolute inset-0 blueprint pointer-events-none opacity-[0.25] z-[1]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_30%,#f2ede0_90%)] opacity-60 z-[1]" />

        {/* BIG BACKGROUND COMPASS */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] md:w-[300px] xl:w-[560px] aspect-square pointer-events-none" style={{ zIndex: 2 }}>
          <motion.div
            initial={{ rotate: -15, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 30, damping: 20 }}
            className="w-full h-full"
          >
            <CompassLogomark size="100%" spin="rotate" spinDuration={32} className="text-rule opacity-[0.13]" />
          </motion.div>
        </div>
        
        {/* CONTENT ENVELOPE */}
        <div className="px-6 w-full max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center gap-12 md:gap-8 md:overflow-visible relative" style={{ zIndex: 3 }}>
          
          {/* LEFT COLUMN */}
          <div className="flex-1 md:max-w-[50%] lg:max-w-2xl relative z-10 w-full min-w-0">
          <FadeUp>
            <span className="eyebrow block mb-5 font-mono text-[10px] uppercase tracking-widest text-muted-2 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
              <span className="tracking-[0.25em]">EXAM PREP · DGCA · EASA · ATPL · TYPE RATING</span>
            </span>
            <h1 
              className="font-serif text-[42px] md:text-[48px] lg:text-[80px] xl:text-[100px] leading-[0.95] tracking-tight text-ink mb-6 md:mb-8 select-none whitespace-normal md:break-words min-w-0"
              style={{ textShadow: '0 2px 8px rgba(242, 238, 228, 0.7)' }}
            >
              Fly the <span className="italic text-navy">checkride</span><br />
              before the checkride.
            </h1>
            <p className="font-sans text-[16px] md:text-[18px] lg:text-[22px] text-ink-2 font-light max-w-[560px] mb-8 lg:mb-10 leading-relaxed md:leading-[1.6]">
              Heading is a question bank, mock-exam engine, and A320 systems reference built for student pilots, line crews on type, and the instructors who sign them off.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 md:mb-14 lg:mb-16">
               <Link to="/quiz/ata27" className="w-full sm:w-auto">
                 <Button variant="primary" className="h-[56px] min-h-[56px] px-8 text-[16px] font-medium w-full shadow-lg rounded-full bg-ink text-bg hover:bg-ink-2 transition-colors">
                   Take a free mock <MoveRight size={16} className="ml-2" />
                 </Button>
               </Link>
               <Link to="/modules" className="w-full sm:w-auto">
                 <Button variant="ghost" className="h-[56px] min-h-[56px] px-8 text-[16px] font-medium w-full rounded-full border border-rule hover:bg-bg-2 text-ink transition-colors">
                   See the question bank
                 </Button>
               </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 border-t border-rule/30 pt-8 w-full mt-6">
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-ink tracking-tight leading-none">{liveQuestionsCount}</span>
                <span className="font-mono text-[9px] tracking-widest text-muted-2 uppercase">QUESTIONS AVAILABLE</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-ink tracking-tight leading-none">{liveSubjectsCount}</span>
                <span className="font-mono text-[9px] tracking-widest text-muted-2 uppercase">SUBJECTS COVERED</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-navy tracking-tight leading-none">{platformAnsweredCount.toLocaleString()}</span>
                <span className="font-mono text-[9px] tracking-widest text-muted-2 uppercase">PLATFORM RESPONSES</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[28px] lg:text-[36px] text-[#A66C23] tracking-tight leading-none">{activePilotsCount}</span>
                <span className="font-mono text-[9px] tracking-widest text-muted-2 uppercase">PILOTS ACTIVE LIVE</span>
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
            <div className="flex gap-10 md:gap-16 whitespace-nowrap overflow-x-auto no-scrollbar font-serif text-[22px] text-ink opacity-60 tracking-tight items-center w-full">
               <span>Indigo Airlines</span>
               <span>Air India</span>
               <span>FlyDubai</span>
               <span>Akasa Air</span>
               <span>Air Arabia</span>
               <span>Emirates (Transition)</span>
            </div>
         </div>
      </div>

      {/* 2. SEC: BUILT AROUND */}
      <section className="py-12 md:py-20 w-full max-w-[1400px] mx-auto px-6">
        <FadeUp>
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-transparent pb-4">
            <h2 className="font-serif text-[42px] md:text-[64px] text-ink leading-[1.0] tracking-tight">
              Built around how pilots <br className="hidden sm:block" />
              <span className="italic">actually</span> study.
            </h2>
            <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase pb-2 md:pb-4">
              § 01 / MODULES
            </div>
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
                 <span className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase">MOCK EXAMS</span>
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
                   <span className="text-signal-vivid">PASS 70%</span>
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
      <section className="bg-ink w-full text-paper py-24 md:py-32 shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1.2fr] gap-16 lg:gap-24">
           {/* Left */}
           <div>
             <FadeUp>
               <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-12">
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
                    <span className="font-mono text-[11px] text-paper/40 tracking-widest pt-2 w-12">{row.id}</span>
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
      <section className="py-24 md:py-32 max-w-[1400px] mx-auto px-6 w-full">
         <FadeUp className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-16">
            <h2 className="font-serif text-[48px] md:text-[64px] text-ink leading-[1.0] tracking-tight">
              See exactly <span className="italic">how</span> you can<br/>improve.
            </h2>
            <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase pb-2">
              § 03 / ANALYTICS
            </div>
         </FadeUp>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FadeUp delay={100} className="w-full">
               <Card className="bg-paper border border-rule rounded-[24px] p-8 md:p-12 shadow-sm h-full flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-8">
                    <div className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase">MASTERY · BY SYLLABUS HEADING</div>
                    <Chip variant="solid" className="bg-signal-soft text-signal border-signal/20 text-[9px] uppercase tracking-widest font-semibold px-2">3 ACTIONS PENDING</Chip>
                 </div>
                 <h3 className="font-serif text-[32px] text-ink mb-12 tracking-tight">Strengthen your alignment.</h3>
                 
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
                 <h3 className="font-serif text-[32px] text-ink mb-12 tracking-tight">Consistent upward trend.</h3>
                 
                 <div className="w-full relative flex-1" style={{ minHeight: '200px' }} role="img" aria-label="A bar chart showing student scores across the last 7 learning sessions, indicating an improvement trend from 62% to 88% accuracy">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'S1', score: 62 },
                        { name: 'S2', score: 71 },
                        { name: 'S3', score: 68 },
                        { name: 'S4', score: 79 },
                        { name: 'S5', score: 74 },
                        { name: 'S6', score: 83 },
                        { name: 'S7', score: 88 }
                      ]} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }} />
                        <Bar dataKey="score" radius={[4, 4, 4, 4]} barSize={24}>
                          {
                            [62, 71, 68, 79, 74, 83, 88].map((score, index) => (
                              <Cell key={`cell-${index}`} fill={score >= 70 ? '#2E7D52' : '#C0392B'} />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
                 
                 <div className="mt-8 pt-6 border-t border-rule font-mono text-[11px] text-muted font-medium">
                   +26pts improvement across 7 sessions
                 </div>
               </Card>
            </FadeUp>
         </div>
      </section>

      {/* 4.5 SEC: COMPARISON */}
      <section className="py-24 bg-paper w-full border-t border-rule">
        <FadeUp className="max-w-[1000px] mx-auto px-6">
           <div className="text-center mb-16">
             <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-4">
               § 04 / COMPARISON
             </div>
             <h2 className="font-serif text-[40px] md:text-[48px] text-ink leading-[1.0] tracking-tight">
               Heading vs. Legacy Tools
             </h2>
           </div>
           
           <div className="border border-rule rounded-2xl overflow-hidden bg-bg shadow-sm">
             <div className="grid grid-cols-3 border-b border-rule bg-paper">
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
               <div key={i} className="grid grid-cols-3 border-b border-rule last:border-0 hover:bg-bg-2 transition-colors">
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

      {/* 5. TESTIMONIALS */}
      <section className="py-24 bg-bg border-y border-rule overflow-hidden">
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
      <section className="py-12 bg-bg w-full">
         <div className="max-w-[1400px] mx-auto px-6">
            <FadeUp>
               <LeadCapture />
            </FadeUp>
         </div>
      </section>

      {/* 7. FAQ */}
      <section className="py-24 bg-bg w-full border-t border-rule">
         <div className="max-w-[800px] mx-auto px-6">
            <FadeUp className="mb-16">
               <h2 className="font-serif text-[40px] text-ink mb-2 tracking-tight">Flight Briefing (FAQ)</h2>
            </FadeUp>
            
            <FadeUp delay={100} className="border-t border-rule" style={{ borderColor: 'var(--rule-strong)' }}>
              <FAQItem 
                question="Which official syllabi do you cover?" 
                answer="We currently map to EASA Part-FCL and the Indian DGCA curriculum. The question logic handles both standard and complex negative-marking environments. You can select your region during account setup."
              />
              <FAQItem 
                question="Can I use the app offline?" 
                answer="Yes. Bookmarks and recent quizzes are cached in your local encrypted storage. You can undertake mock exams inflight or without wifi. The AI Instructor features, however, require an active data link."
              />
              <FAQItem 
                question="Do you support actual Type Rating prep?" 
                answer="Yes. Our A320 modules dive deep into ATA systems and ECAM logic, suitable for cadets entering their first transition course or captains brushing up for recurrent sim checks."
              />
              <FAQItem 
                question="Is there a refund policy for Pro?" 
                answer="If you are dissatisfied with the telemetry or question bank quality within the first 7 days, we clear an immediate, no-questions-asked refund."
              />
            </FadeUp>
         </div>
      </section>

      {/* 8. LAST CTA */}
      <section className="w-full bg-ink relative overflow-hidden flex flex-col pb-12">
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
               <h4 className="font-sans font-medium text-ink mb-6 text-[15px]">Product</h4>
               <ul className="space-y-4 font-sans text-[13px] text-ink-2">
                 <li><Link to="/modules" className="hover:text-ink transition-colors">Question Bank</Link></li>
                 <li><Link to="/mock-exams" className="hover:text-ink transition-colors">Mock Exams</Link></li>
                 <li><Link to="/pricing" className="hover:text-ink transition-colors">Pricing</Link></li>
                 <li><Link to="/blog" className="hover:text-ink transition-colors">Blog</Link></li>
               </ul>
            </div>
            
            <div>
               <h4 className="font-sans font-medium text-ink mb-6 text-[15px]">Legal / Company</h4>
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
