import { ArrowRight, Flame, Sparkles, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button, CompassLogomark, Wordmark } from "../../components/Atoms";
import ShareableScorecard from "../../components/ShareableScorecard";
import { Question } from "../../data/questions";
import { isPaidActive } from "../../lib/plan";
import { formatTime } from "./utils";

interface QuizResultsProps {
  questions: Question[];
  answers: Record<string, string>;
  totalQuestions: number;
  timeElapsed: number;
  timePerQuestion: Record<string, number>;
  overridePassMark?: number;
  overrideNegMark?: number;
  userData: any;
  user: any;
  mode: string;
  topicId?: string;
  routeTopicId?: string;
  examTitle?: string;
  customTopic?: string;
  animatedScore: number;
  unlockedMilestone: any;
  setUnlockedMilestone: (m: any) => void;
  navigate: (path: string, options?: any) => void;
  startQuiz: (mode: any) => void;
  aiCoachEnabled: boolean;
  studyPlan: string | null;
  isCoachLoading: boolean;
  handleGetStudyPlan: () => void;
  openAuthModal: (tab: "signin" | "signup" | "forgot") => void;
}

export default function QuizResults({
  questions,
  answers,
  totalQuestions,
  timeElapsed,
  timePerQuestion,
  overridePassMark,
  overrideNegMark,
  userData,
  user,
  mode,
  topicId,
  routeTopicId,
  examTitle,
  customTopic,
  animatedScore,
  unlockedMilestone,
  setUnlockedMilestone,
  navigate,
  startQuiz,
  aiCoachEnabled,
  studyPlan,
  isCoachLoading,
  handleGetStudyPlan,
  openAuthModal,
}: QuizResultsProps) {
  const [showAllQs, setShowAllQs] = useState(false);

  let correctCount = 0;
  const ataBreakdown: Record<string, { correct: number; total: number }> = {};
  const wrongQuestionIdsLocal: string[] = [];

  questions.forEach((q) => {
    const isCorrect = answers[q.id] === q.correct;
    if (isCorrect) {
      correctCount++;
    } else {
      wrongQuestionIdsLocal.push(q.id);
    }

    if (!ataBreakdown[q.ata]) {
      ataBreakdown[q.ata] = { correct: 0, total: 0 };
    }
    ataBreakdown[q.ata].total++;
    if (isCorrect) ataBreakdown[q.ata].correct++;
  });

  const effectivePassMark = overridePassMark !== undefined ? overridePassMark : 70;
  const isMockOrExam = overrideNegMark !== undefined;
  const isNegativeMarking = !!(userData?.settings?.negativeMarking && mode === "timed");
  const penalty = isMockOrExam
    ? (overrideNegMark > 0 ? wrongQuestionIdsLocal.length * (overrideNegMark / 100) : 0)
    : (isNegativeMarking ? wrongQuestionIdsLocal.length * 0.25 : 0);
  const finalScore = Math.max(0, correctCount - penalty);
  const percentage = Math.round((finalScore / totalQuestions) * 100);
  const passed = percentage >= effectivePassMark;

  const avgTime = Math.round(timeElapsed / totalQuestions);
  const timeEntries = Object.entries(timePerQuestion) as [string, number][];
  const rushed = timeEntries.filter(([_, time]) => time < 15).length;
  const slow = timeEntries.filter(([_, time]) => time > 90).length;

  const diff = percentage - effectivePassMark;
  const marginStr = `${diff >= 0 ? "+" : ""}${diff}%`;

  let lowestAta = "";
  let lowestPct = 100;
  Object.entries(ataBreakdown).forEach(([ata, stats]) => {
    const pct = (stats.correct / stats.total) * 100;
    if (pct <= lowestPct) {
      lowestPct = pct;
      lowestAta = ata;
    }
  });

  const confidence = percentage >= 80 ? "High" : percentage >= 60 ? "Med" : "Low";
  const confidentAns = timeEntries.filter(
    ([id, t]) =>
      t > 5 &&
      t < 45 &&
      answers[id] === questions.find((q) => q.id === id)?.correct,
  ).length;

  const realWrong = questions.filter((q) => answers[q.id] && answers[q.id] !== q.correct).length;
  const realSkipped = questions.filter((q) => !answers[q.id]).length;

  return (
    <div className="relative min-h-screen bg-bg pb-24 font-sans selection:bg-mint/30">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />

      {/* TOP BAR */}
      <header className="h-16 border-b border-rule bg-bg shrink-0 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 relative">
        <Wordmark compassSize={22} className="hidden sm:flex" />
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-signal rotate-45 shrink-0" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/70 font-semibold mt-px">
            DEBRIEF · SESSION 9F2A
          </span>
        </div>
        <button
          onClick={() => navigate("/modules")}
          className="flex items-center gap-2 font-sans text-sm rounded-full border border-rule px-4 py-1.5 hover:bg-paper transition-colors z-10 bg-bg"
        >
          Done <X size={14} className="mb-px" />
        </button>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto py-12 px-4 space-y-6">
        {unlockedMilestone && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#101214] text-bg rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden flex items-center justify-between gap-6"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[9px] tracking-widest font-bold uppercase text-mint bg-mint/15 px-2.5 py-0.5 rounded-full border border-mint/20 flex items-center gap-1">
                  <Sparkles size={11} className="text-mint shrink-0" />
                  MILESTONE UNLOCKED: {unlockedMilestone.badge}
                </span>
              </div>
              <h2 className="font-serif text-xl font-bold text-white mb-1.5">{unlockedMilestone.title}</h2>
              <p className="font-sans text-[12.5px] text-white/70 leading-relaxed font-light">{unlockedMilestone.desc}</p>
            </div>
            <button
              onClick={() => setUnlockedMilestone(null)}
              className="text-white/40 hover:text-white transition-colors h-9 px-4 font-mono text-[10px] uppercase font-bold tracking-wider hover:bg-white/5 border border-white/15 rounded-full shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* HERO ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-10">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-signal rotate-45 shrink-0" />
              <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mt-px font-semibold">
                A320 · {examTitle || customTopic || questions[0]?.ata || "Quiz"} ·{" "}
                {Math.max(1, Math.round(timeElapsed / 60))} MIN
              </span>
            </div>

            <h1 className="font-serif text-[48px] md:text-[64px] text-ink leading-[1] tracking-tight mb-5">
              You{" "}
              <i className="font-serif italic tracking-normal text-navy">
                {passed ? "passed" : "missed"}
              </i>{" "}
              this block.
            </h1>

            <p className="font-sans text-[17px] text-ink-2 font-light leading-relaxed mb-8">
              {passed
                ? `Above the ${effectivePassMark}% pass cutoff with margin. `
                : `Below the ${effectivePassMark}% pass cutoff. `}
              Your weak spot was {lowestAta || "spread evenly"} — added{" "}
              {wrongQuestionIdsLocal.length} cards to your spaced-repetition deck.
              {(isNegativeMarking || isMockOrExam) && penalty > 0 && ` Includes a -${penalty} penalty.`}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                className="shadow-lg px-6 h-12 rounded-full"
                onClick={() => {
                  const wrongQuestions = questions.filter((q) => answers[q.id] !== q.correct);
                  if (wrongQuestions.length > 0) {
                    navigate(`/quiz/${topicId || "review"}-review`, {
                      state: {
                        customQuestions: wrongQuestions,
                        generatedTopic: "Review Weak Areas",
                      },
                      replace: true,
                    });
                  }
                }}
              >
                Review all {wrongQuestionIdsLocal.length} missed{" "}
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button
                variant="ghost"
                className="h-12 rounded-full px-6"
                onClick={() => startQuiz(mode)}
              >
                Retry block
              </Button>
            </div>
          </div>

          {/* DARK SCORE CARD */}
          <div className="bg-[#101214] rounded-2xl p-8 relative overflow-hidden flex flex-col shadow-2xl">
            <div className="absolute -bottom-10 -right-10 opacity-[0.04] pointer-events-none">
              <CompassLogomark size={280} spin="seek" color="white" pointerColor="white" />
            </div>

            <div className="flex justify-between items-start mb-6">
              <span className="font-mono text-[10px] text-white/40 tracking-widest uppercase">BLOCK SCORE</span>
              <span
                className={`font-mono text-[9px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full border ${passed ? "border-ring-green text-ring-green bg-ring-green/10" : "border-signal text-signal bg-signal/10"}`}
              >
                {passed ? "PASS" : "FAIL"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8 md:gap-14 mt-2">
              <div className="relative flex items-center justify-center w-40 h-40 shrink-0 z-10">
                <svg width="160" height="160" className="transform -rotate-90 absolute">
                  <circle cx="80" cy="80" r="68" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
                  <motion.circle
                    cx="80" cy="80" r="68" fill="none" stroke={passed ? "var(--ring-green)" : "var(--signal)"}
                    strokeWidth="6" strokeLinecap="round" initial={{ strokeDashoffset: Math.PI * 136 }}
                    animate={{ strokeDashoffset: Math.PI * 136 - (animatedScore / 100) * (Math.PI * 136) }}
                    transition={{ duration: 1.5, ease: "easeOut" }} strokeDasharray={Math.PI * 136}
                  />
                </svg>
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-start">
                    <span className="font-serif text-[56px] text-white leading-none tracking-tight">{animatedScore}</span>
                    <span className="font-serif text-2xl text-white/70 ml-0.5 mt-2">%</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/50 tracking-widest mt-1 uppercase">
                    {correctCount} OF {totalQuestions}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-6 border-l border-white/10 pl-8 min-w-[140px] z-10 py-2">
                <div>
                  <span className="block font-mono text-[9px] text-white/40 tracking-widest font-semibold mb-1 uppercase">PASS MARK</span>
                  <span className="font-serif text-2xl text-white block leading-none mt-1">{effectivePassMark}%</span>
                </div>
                <div>
                  <span className="block font-mono text-[9px] text-white/40 tracking-widest font-semibold mb-1 uppercase">YOUR SCORE</span>
                  <span className="font-serif text-2xl text-white block leading-none mt-1">{percentage}%</span>
                </div>
                <div>
                  <span className="block font-mono text-[9px] text-white/40 tracking-widest font-semibold mb-1 uppercase">MARGIN</span>
                  <span className="font-serif text-2xl text-white block leading-none mt-1">{marginStr}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SHAREABLE SCORECARD DOWNLOAD */}
        <ShareableScorecard
          score={correctCount}
          totalQuestions={totalQuestions}
          percentage={percentage}
          subjectTitle={customTopic || (questions && questions[0]?.ata) || "Quiz Attempt"}
          passed={passed}
          defaultUserName={user?.displayName || ""}
        />

        {/* FREE USER UPGRADE PROMPT ON MOCK END */}
        {routeTopicId === "nav-cpl-01" && !isPaidActive(userData) && (
          <div className="bg-panel rounded-2xl p-8 border border-rule shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl text-center md:text-left animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-widest font-bold uppercase text-navy bg-sky-soft/40 px-2.5 py-0.5 rounded-full border border-sky/20">
                <Sparkles size={10} className="animate-spin-slow text-navy" />
                <span>FLIGHT DEBRIEF CLEARANCE</span>
              </div>
              <h3 className="font-serif text-2xl text-ink font-semibold">Ready for Unlimited simulator flights?</h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Excellent work finishing your 1 free training mock exam. Upgrade to <b>Captain (Pro)</b> today to unlock unlimited real timed exams for DGCA and EASA, dynamic AI Ground Instructor debriefs, interactive weak-area heatmaps, and oral board viva flashcards.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate("/pricing")}
              className="w-full md:w-auto px-6 h-12 bg-navy hover:bg-navy-dark text-bg font-mono text-xs tracking-wider uppercase rounded-full shadow-lg shrink-0"
            >
              GET UNLIMITED ACCESS
              <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        )}

        {!user && (
          <div className="bg-[#101214] text-bg rounded-2xl p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="space-y-2 max-w-xl text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest font-bold uppercase text-mint bg-mint/10 px-2.5 py-0.5 rounded-full border border-mint/20">
                <Flame size={12} className="text-mint animate-pulse" />
                <span>PRESERVE PERFORMANCE HISTORY</span>
              </div>
              <h3 className="font-serif text-2xl text-white">Secure this performance in your active records.</h3>
              <p className="font-sans text-xs text-white/70 leading-relaxed font-light">
                You just cleared this block with {correctCount} correct out of {totalQuestions} total questions. Sign in now to automatically merge this session, initiate active spaced reviews, and keep your study streak alive!
              </p>
            </div>
            <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center">
              <Button
                variant="primary"
                className="w-full sm:w-auto bg-mint text-bg hover:bg-mint/80 px-6 h-11 rounded-full font-serif text-xs font-semibold border-0"
                onClick={() => openAuthModal("signup")}
              >
                Sign Up & Save Session
              </Button>
            </div>
          </div>
        )}

        {/* 4 STAT CARDS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-12">
          <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent">
            <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">CORRECT</span>
            <div className="flex items-end text-ink">
              <span className="font-serif text-[42px] leading-none" style={{ color: passed ? "var(--mint)" : "var(--signal)" }}>
                {correctCount}
              </span>
              <span className="font-serif text-xl mb-1 ml-0.5 text-muted-2">/{totalQuestions}</span>
            </div>
          </div>

          <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent flex flex-col justify-between">
            <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">ACCURACY</span>
            <div className="flex items-start text-ink mb-2">
              <span className="font-serif text-[42px] leading-none" style={{ color: passed ? "var(--mint)" : "var(--signal)" }}>
                {percentage}
              </span>
              <span className="font-serif text-xl ml-0.5 mt-1 text-muted">%</span>
            </div>
            <span className="font-mono text-[9px] text-muted mt-auto">↑ 4 vs avg</span>
          </div>

          <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent flex flex-col justify-between">
            <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">AVG PER Q</span>
            <span className="font-serif text-[42px] leading-none text-ink mb-2">{formatTime(avgTime)}</span>
            <span className="font-mono text-[9px] text-muted mt-auto flex justify-between">
              <span>{rushed} rushed</span>
              <span>{slow} slow</span>
            </span>
          </div>

          <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent flex flex-col justify-between">
            <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">CONFIDENCE</span>
            <span className="font-serif text-[42px] leading-none text-ink mb-2">{confidence}</span>
            <span className="font-mono text-[9px] text-muted mt-auto">
              {confidentAns} of {totalQuestions} ≥ 4★
            </span>
          </div>
        </div>

        {/* AI Box */}
        {aiCoachEnabled && (
          <div className="mb-12">
            {!user ? (
              <div className="border border-dashed border-rule bg-bg p-6 rounded-xl text-center flex flex-col items-center gap-2 shadow-sm">
                <p className="font-sans text-[14px] font-mono tracking-widest uppercase text-muted-2">Sign in to use AI coaching</p>
              </div>
            ) : !studyPlan && !isCoachLoading ? (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                className="border border-rule bg-paper p-6 rounded-xl text-center flex flex-col items-center gap-4 hover:border-mint/50 hover:bg-ring-green/5 transition-colors group cursor-pointer shadow-sm"
                onClick={handleGetStudyPlan}
              >
                <Sparkles className="text-muted group-hover:text-mint transition-colors" size={24} />
                <p className="text-[15px] font-light text-ink-2">Want a tailored recovery plan based on this payload?</p>
                <Button variant="ghost" className="pointer-events-none group-hover:text-mint transition-colors font-mono tracking-widest text-[10px] uppercase">
                  Generate Study Plan
                </Button>
              </div>
            ) : (
              <div className="border border-ring-green/40 bg-ring-green/10 p-6 md:p-8 rounded-xl relative shadow-sm">
                <div className="flex items-center gap-2 mb-6 font-mono text-xs uppercase tracking-widest text-mint font-semibold">
                  <Sparkles size={14} /> Recommended Plan
                </div>
                {isCoachLoading && !studyPlan ? (
                  <div className="space-y-4 animate-pulse pt-2">
                    <div className="h-4 bg-mint/20 rounded w-full"></div>
                    <div className="h-4 bg-mint/20 rounded w-11/12"></div>
                    <div className="h-4 bg-mint/20 rounded w-3/4"></div>
                  </div>
                ) : (
                  <div className="font-sans font-light text-ink leading-relaxed whitespace-pre-wrap text-[15px] md:text-[16px]">
                    {studyPlan}
                    {isCoachLoading && <span className="animate-pulse inline-block ml-1">▋</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Q-by-Q TABLE */}
        <div className="bg-paper bg-opacity-70 border border-rule/50 rounded-xl shadow-sm overflow-hidden mb-8 backdrop-blur-sm">
          <div className="p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-rule/50 gap-6">
            <h2 className="font-serif text-[40px] text-ink tracking-tight leading-[1.05] flex-shrink-0">
              Question-by- <br className="hidden sm:block" /> question
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-ring-green/10 text-mint font-mono text-[9px] uppercase tracking-widest font-semibold shrink-0">
                <span className="font-serif text-sm mr-1.5">{correctCount}</span> CORRECT
              </span>
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 text-signal font-mono text-[9px] uppercase tracking-widest font-semibold shrink-0">
                <span className="font-serif text-sm mr-1.5">{realWrong}</span> WRONG
              </span>
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-rule/50 text-muted font-mono text-[9px] uppercase tracking-widest font-semibold shrink-0">
                <span className="font-serif text-sm mr-1.5">{realSkipped}</span> SKIPPED
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-[13px] md:text-sm whitespace-nowrap">
              <thead>
                <tr className="font-mono text-[9px] text-muted-2 tracking-widest uppercase border-b border-rule/50 font-semibold bg-bg/30">
                  <th className="font-normal py-4 px-6 md:px-8 w-12 text-center">#</th>
                  <th className="font-normal py-4 px-4 w-24">TOPIC</th>
                  <th className="font-normal py-4 px-4 min-w-[300px]">QUESTION</th>
                  <th className="font-normal py-4 px-4 w-20 text-center">TIME</th>
                  <th className="font-normal py-4 px-6 md:px-8 w-32 text-right">RESULT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/50 font-light text-ink">
                {(showAllQs ? questions : questions.slice(0, 7)).map((q, i) => {
                  let statusText = "SKIPPED";
                  let statusColor = "text-muted";
                  let bgHover = "hover:bg-panel";
                  if (answers[q.id]) {
                    if (answers[q.id] === q.correct) {
                      statusText = "✓ CORRECT";
                      statusColor = "text-mint";
                      bgHover = "hover:bg-ring-green/5";
                    } else {
                      statusText = "✕ MISSED";
                      statusColor = "text-signal";
                      bgHover = "hover:bg-signal/5";
                    }
                  }
                  const timeStr = timePerQuestion[q.id] ? formatTime(timePerQuestion[q.id]) : "--:--";

                  return (
                    <tr role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                      key={q.id}
                      className={`transition-colors group cursor-pointer ${bgHover}`}
                      onClick={() =>
                        navigate(`/quiz/${topicId || "review"}-review`, {
                          state: { customQuestions: [q], generatedTopic: "Review Detail" },
                        })
                      }
                    >
                      <td className="py-4 px-6 md:px-8 text-center text-muted font-mono text-xs">{(i + 1).toString().padStart(2, "0")}</td>
                      <td className="py-4 px-4 text-muted-2 font-mono text-[10px] uppercase tracking-wider">{q.ata}</td>
                      <td className="py-4 px-4 text-ink truncate max-w-sm lg:max-w-xl">{q.prompt}</td>
                      <td className="py-4 px-4 text-center font-mono text-[10px] text-muted">{timeStr}</td>
                      <td className={`py-4 px-6 md:px-8 text-right font-mono text-[10px] tracking-widest uppercase flex items-center justify-end gap-2 group-hover:font-semibold transition-all shadow-none ${statusColor}`}>
                        {statusText} <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {questions.length > 7 && (
            <div className="p-4 bg-bg/30 border-t border-rule text-center flex justify-start pl-6 md:pl-8">
              <button
                onClick={() => setShowAllQs(!showAllQs)}
                className="flex items-center gap-2 border border-rule rounded-full px-5 py-2 font-sans text-sm text-ink hover:bg-paper transition-colors shrink-0 outline-none hover:border-ink/20 shadow-sm bg-paper"
              >
                {showAllQs ? "Collapse" : `Show all ${totalQuestions}`}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${showAllQs ? "rotate-180" : ""}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-center pl-2 pb-6">
          <Button variant="ghost" className="text-muted hover:text-ink px-2 py-1 font-sans text-sm" onClick={() => navigate("/analytics")}>
            View Logbook
          </Button>
          <div className="w-1 h-1 bg-rule rounded-full shrink-0" />
          <Button variant="ghost" className="text-muted hover:text-ink px-2 py-1 font-sans text-sm" onClick={() => navigate("/bookmarks")}>
            View Bookmarks
          </Button>
          <div className="w-1 h-1 bg-rule rounded-full shrink-0" />
          <Button variant="ghost" className="text-muted hover:text-ink px-2 py-1 font-sans text-sm"
            onClick={async () => {
              const shareData = {
                title: "Heading: Mission Debrief",
                text: `I just scored ${percentage}% on the ${customTopic || questions[0]?.ata || "Quiz"} module!\n\nScore: ${correctCount}/${totalQuestions}\nAccuracy: ${percentage}%\nAverage Time: ${formatTime(avgTime)}`,
                url: window.location.href,
              };
              if (navigator.share && navigator.canShare(shareData)) {
                try {
                  await navigator.share(shareData);
                } catch (err) {
                  console.error(err);
                }
              } else {
                try {
                  await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
                  alert("Copied to clipboard!");
                } catch (err) {
                  alert("Failed to copy to clipboard.");
                }
              }
            }}
          >
            Share Debrief
          </Button>
        </div>
      </div>
    </div>
  );
}
