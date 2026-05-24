import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Chip, Button } from "../components/Atoms";
import { Timer, Clipboard, PlaneTakeoff, ArrowUpRight } from "lucide-react";
import { mockExams } from "../data/topics";
import { Question } from "../data/questions";
import { fetchPublishedQuestions } from "../lib/content";
import { ProGate } from "../components/ProGate";

export default function MockExamsView() {
  const navigate = useNavigate();
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const pub = await fetchPublishedQuestions();
        setQuestions(pub);
      } catch (err) {
        console.error("Error loading mock exam questions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, []);

  const getExamQuestions = (exam: any) => {
    if (exam.id === "nav-cpl-01") {
      return questions.filter(q => 
        q.topicId === "air-navigation" || 
        q.topicId === "nav-gen" || 
        q.topicId === "nav-rad" || 
        q.topicId === "nav-inst" ||
        q.topicId.startsWith("nav-")
      );
    }
    if (exam.id === "met-atpl-01") {
      return questions.filter(q => 
        q.topicId === "meteorology" || 
        q.topicId === "met-1" || 
        q.topicId === "met-2" ||
        q.topicId.startsWith("met-")
      );
    }
    if (exam.id === "ops-cpl-02") {
      return questions.filter(q => 
        q.topicId === "air-regulation" || 
        q.topicId === "reg-1" ||
        q.topicId.startsWith("reg-")
      );
    }
    if (exam.id === "agk-atpl-03") {
      return questions.filter(q => 
        q.topicId === "atg" || 
        q.topicId === "ata-70" || 
        q.topicId === "ata-73" ||
        q.topicId.startsWith("ata-") ||
        (q.ata && q.ata.toLowerCase().includes("engine"))
      );
    }
    return questions.filter(q => q.topicId === exam.id);
  };

  const handleStartExam = (exam: any, examQuests: Question[]) => {
    const sessionKey = `heading_mock_exam_${exam.id}_quests`;
    const sessionData = {
      expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      questions: examQuests,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    navigate(`/quiz/${exam.id}`, {
      state: {
        sessionStorageKey: sessionKey,
      }
    });
  };

  const filteredExams = selectedDifficulty === "all" 
    ? mockExams 
    : mockExams.filter(exam => exam.difficulty === selectedDifficulty);

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
        <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto space-y-12 animate-pulse">
          <div className="max-w-xl space-y-4">
            <div className="h-4 bg-muted-2/25 w-40 rounded font-mono"></div>
            <div className="h-10 bg-ink/10 w-80 rounded-lg"></div>
            <div className="h-4 bg-muted/20 w-full rounded"></div>
            <div className="h-4 bg-muted/20 w-4/5 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-paper border border-rule/50 rounded-2xl p-6 h-64 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-6 bg-ink/10 w-3/4 rounded"></div>
                  <div className="h-4 bg-muted/20 w-full rounded"></div>
                  <div className="h-4 bg-muted/20 w-5/6 rounded"></div>
                </div>
                <div className="flex justify-between items-end pt-4">
                  <div className="h-4 bg-muted-2/20 w-24 rounded"></div>
                  <div className="h-9 bg-ink/10 w-28 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <span className="eyebrow block mb-3">VIRTUAL SIMULATION SYSTEM</span>
            <h2 className="h-section text-ink font-semibold">Mock Examinations</h2>
            <p className="mt-4 font-sans font-light text-muted text-md leading-relaxed">
              Experience the pressure of real examination screens. Heading administers simulated exam feeds 
              synchronized exactly to standard European and Asian Civil Aviation authorities.
            </p>
          </div>

          {/* Difficulty filter utilizing button layout */}
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <button 
              onClick={() => setSelectedDifficulty("all")}
              className={`px-4 py-2 rounded-full border transition-all ${
                selectedDifficulty === "all" 
                  ? "bg-ink text-paper border-ink" 
                  : "bg-paper text-ink border-rule hover:bg-bg-2"
              }`}
            >
              ALL COMPLIANCES
            </button>
            <button 
              onClick={() => setSelectedDifficulty("standard")}
              className={`px-4 py-2 rounded-full border transition-all ${
                selectedDifficulty === "standard" 
                  ? "bg-ink text-paper border-ink" 
                  : "bg-paper text-ink border-rule hover:bg-bg-2"
              }`}
            >
              STANDARD (CPL)
            </button>
            <button 
              onClick={() => setSelectedDifficulty("complex")}
              className={`px-4 py-2 rounded-full border transition-all ${
                selectedDifficulty === "complex" 
                  ? "bg-ink text-paper border-ink" 
                  : "bg-paper text-ink border-rule hover:bg-bg-2"
              }`}
            >
              COMPLEX (ATPL)
            </button>
          </div>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredExams.map((exam) => {
            const hasSavedState = !!localStorage.getItem(`heading_quiz_state_${exam.id}`);
            const examQuests = getExamQuestions(exam);
            const hasQuestions = examQuests.length >= 10;
            
            return (
              <ProGate type="timed-mock" isUnlocked={exam.id === "nav-cpl-01"}>
            <Card key={exam.id} className={`relative hover:shadow-[0_12px_36px_rgba(13,26,45,0.06)] transition-all ${
              !hasQuestions ? "opacity-60 grayscale-[30%]" : ""
            }`} id={`mock-exam-card-${exam.id}`}>
              {/* Corner Accent indicator */}
              <div className="absolute top-0 right-0 h-10 w-10 flex items-center justify-center">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  !hasQuestions ? "bg-muted" :
                  exam.difficulty === "extreme" ? "bg-signal animate-pulse" :
                  exam.difficulty === "complex" ? "bg-amber" : "bg-mint"
                }`} />
              </div>

              <div className="flex items-center gap-2 mb-4">
                {!hasQuestions && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-signal/10 border border-signal/20 text-signal font-mono text-[9px] uppercase tracking-widest mr-2 animate-pulse">
                    <span className="w-1.2 h-1.2 rounded-full bg-signal" /> CONTENT IN PROGRESS
                  </span>
                )}
                {hasSavedState && hasQuestions && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-mint/10 border border-mint/20 text-mint font-mono text-[9px] uppercase tracking-widest mr-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-mint shadow-[0_0_8px] shadow-mint/60" /> IN PROGRESS
                  </span>
                )}
                <span className="footnote text-[10px] tracking-widest">{exam.code}</span>
                <span className="text-rule-strong text-xs">|</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
                  PASS PRE-REQ: {exam.passingScore}%
                </span>
              </div>

              <h3 className="h-card-title text-ink font-semibold mb-6">
                {exam.subject}
              </h3>

              <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-panel border border-rule mb-8">
                <div className="text-center md:text-left">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wide">TIME LIMIT</span>
                  <span className="text-sm font-sans font-medium text-ink flex items-center justify-center md:justify-start gap-1 mt-1">
                    <Timer size={14} className="text-sky" /> {exam.minutes} min
                  </span>
                </div>

                <div className="text-center md:text-left border-x border-rule px-4">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wide">PAYLOAD</span>
                  <span className="text-sm font-sans font-medium text-ink flex items-center justify-center md:justify-start gap-1 mt-1">
                    <Clipboard size={14} className="text-amber" /> {examQuests.length} items
                  </span>
                </div>

                <div className="text-center md:text-left">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wide">DIFFICULTY</span>
                  <div className="mt-1">
                    {exam.difficulty === "extreme" && <Chip variant="signal">EXTREME</Chip>}
                    {exam.difficulty === "complex" && <Chip variant="amber">COMPLEX</Chip>}
                    {exam.difficulty === "standard" && <Chip variant="mint">STANDARD</Chip>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-rule" id={`exam-actions-${exam.id}`}>
                <span className="font-mono text-[10px] text-muted-2">
                  ANNEXED METRICS ONBOARD
                </span>
                {hasQuestions ? (
                  <Button 
                    variant="primary" 
                    className="h-[38px] px-5 text-xs"
                    onClick={() => handleStartExam(exam, examQuests)}
                  >
                    {hasSavedState ? 'Resume Cabin' : 'Launch Instrument Cabin'} <ArrowUpRight size={14} className="ml-0.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" disabled className="h-[38px] px-5 text-xs border border-rule text-muted cursor-not-allowed">
                    Coming Soon <ArrowUpRight size={14} className="ml-0.5" />
                  </Button>
                )}
              </div>
            </Card>
              </ProGate>
          )})}
        </div>

        {/* Informative Pilot Card */}
        <div className="mt-16 bg-panel border-l-4 border-signal border-t border-r border-b border-rule rounded-r-lg p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
          <PlaneTakeoff className="text-signal w-10 h-10 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-sans font-semibold text-ink text-sm uppercase tracking-wide">
              MANDATORY PILOT REMINDER (SECTION 117 COMPLIANCE)
            </h4>
            <p className="font-sans text-xs text-muted-2 leading-relaxed">
              Entering the test deck represents simulated flight stress training. High fatigue rates may distort cognitive test answers. 
              Always review navigation chart rules before proceeding to ATPL standard questions.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
