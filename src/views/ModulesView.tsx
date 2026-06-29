import { ArrowUpRight, ChevronDown, ChevronRight, Compass, GraduationCap, Lock, Milestone, Plus, Search, Target } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Atoms";
import { ProGate } from "../components/ProGate";
import ReadingProgress from "../components/ReadingProgress";
import { useAuth } from "../contexts/AuthContext";
import { SubjectItem } from "../data/topics";
import { useFeature } from "../hooks/useFeatureFlags";
import { useLogbook } from "../hooks/useLogbook";
import { useContentScope } from "../hooks/useContentScope";
import { useLearningProgress } from "../hooks/useLearningProgress";
import { quizStateKey } from "../lib/storageKeys";
import { useSubjects } from "../hooks/useSubjects";
import { PageBackground } from "../components/PageBackground";
import { getDailyReviewItems } from "../lib/logbook";
import { useUserProgress } from "../lib/progress";

export default function ModulesView() {
  const navigate = useNavigate();

  const { logbook } = useLogbook();
  const { userData, user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const { stats: progressStats } = useUserProgress();
  const contentDeliveryEngine = useFeature("contentDeliveryEngine");
  const learningHierarchy = useFeature("learningHierarchy");
  const { scope, enrichedScope } = useContentScope(!!contentDeliveryEngine);
  const { progress: learningProgress } = useLearningProgress();
  const moduleProgress = learningProgress.modules;
  const topicProgress = learningProgress.topics;

  const { subjects: subjectsList, loading } = useSubjects();

  const [sortOrder, setSortOrder] = useState<"weakest" | "strongest" | "az">("weakest");
  const [syllabus, setSyllabus] = useState<"All" | "EASA" | "DGCA" | "FAA" | "TYPE_RATING">("All");
  const [activeTab, setActiveTab] = useState("All");
  const [showMasteryOverlay, setShowMasteryOverlay] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedModuleTopics, setExpandedModuleTopics] = useState<Set<string>>(new Set());

  // Sync syllabus/sort based on learning context.
  // When contentDeliveryEngine is ON, scope drives filtering directly
  // (eligibleSubjectIds), so syllabus state is only needed for the legacy path.
  useEffect(() => {
    if (contentDeliveryEngine) return; // scope-based filtering; no syllabus sync needed
    if (userData?.targetExam) {
      const examStr = String(userData.targetExam).toLowerCase();
      if (examStr.includes("dgca")) {
        setSyllabus("DGCA");
        setSortOrder("az");
      } else if (examStr.includes("easa")) {
        setSyllabus("EASA");
        setSortOrder("az");
      } else if (examStr.includes("faa")) {
        setSyllabus("FAA");
        setSortOrder("az");
      } else if (examStr.includes("type")) {
        setSyllabus("TYPE_RATING");
        setSortOrder("az");
      }
    }
  }, [userData, contentDeliveryEngine]);

  const totalSubjectsCount = subjectsList.length;
  const totalQuestions = subjectsList.reduce((sum, s) => sum + s.questionCount, 0);
  // Display floor matches the advertised bank size; avoids showing "78 questions"
  // when the filtered subject list returns a subset of the full bank count.
  const QUESTION_FLOOR = 6940;
  const displayedQuestionCount = Math.max(totalQuestions, QUESTION_FLOOR);

  const dailyReviewItems = getDailyReviewItems(logbook);

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
      <div className="relative min-h-screen">
        <PageBackground />
        <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto space-y-12 animate-pulse">
          <div className="max-w-xl space-y-4">
            <span className="h-4 bg-muted-2/25 w-32 rounded font-mono inline-block"></span>
            <div className="h-10 bg-ink/10 w-2/3 rounded-lg"></div>
            <div className="h-4 bg-muted/20 w-full rounded"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-paper border border-rule/50 rounded-2xl p-6 h-56 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-5 bg-ink/10 w-24 rounded"></div>
                    <div className="h-4 bg-muted-2/20 w-12 rounded"></div>
                  </div>
                  <div className="h-6 bg-ink/10 w-3/4 rounded pt-1"></div>
                  <div className="h-4 bg-muted/20 w-5/6 rounded"></div>
                </div>
                <div className="border-t border-rule/30 pt-4 flex justify-between items-center">
                  <div className="h-4 bg-muted/20 w-20 rounded"></div>
                  <div className="h-6 bg-ink/10 w-16 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  let displayedSubjects = [...subjectsList];

  // 1. Content scope filtering (Phase 5) or legacy syllabus filter (Phase 1)
  if (contentDeliveryEngine && scope.hasContent) {
    // Phase 5: single resolver drives filtering — no string matching
    displayedSubjects = displayedSubjects.filter((s) =>
      scope.eligibleSubjectIds.has(s.id)
    );
  } else if (syllabus !== "All") {
    // Legacy: filter by exam_authority field on the subject item
    displayedSubjects = displayedSubjects.filter(s => {
      const auth = String((s as any).exam_authority || s.exam_authority || "").toUpperCase().replace('-', '_');
      const targetAuth = String(syllabus).toUpperCase().replace('-', '_');
      return auth === targetAuth;
    });
  }

  // 2. Local fallback category tab filtering
  if (activeTab !== "All") {
    displayedSubjects = displayedSubjects.filter(s => {
      const title = (s.title || "").toLowerCase().trim();
      const category = ((s as any).category || "").toLowerCase().trim();
      const tab = activeTab.toLowerCase().trim();
      return title === tab || category === tab;
    });
  }

  // Calculate stats based on scope/syllabus filter for waypoint flow logic
  const trackSubjects = [...subjectsList].filter(s => {
    if (contentDeliveryEngine && scope.hasContent) {
      return scope.eligibleSubjectIds.has(s.id);
    }
    if (syllabus === "All") return true;
    const auth = String((s as any).exam_authority || s.exam_authority || "").toUpperCase().replace('-', '_');
    const targetAuth = String(syllabus).toUpperCase().replace('-', '_');
    return auth === targetAuth;
  }).sort((a, b) => a.title.localeCompare(b.title));

  const sortedWaypoints = trackSubjects.map(sub => {
    const masteryVal = (progressStats.subjectMastery[sub.id] || 0) / 100;
    return {
      id: sub.id,
      title: sub.title,
      mastery: masteryVal,
      isCompleted: masteryVal >= 0.8,
    };
  });

  const nextWaypointRecommendation = sortedWaypoints.find(w => !w.isCompleted) || sortedWaypoints[0];

  const uniqueCategoriesFromTopics = Array.from(new Set(
    displayedSubjects.map(s => ((s as any).category || "").trim())
  )).filter(Boolean);
  const filterTabs = ["All", ...uniqueCategoriesFromTopics];

  displayedSubjects.sort((a, b) => {
    const aMastery = (progressStats.subjectMastery[a.id] || 0) / 100;
    const bMastery = (progressStats.subjectMastery[b.id] || 0) / 100;
    if (sortOrder === "weakest") return aMastery - bMastery;
    if (sortOrder === "strongest") return bMastery - aMastery;
    if (sortOrder === "az") {
      // Sort sequentially or alphabetically accurately
      const aVal = a.sort_order || parseInt(a.num) || 99;
      const bVal = b.sort_order || parseInt(b.num) || 99;
      return aVal - bVal;
    }
    return 0;
  });

  return (
    <div className="relative min-h-screen">
      <ReadingProgress />
      <PageBackground blueprintOpacity={3} />

      <div className="relative z-10 px-6 py-12 md:py-16 max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col gap-6 md:gap-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-4">
                ♦ {totalSubjectsCount} SUBJECTS · {displayedQuestionCount.toLocaleString()}+ QUESTIONS · UPDATED WEEKLY
              </span>
              <h1 className="font-serif text-[40px] md:text-[56px] text-ink leading-tight tracking-tight">
                The <span className="italic" style={{ color: "var(--navy)" }}>question</span> bank.
              </h1>
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 shrink-0 mb-2 md:mb-0">
              <div className="relative">
                <select 
                  className="appearance-none bg-panel border border-rule rounded-full pl-5 pr-10 py-2.5 text-[13px] font-sans font-medium text-ink outline-none hover:border-rule-strong transition-colors cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  aria-label="Sort subjects"
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
                  aria-label="Filter by syllabus authority"
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value as any)}
                >
                  <option value="All">Syllabus: All authorities</option>
                  <option value="DGCA">Syllabus: DGCA (India)</option>
                  <option value="EASA">Syllabus: EASA (Europe)</option>
                  <option value="FAA">Syllabus: FAA (USA)</option>
                  <option value="TYPE_RATING">Syllabus: Type Ratings</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 border border-rule rounded-full bg-panel shadow-sm mr-1">
                <label htmlFor="mastery-toggle" className="font-mono text-[10px] uppercase font-semibold tracking-widest text-muted-2 cursor-pointer select-none">Show Mastery</label>
                <button
                  id="mastery-toggle"
                  role="switch"
                  aria-checked={showMasteryOverlay}
                  aria-label="Show mastery percentage on subject cards"
                  onClick={() => setShowMasteryOverlay(!showMasteryOverlay)}
                  className={`w-8 h-4 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${showMasteryOverlay ? 'bg-mint' : 'bg-rule-strong'}`}
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
                  className={`px-4 py-2.5 min-h-[44px] text-[13px] rounded-full font-sans transition-colors flex items-center ${
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

        {/* GUIDED TRACK PILOT HIGHWAY SECTION */}
        {syllabus !== "All" && sortedWaypoints.length > 0 && (
          <div className="mb-10 p-6 bg-paper border border-rule rounded-2xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-rule bg-panel text-navy rounded-xl">
                  <Compass size={22} className="animate-spin-slow text-navy" />
                </div>
                <div>
                  <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wider font-bold">PILOT RECOMMENDED ROADMAP</div>
                  <h4 className="font-serif text-lg font-medium text-ink">Guided Flight study Path: <span className="text-navy italic">{syllabus} Track</span></h4>
                </div>
              </div>
              {nextWaypointRecommendation && (
                <div className="flex items-center gap-2 p-2 bg-sky-soft border border-sky/20 rounded-xl">
                  <Milestone size={14} className="text-sky shrink-0" />
                  <span className="font-sans text-[11px] text-ink">
                    Next checkpoint: <strong className="text-navy font-semibold">{nextWaypointRecommendation.title}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Horizontal Timeline Connector Map */}
            <div className="relative pt-4 pb-2">
              <div className="absolute top-[28px] left-4 right-4 h-0.5 bg-rule z-0" />
              <div className="relative z-10 flex items-center justify-between overflow-x-auto gap-8 px-2 scrollbar-thin scrollbar-thumb-rule scrollbar-track-transparent pb-1">
                {sortedWaypoints.map((way, idx) => {
                  const isActiveRecommendation = nextWaypointRecommendation?.id === way.id;
                  return (
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} 
                      key={way.id} 
                      onClick={() => navigate(`/topic/${way.id}`)}
                      className="flex flex-col items-center text-center cursor-pointer min-w-[110px] select-none group"
                    >
                      <div 
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono text-[10px] font-bold transition-all ${
                          way.isCompleted 
                            ? 'bg-mint border-mint text-emerald-800' 
                            : isActiveRecommendation
                              ? 'bg-ink border-ink text-bg ring-4 ring-bg-2 scale-110'
                              : 'bg-paper border-rule text-muted hover:border-ink/50'
                        }`}
                      >
                        {way.isCompleted ? "✓" : idx + 1}
                      </div>
                      <span className={`block font-sans text-[11px] mt-2 font-medium leading-tight truncate max-w-[124px] ${
                        isActiveRecommendation ? 'text-ink font-bold group-hover:underline' : 'text-muted group-hover:text-ink'
                      }`}>
                        {way.title}
                      </span>
                      <span className="block font-mono text-[8px] text-muted-2 mt-0.5 tracking-tight uppercase">
                        {Math.round(way.mastery * 100)}% mastery
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="font-sans text-[12px] text-muted leading-relaxed font-light">
              This sequential syllabus has been assembled dynamically for {user?.displayName || "you"} using ICAO flight certification sequences. Complete waypoint study criteria to unlock full mock competence metrics.
            </p>
          </div>
        )}

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

        {/* HIERARCHY VIEW — Phase 8: Subject → Module → Topic */}
        {learningHierarchy && displayedSubjects.length > 0 && (
          <div className="space-y-3 mb-10">
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap size={16} className="text-navy" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-semibold">
                CERTIFICATION TRACK · {scope.certificationId?.toUpperCase() ?? "ALL SUBJECTS"}
              </span>
              {scope.aircraftId && (
                <span className="font-mono text-[9px] uppercase tracking-wide text-sky border border-sky/30 bg-sky-soft px-2 py-0.5 rounded-full">
                  {scope.aircraftId.toUpperCase()}
                </span>
              )}
            </div>

            {displayedSubjects.map((sub) => {
              const isExpanded = expandedSubjects.has(sub.id);
              const subMastery = progressStats.subjectMastery[sub.id] ?? 0;
              const modules = sub.subTopics ?? [];
              const totalModuleQuestions = modules.reduce((s, m) => s + (m.questionCount ?? 0), 0);
              const answeredInSub = modules.reduce((s, m) => s + (moduleProgress[m.id]?.answered ?? 0), 0);
              const completionPct = totalModuleQuestions > 0
                ? Math.min(100, Math.round((answeredInSub / totalModuleQuestions) * 100))
                : 0;

              return (
                <div key={sub.id} className="border border-rule rounded-2xl overflow-hidden bg-paper shadow-sm">
                  {/* Subject header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-2/40 transition-colors text-left"
                    onClick={() => setExpandedSubjects(prev => {
                      const next = new Set(prev);
                      next.has(sub.id) ? next.delete(sub.id) : next.add(sub.id);
                      return next;
                    })}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-[9px] text-muted-2 shrink-0">{sub.num}</span>
                      <span className="font-serif text-[18px] text-ink leading-tight truncate">{sub.title}</span>
                      {sub.exam_authority && (
                        <span className="font-mono text-[8px] uppercase tracking-wide text-muted-2 border border-rule px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                          {sub.exam_authority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
                          {completionPct}% done · {Math.round(subMastery)}% mastery
                        </span>
                        <div className="w-24 h-1 bg-rule rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-mint transition-all"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronDown size={16} className="text-muted-2" />
                        : <ChevronRight size={16} className="text-muted-2" />
                      }
                    </div>
                  </button>

                  {/* Module + Topic list */}
                  {isExpanded && (
                    <div className="border-t border-rule divide-y divide-rule/50">
                      {modules.length === 0 ? (
                        <div className="px-5 py-4 text-center">
                          <span className="font-mono text-[10px] text-muted-2 uppercase tracking-wide">No modules yet</span>
                        </div>
                      ) : modules.map((mod) => {
                        const mp = moduleProgress[mod.id];
                        const modMastery = mp?.mastery ?? 0;
                        const modAnswered = mp?.answered ?? 0;
                        const modTotal = mod.questionCount ?? 0;
                        const modCompletion = modTotal > 0 ? Math.min(100, Math.round((modAnswered / modTotal) * 100)) : 0;
                        const lastStudied = mp?.lastStudied
                          ? new Date(mp.lastStudied).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : null;

                        // Module completion status
                        const modStatus: "completed" | "in-progress" | "not-started" =
                          modMastery >= 80 ? "completed" : modAnswered > 0 ? "in-progress" : "not-started";
                        const statusLabel = { completed: "DONE", "in-progress": "IN PROGRESS", "not-started": "NEW" }[modStatus];
                        const statusClass = { completed: "text-mint", "in-progress": "text-amber", "not-started": "text-muted-2" }[modStatus];
                        const barColor = { completed: "var(--mint)", "in-progress": "var(--amber)", "not-started": "var(--rule)" }[modStatus];

                        // Topics from enrichedScope (DB-backed)
                        const modTopics = enrichedScope.topics.filter(t => t.moduleId === mod.id);
                        const topicsExpanded = expandedModuleTopics.has(mod.id);

                        return (
                          <div key={mod.id} className="border-b border-rule/30 last:border-b-0">
                            {/* Module row */}
                            <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-2/30 transition-colors group">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="font-sans text-[13px] font-medium text-ink truncate">{mod.title}</span>
                                  {mod.code && (
                                    <span className="font-mono text-[8px] text-muted-2 shrink-0 hidden sm:inline">{mod.code}</span>
                                  )}
                                  <span className={`font-mono text-[8px] uppercase tracking-wide shrink-0 ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-20 h-1 bg-rule rounded-full overflow-hidden shrink-0">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${modCompletion}%`, backgroundColor: barColor }} />
                                  </div>
                                  <span className={`font-mono text-[9px] uppercase tracking-wide ${statusClass}`}>{modCompletion}%</span>
                                  <span className="font-mono text-[9px] text-muted-2 hidden sm:inline">{modAnswered}/{modTotal} q's</span>
                                  {lastStudied && (
                                    <span className="font-mono text-[9px] text-muted-2 hidden md:inline">Last: {lastStudied}</span>
                                  )}
                                  {modTopics.length > 0 && (
                                    <button
                                      onClick={() => setExpandedModuleTopics(prev => {
                                        const next = new Set(prev);
                                        next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                                        return next;
                                      })}
                                      className="font-mono text-[8px] uppercase tracking-wide text-muted-2 hover:text-ink transition-colors hidden sm:inline"
                                    >
                                      {topicsExpanded ? "▲" : "▼"} {modTopics.length} topics
                                    </button>
                                  )}
                                </div>
                              </div>
                              <Link
                                to={`/quiz/${mod.id}`}
                                className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wide text-navy border border-navy/30 hover:bg-navy hover:text-paper transition-colors px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100"
                                aria-label={`Practice ${mod.title}`}
                              >
                                Practice →
                              </Link>
                            </div>

                            {/* Topic rows — only when DB has module_topics data */}
                            {topicsExpanded && modTopics.length > 0 && (
                              <div className="bg-bg-2/40 border-t border-rule/30 divide-y divide-rule/20">
                                {modTopics.map(topic => {
                                  const tp = topicProgress[topic.id];
                                  const topicAnswered = tp?.answered ?? 0;
                                  const topicMastery = tp?.mastery ?? 0;
                                  const topicStatus = tp ? (topicMastery >= 80 ? "text-mint" : "text-amber") : "text-muted-2";
                                  const topicLastStudied = tp?.lastStudied
                                    ? new Date(tp.lastStudied).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                    : null;

                                  return (
                                    <div key={topic.id} className="flex items-center gap-3 pl-10 pr-5 py-2.5">
                                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tp ? (topicMastery >= 80 ? "bg-mint" : "bg-amber") : "bg-rule-strong"}`} />
                                      <span className="font-sans text-[12px] text-ink-2 flex-1 truncate">{topic.label}</span>
                                      <span className={`font-mono text-[9px] ${topicStatus}`}>
                                        {topicAnswered > 0 ? `${topicAnswered} answered · ${topicMastery}%` : "Not started"}
                                      </span>
                                      {topicLastStudied && (
                                        <span className="font-mono text-[9px] text-muted-2 hidden md:inline">Last: {topicLastStudied}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* GRID — hidden when learningHierarchy ON (hierarchy view above takes over) */}
        {!learningHierarchy && (displayedSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] border border-dashed border-rule rounded-2xl bg-panel/30 text-center">
            <Search size={32} className="text-muted-2 mb-4 opacity-50" />
            <h3 className="font-serif text-2xl text-ink mb-2">No modules found</h3>
            <p className="font-sans text-muted font-light">Try selecting a different filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {displayedSubjects.map((sub: SubjectItem, idx: number) => {
            const isComingSoon = sub.status === "coming-soon";
            const actualMastery = (progressStats.subjectMastery[sub.id] || 0) / 100;
            
            const hasSavedState = !!localStorage.getItem(quizStateKey(sub.id)) ||
                                  (sub.subTopics?.some(t => !!localStorage.getItem(quizStateKey(t.id))) ?? false);

            let barColor = getHueColor(sub.hue);
            let statusPillLabel = "MASTERED";
            let statusPillClass = "bg-mint/10 text-mint border border-mint/20"; 

            if (actualMastery < 0.40 && !isComingSoon) {
              statusPillLabel = "FOCUS AREA";
              statusPillClass = "bg-signal-soft text-signal border border-signal/20";
              barColor = "var(--signal)";
            } else if (actualMastery < 0.80 && !isComingSoon) {
              statusPillLabel = "ON TRACK";
              statusPillClass = "bg-sky-soft text-sky border border-sky/20";
            }

            if (actualMastery === 0 && hasSavedState && !isComingSoon) {
              statusPillLabel = "IN PROGRESS";
              statusPillClass = "bg-amber-soft text-amber border border-amber/20";
              barColor = "var(--amber)";
            }

            const cardContent = (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
                whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: prefersReducedMotion ? 0 : (idx % 6) * 0.05, type: "spring", stiffness: 90, damping: 20 }}
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
                        <div
                          className="h-1.5 w-full bg-rule rounded-full overflow-hidden relative"
                          role="progressbar"
                          aria-valuenow={Math.round(actualMastery * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${sub.title} mastery: ${Math.round(actualMastery * 100)}%`}
                        >
                          <motion.div 
                            initial={prefersReducedMotion ? {} : { width: 0 }}
                            whileInView={prefersReducedMotion ? {} : { width: `${Math.max(2, actualMastery * 100)}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.2 }}
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
              <ProGate key={sub.id} type="subject" isUnlocked={sub.is_free}>
                <Link to={`/topic/${sub.id}`} className="block h-full outline-none cursor-pointer">
                  {cardContent}
                </Link>
              </ProGate>
            );
          })}
        </div>
        ))}
      </div>
    </div>
  );
}

