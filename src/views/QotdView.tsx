import React, { useState, useEffect } from "react";
import { fetchPublishedQuestions } from "../lib/content";
import { Question } from "../data/questions";
import { Button, Card } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Compass, 
  HelpCircle, 
  ArrowRight, 
  BookOpen
} from "lucide-react";

export default function QotdView() {
  const { openAuthModal, user } = useAuth();
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Set precise daily SEO/OG tags
  useDocumentMeta();

  useEffect(() => {
    async function getDailyQuestion() {
      setLoading(true);
      try {
        const list = await fetchPublishedQuestions();
        if (list && list.length > 0) {
          // Deterministic daily pick: use days since Unix epoch
          const msPerDay = 86400000;
          const daysSinceEpoch = Math.floor(Date.now() / msPerDay);
          const index = daysSinceEpoch % list.length;
          
          setCurrentQ(list[index]);
        }
      } catch (err) {
        console.warn("Could not load public QOTD content directly:", err);
      } finally {
        setLoading(false);
      }
    }
    getDailyQuestion();
  }, []);

  const handleOptionSelect = (opt: string) => {
    if (isSubmitted) return;
    setSelectedOption(opt);
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setSelectedOption(null);
    setIsSubmitted(false);
  };

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Check if answer is correct
  const isCorrect = selectedOption === currentQ?.correct;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8 font-sans">
      
      {/* 1. TOP HEADER BRAND */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/10 border border-navy/15 text-navy rounded-full font-mono text-[9px] font-bold uppercase tracking-widest">
          <Calendar size={11} /> DAILY FLIGHT BRIEFING
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          Question of the Day
        </h1>
        <p className="text-muted text-xs font-mono uppercase tracking-wider">
          {formattedDate}
        </p>
      </div>

      {/* 2. DYNAMIC QUESTION BOX */}
      {loading ? (
        <Card className="p-12 text-center border border-rule bg-paper rounded-2xl">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs text-muted-2">Retrieving flight logs for today's question...</p>
        </Card>
      ) : !currentQ ? (
        <Card className="p-8 text-center border-dashed border-2 border-rule bg-paper rounded-2xl space-y-3">
          <HelpCircle size={32} className="text-muted mx-auto" />
          <h4 className="font-serif text-base font-bold text-ink">No question dispatched</h4>
          <p className="text-muted text-xs max-w-sm mx-auto">
            Today's question feed is temporarily offline. Please log in or reload the dispatch terminal.
          </p>
        </Card>
      ) : (
        <Card className="border border-rule-strong bg-paper rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          
          {/* Question Metadata */}
          <div className="flex flex-wrap gap-2 items-center justify-between border-b border-rule pb-4 text-[10px] font-mono text-muted-2 uppercase tracking-wide">
            <span className="bg-bg-2 border border-rule px-2 py-0.5 rounded text-ink font-semibold">
              ATA Area: {currentQ.ata || "Air Navigation"}
            </span>
            <span>DIFFICULTY: HIGH LEVEL</span>
          </div>

          {/* Question Text */}
          <h2 className="font-serif text-lg sm:text-xl text-ink leading-relaxed">
            {currentQ.prompt}
          </h2>

          {/* Answer Options */}
          <div className="space-y-3 pt-2" id="qotdOptionsList">
            {currentQ.choices?.map((choice) => {
              const optKey = choice.id;
              const optionText = choice.label;
              if (!optionText) return null;

              const isSelected = selectedOption === optKey;
              const isOptionCorrect = optKey === currentQ.correct;

              let btnStyle = "border-rule bg-transparent text-ink hover:bg-bg/40";
              if (isSelected) {
                btnStyle = "border-navy bg-navy/5 text-navy font-medium";
              }
              if (isSubmitted) {
                if (isOptionCorrect) {
                  btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-800 font-semibold";
                } else if (isSelected) {
                  btnStyle = "border-rose-500 bg-rose-500/10 text-rose-800 font-semibold";
                } else {
                  btnStyle = "border-rule bg-transparent text-muted/50 pointer-events-none";
                }
              }

              return (
                <button
                  key={optKey}
                  disabled={isSubmitted}
                  onClick={() => handleOptionSelect(optKey)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-4 outline-none ${btnStyle} ${!isSubmitted ? 'cursor-pointer active:scale-[0.995]' : ''}`}
                >
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold uppercase shrink-0 ${
                    isSelected ? 'border-navy bg-navy text-white' : 'border-rule bg-bg text-muted-2'
                  }`}>
                    {optKey}
                  </span>
                  <span className="text-xs sm:text-sm leading-tight pt-0.5">{optionText}</span>
                </button>
              );
            })}
          </div>

          {/* Submit Action Block */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-rule">
            {!isSubmitted ? (
              <>
                <p className="text-muted text-[11px]">
                  Select your dispatch vector. Lock in to reveal the correct result.
                </p>
                <Button 
                  id="qotdSubmitBtn"
                  variant="primary" 
                  disabled={!selectedOption}
                  onClick={handleSubmit}
                  className="w-full sm:w-auto px-8 h-10 rounded-full font-mono text-[11px] uppercase bg-ink disabled:opacity-45 text-bg cursor-pointer"
                >
                  Lock In Answer
                </Button>
              </>
            ) : (
              <div className="w-full space-y-6">
                
                {/* Visual Feedback Banner */}
                <div className={`p-4 rounded-xl border flex items-start gap-4 ${
                  isCorrect 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="shrink-0 mt-0.5">
                    {isCorrect ? (
                      <CheckCircle className="text-emerald-600" size={18} />
                    ) : (
                      <XCircle className="text-rose-600" size={18} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-serif text-sm font-bold">
                      {isCorrect ? "Correct Dispatch Vector!" : "Instrument Misalignment"}
                    </h4>
                    <p className="text-xs leading-relaxed opacity-90">
                      You selected <strong className="uppercase">({selectedOption})</strong>. 
                      {isCorrect 
                        ? " Excellent alignment. Your airmanship calculations hold up." 
                        : ` The correct answer was (${currentQ.correct}). Review the technical rationale below.`}
                    </p>
                  </div>
                </div>

                {/* Technical Explanation */}
                {currentQ.explanation && (
                  <div className="space-y-3 bg-bg/50 p-5 rounded-xl border border-rule">
                    <div className="flex items-center gap-1.5 text-navy font-mono text-[10px] font-bold uppercase tracking-wider">
                      <BookOpen size={14} /> Model Technical Explanation
                    </div>
                    <p className="text-ink text-xs sm:text-sm leading-relaxed font-light">
                      {currentQ.explanation}
                    </p>
                  </div>
                )}

                {/* Retake buttons */}
                <div className="flex justify-end pt-2">
                  <button 
                    id="qotdResetBtn"
                    onClick={handleReset}
                    className="text-xs font-mono uppercase tracking-widest text-muted-2 hover:text-ink hover:underline cursor-pointer"
                  >
                    Clear answer & try again
                  </button>
                </div>

              </div>
            )}
          </div>

        </Card>
      )}

      {/* 3. PERSUASIVE CONVERTING CALLOUT (PUBLIC CONVERSION) */}
      {!user && (
        <Card className="bg-[#0F172A] border border-slate-800 text-white p-6 sm:p-8 rounded-2xl shadow-xl space-y-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full filter blur-xl pointer-events-none" />
          
          <div className="space-y-2 max-w-lg">
            <span className="font-mono text-[8.5px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-widest inline-flex items-center gap-1">
              <Compass size={11} className="spin" /> UNLEASH THE COMPLETE SIMULATOR
            </span>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-white">
              Unlock 10,000+ C1 Flight Syllabus Questions
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Unlock actual DGCA, EASA, and FAA mock exams. Access personalized AI ground trainer study plans, custom flight diagnostic stats, and offline performance tracking.
            </p>
          </div>

          <Button 
            id="qotdAuthRegisterCTA"
            variant="primary" 
            onClick={() => openAuthModal("signup")}
            className="w-full sm:w-auto h-11 px-6 rounded-full font-mono text-xs uppercase bg-white text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            Access Free Simulator <ArrowRight size={14} />
          </Button>
        </Card>
      )}

    </div>
  );
}
