import React, { useState, useEffect } from "react";
import { Button } from "../../components/Atoms";
import { MoveRight, CheckCircle2, X, Clock } from "lucide-react";
import { Question } from "../../data/questions";
import { staticQuestionBank } from "../../data/staticQuestions";

// ponytail: static import, not dynamic. This is the homepage's right-column
// LCP candidate — it used to always mount in a `loading=true` skeleton state
// and run its OWN fetchPublishedQuestions() call regardless of the
// `initialQuestions` prop, ignoring data HomeView already fetched. That
// produced a guaranteed hydration mismatch against the prerendered HTML (which
// captured the fully-loaded card) and a ~1.5-2s waterfall before the real
// (larger) card replaced the skeleton — Chrome was crowning THAT late, bigger
// paint as the page's LCP. Seeding state synchronously from the static bank
// means there's always something full-sized to show on the very first render;
// no skeleton, no internal fetch, no second late LCP candidate.
function pickQuestions(source: Question[] | undefined): Question[] {
  if (source && source.length > 0) {
    return [...source].sort(() => 0.5 - Math.random()).slice(0, 10);
  }
  return [...(staticQuestionBank || [])].sort(() => 0.5 - Math.random()).slice(0, 10);
}

export function InteractiveSampleQuestion({ questions: initialQuestions }: { questions?: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(() => pickQuestions(initialQuestions));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [shake, setShake] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  // Quietly swap in HomeView's live DB questions once that fetch resolves —
  // same-sized card either way, so no skeleton/loading flash.
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setQuestions(pickQuestions(initialQuestions));
    }
  }, [initialQuestions]);

  // Handle auto-rotate interval: clean up correctly and pause on interaction or hover
  useEffect(() => {
    if (questions.length === 0) return;

    // Pause if hovering, if an option is selected, or if the answer has been submitted
    const isPaused = isHovered || selected !== null || submitted;
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % questions.length);
    }, 6000);

    return () => {
      clearInterval(interval);
    };
  }, [questions.length, isHovered, selected, submitted]);

  // Defensive fallback — pickQuestions always returns the static bank when
  // empty, so this should be unreachable, but guard against an empty bank.
  if (questions.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm text-center relative overflow-hidden w-full max-w-[90vw] sm:max-w-sm md:max-w-md mx-auto md:mx-0 shrink-0 min-h-[360px] sm:min-h-[420px] md:h-[450px] flex flex-col justify-between items-stretch animate-pulse">
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
    <div
      className={`bg-paper border border-rule rounded-2xl py-5 px-6 shadow-sm text-left relative overflow-hidden w-full max-w-[90vw] sm:max-w-sm md:max-w-md mx-auto md:mx-0 shrink-0 min-h-[450px] flex flex-col justify-between ${shake ? "anim-shake" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top right stamp — decorative faux document-revision mark */}
      <div aria-hidden="true" className="absolute top-6 right-2 transform rotate-12 opacity-30 font-mono text-[10px] tracking-widest pointer-events-none select-none text-ink">
        {getTopRightStamp(currentQ.ata)} REV 1
      </div>

        <div
          key={currentIndex}
          className="anim-q-slide flex-grow flex flex-col justify-between"
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

            {submitted && (
              <div className="anim-fade mb-4 font-sans text-[13px] text-ink-2 bg-rule/30 p-3 rounded-lg border border-rule overflow-hidden">
                <span className="font-semibold text-ink">Explanation:</span> {currentQ.explanation.split('.')[0]}.
              </div>
            )}
          </div>
        </div>

      <div className="flex items-center justify-between mt-auto border-t border-rule/20 pt-4 relative">
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[8px] sm:text-[9px] text-muted-2 tracking-[0.1em] sm:tracking-[0.2em] uppercase -my-3">
          <button onClick={() => handleToolbarClick("BOOKMARK")} className="inline-flex items-center min-h-[44px] px-1 -mx-1 hover:text-ink transition-colors outline-none focus-visible:ring-2">BOOKMARK</button>
          <span>·</span>
          <button onClick={() => handleToolbarClick("NOTE")} className="inline-flex items-center min-h-[44px] px-1 -mx-1 hover:text-ink transition-colors outline-none focus-visible:ring-2">NOTE</button>
          <span>·</span>
          <button onClick={() => handleToolbarClick("SKIP")} className="inline-flex items-center min-h-[44px] px-1 -mx-1 hover:text-ink transition-colors outline-none focus-visible:ring-2">SKIP</button>
        </div>

        {showTooltip && (
          <div className="anim-pop absolute bottom-14 left-0 font-sans text-xs bg-ink text-bg px-3 py-1.5 rounded shadow-lg whitespace-nowrap z-20 max-w-[calc(100%-1rem)]">
            {tooltipMessage}
            <div className="absolute -bottom-1 left-4 w-2 h-2 bg-ink transform rotate-45"></div>
          </div>
        )}

        <Button onClick={handleSubmit} variant="primary" className="h-9 sm:h-10 px-4 sm:px-5 bg-ink text-bg text-[13px] sm:text-[14px] rounded-full hover:bg-ink-2 shrink-0">
          {submitted ? (
            <>Next Question <MoveRight size={14} className="ml-1.5" /></>
          ) : (
            <>Submit <MoveRight size={14} className="ml-1.5" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
