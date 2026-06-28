import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle, ChevronDown, ChevronRight,
  Clock, Compass, GraduationCap, Play, Target, TrendingDown, TrendingUp, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Atoms";
import ReadingProgress from "../components/ReadingProgress";
import { useAuth } from "../contexts/AuthContext";
import { SubjectItem } from "../data/topics";
import { useFeature } from "../hooks/useFeatureFlags";
import { useContentScope } from "../hooks/useContentScope";
import { useLearningProgress } from "../hooks/useLearningProgress";
import { fetchMergedSubjects } from "../lib/content";
import { useUserProgress } from "../lib/progress";
import { useLogbook } from "../hooks/useLogbook";
import { useAdaptiveLearning } from "../hooks/useAdaptiveLearning";
import { useResolvedExamDate } from "../hooks/useResolvedExamDate";
import { ReadinessPanel } from "./course/ReadinessPanel";

export default function CourseView() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const contentDeliveryEngine = useFeature("contentDeliveryEngine");
  const adaptiveLearningEnabled = useFeature("adaptiveLearning");
  const { scope, enrichedScope } = useContentScope(!!contentDeliveryEngine);
  const { progress: learningProgress } = useLearningProgress();
  const moduleProgress = learningProgress.modules;
  const topicProgress = learningProgress.topics;
  const { stats: progressStats } = useUserProgress();
  const { logbook } = useLogbook();

  // Phase 9.1 T3: exam date via learning context, not raw userData.nextExam
  const resolvedExamDate = useResolvedExamDate();

  // Phase 9: adaptive engine — unconditionally called; used only when flag ON
  const adaptive = useAdaptiveLearning({
    mission: null,
    reviewDueCount: 0,
    currentXp: 0,
    currentRank: "",
    currentStreak: progressStats.streakCount,
    examDate: resolvedExamDate,
  });

  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedModuleTopics, setExpandedModuleTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMergedSubjects()
      .then(setSubjectsList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const displayedSubjects = contentDeliveryEngine && scope.hasContent
    ? subjectsList.filter(s => scope.eligibleSubjectIds.has(s.id))
    : subjectsList;

  // ── Derived completion stats ────────────────────────────────────────────
  const allModules = displayedSubjects.flatMap(s => s.subTopics ?? []);
  const totalQuestions = allModules.reduce((s, m) => s + (m.questionCount ?? 0), 0);
  const totalAnswered = allModules.reduce((s, m) => s + (moduleProgress[m.id]?.answered ?? 0), 0);
  const overallCompletion = totalQuestions > 0
    ? Math.min(100, Math.round((totalAnswered / totalQuestions) * 100))
    : 0;

  const subjectsCompleted = displayedSubjects.filter(
    s => (progressStats.subjectMastery[s.id] ?? 0) >= 80
  ).length;

  const modulesCompleted = allModules.filter(m => {
    const mp = moduleProgress[m.id];
    return mp && mp.mastery >= 80;
  }).length;

  const topicsCompleted = Object.values(topicProgress).filter(tp => tp.answered > 0).length;

  const overallMastery = allModules.length > 0
    ? Math.round(
        allModules.reduce((s, m) => s + (moduleProgress[m.id]?.mastery ?? 0), 0) / allModules.length
      )
    : 0;

  const hoursStudied = Math.round(
    logbook.reduce((s, a) => s + (a.durationSec ?? 0), 0) / 3600
  );

  // Remaining hours: unanswered questions × 1.5 min avg
  const remainingHours = Math.round(((totalQuestions - totalAnswered) * 1.5) / 60);

  // ── Analytics ──────────────────────────────────────────────────────────
  const modulesWithProgress = allModules
    .map(m => ({ ...m, mastery: moduleProgress[m.id]?.mastery ?? 0, answered: moduleProgress[m.id]?.answered ?? 0 }))
    .filter(m => m.answered > 0);

  const strongestModule = [...modulesWithProgress].sort((a, b) => b.mastery - a.mastery)[0] ?? null;
  const weakestModule = [...modulesWithProgress].sort((a, b) => a.mastery - b.mastery)[0] ?? null;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weeklyLogbook = logbook.filter(a => a.dateISO && new Date(a.dateISO) >= weekStart);
  const weeklyAvgAccuracy = weeklyLogbook.length > 0
    ? Math.round(weeklyLogbook.reduce((s, a) => s + (a.percentage ?? 0), 0) / weeklyLogbook.length)
    : 0;

  const certLabel = scope.certificationId
    ? scope.certificationId.replace(/-/g, " ").toUpperCase()
    : (userData?.targetExam ?? "All Subjects");

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="animate-pulse space-y-4 w-full max-w-3xl px-6">
          <div className="h-8 bg-ink/10 w-1/2 rounded" />
          <div className="h-4 bg-muted/20 w-3/4 rounded" />
          <div className="h-64 bg-paper border border-rule rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20">
      <ReadingProgress />
      <div className="absolute inset-0 blueprint pointer-events-none opacity-[0.03] z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-4xl mx-auto">
        <button
          onClick={() => navigate("/modules")}
          className="flex items-center gap-2 font-mono text-xs text-muted-2 hover:text-ink transition-colors mb-10 tracking-widest uppercase"
        >
          <ArrowLeft size={14} /> Back to Modules
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap size={20} className="text-navy" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">COURSE OVERVIEW</span>
            {scope.aircraftId && (
              <span className="font-mono text-[9px] uppercase tracking-wide text-sky border border-sky/30 bg-sky-soft px-2 py-0.5 rounded-full">
                {scope.aircraftId.toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="font-serif text-[40px] md:text-[56px] text-ink leading-tight tracking-tight mb-2">
            {certLabel}
          </h1>
          <p className="font-sans text-muted font-light text-sm">
            {displayedSubjects.length} subjects · {allModules.length} modules · {totalQuestions.toLocaleString()} questions
          </p>
        </div>

        {/* Phase 9: Readiness panel — shown only when adaptiveLearning flag ON */}
        {adaptiveLearningEnabled && (
          <ReadinessPanel output={adaptive} loading={adaptive.loading} />
        )}

        {/* Progress ring + stats strip */}
        <div className="bg-ink rounded-2xl p-5 md:p-8 mb-10 flex flex-col sm:flex-row items-center gap-6 text-bg shadow-lg">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5"
                fill="none" stroke="var(--mint)"
                strokeWidth="3"
                strokeDasharray={`${overallCompletion} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-serif text-xl text-bg">
              {overallCompletion}%
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center sm:text-left">
            {[
              { label: "Subjects done", value: `${subjectsCompleted}/${displayedSubjects.length}` },
              { label: "Modules done", value: `${modulesCompleted}/${allModules.length}` },
              { label: "Topics done", value: topicsCompleted > 0 ? topicsCompleted : "–" },
              { label: "Answered", value: totalAnswered.toLocaleString() },
              { label: "Mastery", value: `${overallMastery}%` },
              { label: "Est. remaining", value: `${remainingHours}h` },
            ].map(s => (
              <div key={s.label}>
                <div className="font-mono text-[8px] uppercase tracking-wide opacity-60 mb-0.5">{s.label}</div>
                <div className="font-serif text-lg text-bg">{s.value}</div>
              </div>
            ))}
          </div>
          <Link to="/modules" className="shrink-0">
            <Button variant="primary" className="bg-bg text-ink hover:bg-paper border-0 text-sm h-10 px-4">
              <Play size={13} /> Continue
            </Button>
          </Link>
        </div>

        {/* Learning analytics */}
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-muted-2" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-semibold">LEARNING ANALYTICS</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-paper border border-rule rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-muted-2 mb-2">
              <TrendingUp size={12} />
              <span className="font-mono text-[9px] uppercase tracking-wide">Strongest</span>
            </div>
            <div className="font-sans text-sm font-medium text-ink line-clamp-2 leading-snug">
              {strongestModule?.title ?? "–"}
            </div>
            {strongestModule && (
              <div className="font-mono text-[9px] text-mint mt-1">{strongestModule.mastery}% mastery</div>
            )}
          </div>
          <div className="bg-paper border border-rule rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-muted-2 mb-2">
              <TrendingDown size={12} />
              <span className="font-mono text-[9px] uppercase tracking-wide">Weakest</span>
            </div>
            <div className="font-sans text-sm font-medium text-ink line-clamp-2 leading-snug">
              {weakestModule?.title ?? "–"}
            </div>
            {weakestModule && (
              <div className="font-mono text-[9px] text-signal mt-1">{weakestModule.mastery}% mastery</div>
            )}
          </div>
          <div className="bg-paper border border-rule rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-muted-2 mb-2">
              <Target size={12} />
              <span className="font-mono text-[9px] uppercase tracking-wide">Avg Accuracy</span>
            </div>
            <div className="font-serif text-2xl text-ink">{progressStats.averageScore ?? 0}%</div>
            {weeklyLogbook.length > 0 && (
              <div className="font-mono text-[9px] text-muted-2 mt-1">7d: {weeklyAvgAccuracy}%</div>
            )}
          </div>
          <div className="bg-paper border border-rule rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-muted-2 mb-2">
              <Clock size={12} />
              <span className="font-mono text-[9px] uppercase tracking-wide">Time Studied</span>
            </div>
            <div className="font-serif text-2xl text-ink">{hoursStudied}h</div>
            <div className="font-mono text-[9px] text-muted-2 mt-1">Est. {remainingHours}h remaining</div>
          </div>
          <div className="bg-paper border border-rule rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-muted-2 mb-2">
              <Zap size={12} className="text-amber" />
              <span className="font-mono text-[9px] uppercase tracking-wide">Study Streak</span>
            </div>
            <div className="font-serif text-2xl text-ink">{progressStats.streakCount ?? 0}d</div>
          </div>
          <div className="bg-paper border border-rule rounded-xl p-4 shadow-sm col-span-2 md:col-span-3">
            <div className="flex items-center gap-1.5 text-muted-2 mb-2">
              <BookOpen size={12} />
              <span className="font-mono text-[9px] uppercase tracking-wide">Weekly Progress</span>
            </div>
            <div className="font-serif text-2xl text-ink">{weeklyLogbook.length} sessions</div>
            <div className="font-mono text-[9px] text-muted-2 mt-1">
              {weeklyLogbook.length > 0
                ? `${weeklyAvgAccuracy}% avg accuracy in last 7 days`
                : "No sessions in the last 7 days"}
            </div>
          </div>
        </div>

        {/* Syllabus hierarchy */}
        <div className="mb-4 flex items-center gap-2">
          <Compass size={14} className="text-muted-2" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-semibold">SYLLABUS</span>
        </div>

        <div className="space-y-3">
          {displayedSubjects.map(sub => {
            const isExpanded = expandedSubjects.has(sub.id);
            const subMastery = progressStats.subjectMastery[sub.id] ?? 0;
            const modules = sub.subTopics ?? [];
            const totalModQ = modules.reduce((s, m) => s + (m.questionCount ?? 0), 0);
            const answeredInSub = modules.reduce((s, m) => s + (moduleProgress[m.id]?.answered ?? 0), 0);
            const subCompletion = totalModQ > 0 ? Math.min(100, Math.round((answeredInSub / totalModQ) * 100)) : 0;
            const subStatus = subMastery >= 80 ? "completed" : answeredInSub > 0 ? "in-progress" : "not-started";

            return (
              <div key={sub.id} className="border border-rule rounded-2xl overflow-hidden bg-paper shadow-sm">
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
                    <span className="font-serif text-[17px] text-ink leading-tight truncate">{sub.title}</span>
                    {subStatus === "completed" && <CheckCircle size={14} className="text-mint shrink-0" />}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <span className="font-mono text-[9px] text-muted-2">{subCompletion}% done · {Math.round(subMastery)}% mastery</span>
                      <div className="w-20 h-1 bg-rule rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${subCompletion}%`,
                            backgroundColor: subMastery >= 80 ? "var(--mint)" : subMastery >= 40 ? "var(--sky)" : "var(--amber)"
                          }}
                        />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={16} className="text-muted-2" /> : <ChevronRight size={16} className="text-muted-2" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-rule divide-y divide-rule/30">
                    {modules.length === 0 ? (
                      <div className="px-5 py-4 text-center">
                        <span className="font-mono text-[10px] text-muted-2 uppercase tracking-wide">No modules</span>
                      </div>
                    ) : modules.map(mod => {
                      const mp = moduleProgress[mod.id];
                      const modMastery = mp?.mastery ?? 0;
                      const modAnswered = mp?.answered ?? 0;
                      const modTotal = mod.questionCount ?? 0;
                      const modCompletion = modTotal > 0 ? Math.min(100, Math.round((modAnswered / modTotal) * 100)) : 0;
                      const modStatus = modMastery >= 80 ? "completed" : modAnswered > 0 ? "in-progress" : "not-started";
                      const barColor = { completed: "var(--mint)", "in-progress": "var(--amber)", "not-started": "var(--rule)" }[modStatus];
                      const statusLabel = { completed: "DONE", "in-progress": "IN PROGRESS", "not-started": "NEW" }[modStatus];
                      const statusClass = { completed: "text-mint", "in-progress": "text-amber", "not-started": "text-muted-2" }[modStatus];
                      const lastStudied = mp?.lastStudied
                        ? new Date(mp.lastStudied).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : null;

                      const modTopics = enrichedScope.topics.filter(t => t.moduleId === mod.id);
                      const topicsOpen = expandedModuleTopics.has(mod.id);

                      return (
                        <div key={mod.id} className="border-b border-rule/20 last:border-b-0">
                          <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-2/30 transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-sans text-[13px] font-medium text-ink truncate">{mod.title}</span>
                                <span className={`font-mono text-[8px] uppercase tracking-wide shrink-0 ${statusClass}`}>{statusLabel}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-20 h-1 bg-rule rounded-full overflow-hidden shrink-0">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${modCompletion}%`, backgroundColor: barColor }} />
                                </div>
                                <span className={`font-mono text-[9px] ${statusClass}`}>{modCompletion}%</span>
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
                                    className="font-mono text-[8px] text-muted-2 hover:text-ink transition-colors hidden sm:inline"
                                  >
                                    {topicsOpen ? "▲" : "▼"} {modTopics.length} topics
                                  </button>
                                )}
                              </div>
                            </div>
                            <Link
                              to={`/quiz/${mod.id}`}
                              className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              aria-label={`Practice ${mod.title}`}
                            >
                              <ArrowRight size={16} className="text-navy" />
                            </Link>
                          </div>

                          {topicsOpen && modTopics.length > 0 && (
                            <div className="bg-bg-2/40 border-t border-rule/30 divide-y divide-rule/20">
                              {modTopics.map(topic => {
                                const tp = topicProgress[topic.id];
                                const topicAnswered = tp?.answered ?? 0;
                                const topicMastery = tp?.mastery ?? 0;
                                const topicColor = tp ? (topicMastery >= 80 ? "bg-mint" : "bg-amber") : "bg-rule-strong";
                                const topicLastStudied = tp?.lastStudied
                                  ? new Date(tp.lastStudied).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                  : null;

                                return (
                                  <div key={topic.id} className="flex items-center gap-3 pl-10 pr-5 py-2.5">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${topicColor}`} />
                                    <span className="font-sans text-[12px] text-ink-2 flex-1 truncate">{topic.label}</span>
                                    <span className="font-mono text-[9px] text-muted-2">
                                      {topicAnswered > 0 ? `${topicAnswered} ans · ${topicMastery}%` : "Not started"}
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
      </div>
    </div>
  );
}
