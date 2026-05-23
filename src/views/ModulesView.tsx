import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../components/Atoms";
import { ArrowUpRight, Lock, Target, ChevronDown, Plus, Search } from "lucide-react";
import { SubjectItem } from "../data/topics";
import { fetchMergedSubjects } from "../lib/content";
import { useLogbook } from "../hooks/useLogbook";
import { getSubjectMastery, getDailyReviewItems } from "../lib/logbook";

export default function ModulesView() {
  const navigate = useNavigate();

  const { logbook } = useLogbook();

  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const merged = await fetchMergedSubjects();
        setSubjectsList(merged);
      } catch (err) {
        console.error("Failed loading subjects in ModulesView:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSubjects();
  }, []);

  const totalSubjectsCount = subjectsList.length;
  const totalQuestions = subjectsList.reduce((sum, s) => sum + s.questionCount, 0);

  const dailyReviewItems = getDailyReviewItems(logbook);

  const [sortOrder, setSortOrder] = useState<"weakest" | "strongest" | "az">("weakest");
  const [syllabus, setSyllabus] = useState<"All" | "EASA" | "DGCA">("EASA");
  const [activeTab, setActiveTab] = useState("All");
  const [showMasteryOverlay, setShowMasteryOverlay] = useState(false);

  const uniqueCategoriesFromTopics = Array.from(new Set(
    subjectsList.map(s => ((s as any).category || s.title || "").trim())
  )).filter(Boolean);
  const filterTabs = ["All", ...uniqueCategoriesFromTopics];

  const getHueColor = (hue: string) => {
    switch (hue) {
      case "navy": return "var(--navy)";
      case "signal": return "var(--signal)";
      case "amber": return "var(--amber)";
      case "sky": return "var(--sky)";
      case "mint": return "var(--mint)";
      default: return "var(--ink)";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg relative">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  let displayedSubjects = [...subjectsList];

  if (activeTab !== "All") {
    displayedSubjects = displayedSubjects.filter(s => {
      const title = (s.title || "").toLowerCase().trim();
      const category = ((s as any).category || "").toLowerCase().trim();
      const tab = activeTab.toLowerCase().trim();
      return title === tab || category === tab;
    });
  }

  displayedSubjects.sort((a, b) => {
    const aMastery = getSubjectMastery(logbook, a);
    const bMastery = getSubjectMastery(logbook, b);
    if (sortOrder === "weakest") return aMastery - bMastery;
    if (sortOrder === "strongest") return bMastery - aMastery;
    if (sortOrder === "az") return a.title.localeCompare(b.title);
    return 0;
  });

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-[0.03] z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none z-1" />

      <div className="relative z-10 px-6 py-12 md:py-16 max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col gap-6 md:gap-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-4">
                ♦ {totalSubjectsCount} SUBJECTS · {totalQuestions.toLocaleString()} QUESTIONS · UPDATED WEEKLY
              </span>
              <h2 className="font-serif text-[40px] md:text-[56px] text-ink leading-tight tracking-tight">
                The <span className="italic" style={{ color: "var(--navy)" }}>question</span> bank.
              </h2>
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 shrink-0 mb-2 md:mb-0">
              <div className="relative">
                <select 
                  className="appearance-none bg-panel border border-rule rounded-full pl-5 pr-10 py-2.5 text-[13px] font-sans font-medium text-ink outline-none hover:border-rule-strong transition-colors cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                >
                  <option value="weakest">Sort: Weakest first</option>
                  <option value="strongest">Sort: Strongest first</option>
                  <option value="az">Sort: A–Z</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  className="appearance-none bg-panel border border-rule rounded-full pl-5 pr-10 py-2.5 text-[13px] font-sans font-medium text-ink outline-none hover:border-rule-strong transition-colors cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value as any)}
                >
                  <option value="EASA">Syllabus: EASA</option>
                  <option value="DGCA">Syllabus: DGCA</option>
                  <option value="All">Syllabus: All</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 border border-rule rounded-full bg-panel shadow-sm mr-1">
                <span className="font-mono text-[10px] uppercase font-semibold tracking-widest text-muted-2">Show Mastery</span>
                <button 
                  onClick={() => setShowMasteryOverlay(!showMasteryOverlay)}
                  className={`w-8 h-4 rounded-full relative transition-colors ${showMasteryOverlay ? 'bg-mint' : 'bg-rule-strong'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-paper rounded-full transition-transform ${showMasteryOverlay ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <Button variant="primary" onClick={() => navigate('/quiz/a320-systems')} className="h-[42px] px-5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.08)] text-[13px]">
                <Plus size={16} />
                New session
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-baseline justify-between gap-4 border-b border-rule pb-4">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              {filterTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-[13px] rounded-full font-sans transition-colors ${
                    activeTab === tab 
                      ? "bg-ink text-paper font-bold shadow-sm" 
                      : "text-muted font-medium hover:text-ink hover:bg-panel"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="font-mono text-[10px] text-muted-2 uppercase tracking-widest shrink-0 hidden md:block">
              VIEWING {displayedSubjects.length} OF {totalSubjectsCount}
            </div>
          </div>
        </div>

        {/* REVIEW BANNER */}
        <AnimatePresence>
          {dailyReviewItems.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-10 border border-sky/20 bg-sky-soft p-5 md:p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center text-sky shrink-0 shadow-sm border border-sky/10">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="font-sans font-semibold text-base md:text-lg text-ink">Daily Drill</h3>
                  <p className="font-sans font-light text-sm text-muted">
                    You have <span className="font-medium text-ink">{dailyReviewItems.length} items</span> strictly queued based on your previous errors.
                  </p>
                </div>
              </div>
              <Button variant="primary" className="shrink-0 w-full md:w-auto" onClick={() => navigate('/quiz/review')}>
                Start Daily Drill
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GRID */}
        {displayedSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] border border-dashed border-rule rounded-2xl bg-panel/30 text-center">
            <Search size={32} className="text-muted-2 mb-4 opacity-50" />
            <h3 className="font-serif text-2xl text-ink mb-2">No modules found</h3>
            <p className="font-sans text-muted font-light">Try selecting a different filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {displayedSubjects.map((sub: SubjectItem, idx: number) => {
            const isComingSoon = sub.status === "coming-soon";
            const actualMastery = getSubjectMastery(logbook, sub);
            
            const hasSavedState = !!localStorage.getItem(`heading_quiz_state_${sub.id}`) || 
                                  (sub.subTopics?.some(t => !!localStorage.getItem(`heading_quiz_state_${t.id}`)) ?? false);

            let barColor = getHueColor(sub.hue);
            let statusPillLabel = "ON TRACK";
            let statusPillClass = "bg-sky-soft text-sky border border-sky/20"; 

            if (actualMastery < 0.60 && !isComingSoon) {
              statusPillLabel = "FOCUS AREA";
              statusPillClass = "bg-signal-soft text-signal border border-signal/20";
              barColor = "var(--signal)";
            } else if (actualMastery < 0.80 && !isComingSoon) {
              statusPillLabel = "IN PROGRESS";
              statusPillClass = "bg-amber-soft text-amber border border-amber/20";
            }

            if (actualMastery === 0 && hasSavedState && !isComingSoon) {
              statusPillLabel = "IN PROGRESS";
              statusPillClass = "bg-amber-soft text-amber border border-amber/20";
              barColor = "var(--amber)";
            }

            const cardContent = (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: (idx % 6) * 0.05, type: "spring", stiffness: 90, damping: 20 }}
                className="h-full relative"
              >
                <div 
                  className={`bg-paper relative rounded-2xl p-6 h-full flex flex-col group overflow-hidden transition-all duration-300 border border-rule shadow-sm ${
                    isComingSoon ? "opacity-60 bg-bg-2" : "hover:border-ink/50 hover:shadow-md"
                  }`}
                >
                  {/* Show Mastery Overlay */}
                  <AnimatePresence>
                    {showMasteryOverlay && !isComingSoon && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 backdrop-blur-sm bg-paper/80 rounded-2xl flex flex-col items-center justify-center pointer-events-none"
                      >
                         <span className="font-serif text-5xl text-ink drop-shadow-sm">{Math.round(actualMastery * 100)}%</span>
                         <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 mt-2 font-bold">MASTERY</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Top row */}
                  <div className="flex justify-between items-start mb-5">
                    <span className="font-mono text-[10px] text-muted-2 font-medium tracking-widest">{sub.num}</span>
                    {!isComingSoon ? (
                      <ArrowUpRight size={14} className="text-muted-2 group-hover:text-ink transition-colors" />
                    ) : (
                      <Lock size={14} className="text-muted-2" />
                    )}
                  </div>

                  {/* Title & Desc */}
                  <h3 className="font-serif text-[26px] md:text-[28px] text-ink leading-[1.1] mb-2.5 tracking-tight pr-4">
                    {sub.title}
                  </h3>
                  
                  <p className="font-sans font-light text-[13px] text-muted leading-relaxed line-clamp-2 mb-8 pr-2">
                    {sub.blurb}
                  </p>

                  <div className="mt-auto">
                    {/* Mastery Bar */}
                    {!isComingSoon ? (
                      <div className="mb-6">
                        <div className="flex items-end justify-between mb-2">
                          <span className="font-mono text-[9px] text-muted-2 font-bold tracking-widest uppercase">Mastery</span>
                          <span className="font-sans font-bold text-ink text-sm leading-none">{Math.round(actualMastery * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-rule rounded-full overflow-hidden relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: `${Math.max(2, actualMastery * 100)}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6 flex items-center h-[26px]">
                        <span className="font-mono text-[9px] text-muted-2 font-medium uppercase tracking-widest">Locked</span>
                      </div>
                    )}

                    {/* Bottom Row */}
                    <div className="flex items-center justify-between pt-5 border-t border-rule" style={{ borderColor: "var(--rule)", opacity: 0.8 }}>
                      <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase">
                        {sub.questionCount.toLocaleString()} QUESTIONS
                      </span>
                      {!isComingSoon && (
                        <div className={`flex items-center px-2 py-0.5 rounded font-mono text-[9px] font-bold tracking-wider uppercase ${statusPillClass}`}>
                          {hasSavedState && statusPillLabel !== "IN PROGRESS" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-mint mr-1.5 shadow-sm"></span>
                          )}
                          {statusPillLabel}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );

            if (isComingSoon) {
              return <div key={sub.id} className="h-full">{cardContent}</div>;
            }

            return (
              <Link to={`/topic/${sub.id}`} key={sub.id} className="block h-full outline-none">
                {cardContent}
              </Link>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

