import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Wordmark } from "../../components/Atoms";
import { QuizLayoutProps } from "./types";
import { FlightControlsDiagram } from "../../components/SystemDiagram";

export default function InstrumentLayout({
  currentQ,
  currentIndex,
  totalQuestions,
  questions,
  mode,
  selectedOptionId,
  answers,
  isBookmarked,
  timeLeft,
  timeElapsed,
  formatTime,
  handleSelectOption,
  handleNext,
  handlePrev,
  handleJump,
  toggleBookmark,
  setShowAbortPrompt,
  showAbortPrompt,
  storageKey,
  customQuestions,
  navigate
}: QuizLayoutProps) {

  // Cockpit is always dark. The root .dark class alone doesn't reliably
  // re-scope the theme CSS vars, so force `dark` on <html> while mounted and
  // restore the user's prior theme on exit.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  let correctAnswers = 0;
  let totalAnswered = 0;
  questions.forEach(q => {
    if (answers[q.id]) {
      totalAnswered++;
      if (answers[q.id] === q.correct) correctAnswers++;
    }
  });
  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 100;

  let pace = 100;
  if (timeLeft !== null && mode === "timed") {
     const totalSec = timeElapsed + timeLeft;
     const expectedTimeElapsed = totalSec * ((currentIndex + 1) / totalQuestions);
     pace = timeElapsed > 0 ? Math.min(100, Math.round((expectedTimeElapsed / timeElapsed) * 100)) : 100;
  }

  return (
    <div className="dark flex flex-col h-screen h-[100dvh] overflow-hidden bg-bg text-ink selection:bg-mint/30">
      {/* TOP BAR */}
      <header className="h-[calc(64px+var(--sat))] pt-[var(--sat)] border-b border-rule shrink-0 px-4 md:px-8 flex items-center justify-between z-40 bg-bg">
        <div className="flex items-center gap-4">
          <Wordmark compassSize={20} className="hidden sm:flex text-ink" />
          <div className="w-px h-6 bg-rule hidden sm:block"></div>
          <span className="font-mono text-[10px] md:text-[11px] tracking-widest text-[#f5f2ea]/60 uppercase flex items-center gap-2">
             SESSION <span className="text-[#f5f2ea]/30">·</span> {customQuestions ? "CUSTOM" : "9F2A"} <span className="text-[#f5f2ea]/30">·</span> MOCK
          </span>
        </div>

        <div className="flex items-center gap-[18px] md:gap-5">
          <div className="font-mono text-[10px] md:text-[11px] text-[#8a94a6] tracking-widest hidden sm:block uppercase">
            Q {(currentIndex + 1).toString().padStart(3, '0')} / {totalQuestions.toString().padStart(2, '0')}
          </div>
          
          <div className="flex items-center gap-2 border-l border-rule pl-4 md:pl-5">
            <div className="w-2 h-2 rounded-full bg-ring-green" />
            <span className="font-mono text-[10px] md:text-[11px] text-ring-green tracking-widest uppercase font-semibold">LIVE</span>
          </div>

          <div className="font-mono text-[10px] md:text-[11px] text-muted tracking-widest hidden lg:block uppercase ml-2">
            ELP {formatTime(timeElapsed)}
          </div>

          {timeLeft !== null && (
            <motion.div
              animate={timeLeft < 300 ? {
                scale: [1, 1.05, 1],
                opacity: [1, 0.7, 1],
              } : {}}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              title="Time remaining"
              className={`font-mono text-[10px] md:text-[11px] tracking-widest flex items-center gap-1.5 ml-2 lg:ml-4 uppercase cursor-default ${
                timeLeft < 300
                  ? 'text-[#ff4d4d] font-semibold drop-shadow-[0_0_8px_rgba(255,77,77,0.4)]'
                  : 'text-ink'
              }`}
            >
              {timeLeft < 300 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d4d] shrink-0 animate-pulse" />
              )}
              FUEL {formatTime(timeLeft)}
            </motion.div>
          )}

          <Button 
            variant="ghost"
            onClick={() => setShowAbortPrompt(true)}
            className="ml-2 h-7 px-3 md:px-4 flex items-center gap-1.5 text-[10px] md:text-[11px] font-mono text-ink border border-rule rounded-full bg-transparent hover:bg-rule uppercase tracking-widest"
          >
            END
          </Button>
        </div>
      </header>

      <div className="flex-1 w-full flex flex-col sm:flex-row min-h-0 relative z-10 transition-all duration-300">
        
        {/* LEFT RAIL (LADDER) */}
        <div className="w-16 md:w-20 border-r border-rule shrink-0 overflow-y-auto hidden sm:flex flex-col items-center bg-bg pt-8 pb-32 no-scrollbar">
          <div className="flex flex-col gap-1 w-full px-2">
             {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = !!answers[q.id];
                const isFlagged = isCurrent && isBookmarked; // Partial flagged support since full bookmarks array isn't here
                
                let tickClass = "bg-rule";
                if (isCurrent) tickClass = "bg-amber w-6";
                else if (isFlagged) tickClass = "bg-signal w-4";
                else if (isAnswered) tickClass = "bg-mint w-4";

                return (
                  <button 
                    key={q.id}
                    onClick={() => handleJump?.(idx)}
                    className={`h-7 w-full flex flex-col items-center justify-center relative cursor-pointer outline-none hover:bg-rule/30 rounded-md transition-colors ${isCurrent ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <div className="flex items-center gap-2 px-1 w-full opacity-0 hover:opacity-100 absolute left-full ml-1 z-50">
                       {/* Optional hover tooltip */}
                    </div>
                    <div className="flex items-center gap-2 justify-center w-full">
                      <span className={`font-mono text-[9px] ${isCurrent ? 'text-amber' : 'text-muted-2'}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                      <div className={`h-[3px] rounded-full transition-all ${tickClass}`} style={{ minWidth: isCurrent ? '24px' : '16px' }} />
                    </div>
                  </button>
                )
             })}
          </div>
        </div>

        {/* MOBILE LADDER */}
        <div className="sm:hidden w-full border-b border-rule flex overflow-x-auto shrink-0 py-2 px-4 gap-4 no-scrollbar">
          {questions.map((q, idx) => {
             const isCurrent = idx === currentIndex;
             const isAnswered = !!answers[q.id];
             
             let tickClass = "bg-rule";
             if (isCurrent) tickClass = "bg-amber w-6";
             else if (isAnswered) tickClass = "bg-mint w-4";
             
             return (
               <button 
                 key={q.id}
                 onClick={() => handleJump?.(idx)}
                 className={`flex flex-col items-center justify-center gap-1.5 shrink-0 transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-50'}`}
               >
                 <span className={`font-mono text-[9px] ${isCurrent ? 'text-amber' : 'text-muted-2'}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                 <div className={`h-[3px] rounded-full ${tickClass}`} style={{ minWidth: isCurrent ? '20px' : '16px' }} />
               </button>
             )
          })}
        </div>

        {/* CENTER PANE */}
        <div className="flex-1 w-full overflow-y-auto bg-bg flex flex-col relative no-scrollbar">
          <div className="w-full max-w-[840px] mx-auto px-6 sm:px-12 pt-10 pb-32 flex-1 flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-[#8a94a6] flex items-center gap-2">
                    <span className="text-signal text-[12px] leading-none mb-[2px]">♦</span> ATA {currentQ.ata}
                  </span>
                  <button 
                    onClick={() => toggleBookmark(currentQ)}
                    className={`p-1.5 rounded transition-colors ${isBookmarked ? 'text-signal' : 'text-[#8a94a6] hover:text-ink'}`}
                  >
                    <Bookmark size={15} strokeWidth={1.5} fill={isBookmarked ? "currentColor" : "none"} />
                  </button>
                </div>
                
                <h2 className="font-serif text-[30px] md:text-[38px] text-[#f5f2ea] leading-tight tracking-tight mb-10 pb-4 border-b border-rule/30">
                  {currentQ.prompt}
                </h2>

                {currentQ.diagramCaption && (
                  <div className="w-full mt-2 mb-10 rounded-xl overflow-hidden relative border border-rule/50 bg-[#11223b]/50 isolate">
                    <div className="flex items-center justify-between p-3 border-b border-rule/30 bg-[#0d1a2d]/80">
                       <span className="font-mono text-[9px] uppercase tracking-widest text-[#f5f2ea]/40">
                          FIG. {currentQ.ata.split('·')[0].trim().replace(' ', '-')}
                       </span>
                    </div>
                    {/* The FlightControlsDiagram handles dark mode if --paper/--ink tokens are bound, but for this component we enforce dark panel styling via parent css variables (already injected by .dark on root) */}
                    <div className="p-6">
                      <FlightControlsDiagram />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQ.choices.map((choice, i) => {
                    const charLabel = ['A','B','C','D'][i];
                    const isSelected = selectedOptionId === choice.id;
                    
                    let containerClass = "bg-[#11223b]/30 border-rule/50 hover:bg-[#11223b] cursor-pointer text-[#f5f2ea]";
                    if (isSelected) {
                      containerClass = "bg-[#1e3a5f] border-[#f5f2ea]/50 ring-2 ring-inset ring-[#f5f2ea]/40 shadow-[0_0_20px_rgba(245,242,234,0.08)]";
                    }

                    return (
                      <motion.div
                        role="button"
                        tabIndex={0}
                        aria-label={`Choice ${charLabel}: ${choice.label}`}
                        aria-pressed={isSelected}
                        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                        key={choice.id}
                        whileTap={{ scale: 0.99 }}
                        animate={isSelected ? { scale: [1, 1.01, 1] } : {}}
                        transition={{ duration: 0.25 }}
                        onClick={() => handleSelectOption(choice.id)}
                        className={`p-6 rounded-xl border flex items-center gap-5 outline-none transition-all duration-200 ${containerClass}`}
                      >
                        <div className={`w-[34px] h-[34px] rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-[#f5f2ea]/70 bg-[#f5f2ea]/15 text-ink' : 'border-rule/50 text-[#8a94a6]'}`}>
                          <span className="font-mono text-[13px] font-medium mt-px">{charLabel}</span>
                        </div>
                        <span className="font-sans font-medium text-[14px] md:text-[15px] leading-snug">{choice.label}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT RAIL (GAUGES) */}
        <div className="hidden lg:flex w-28 xl:w-32 border-l border-rule shrink-0 flex-col py-10 px-4 items-center justify-start bg-bg">
           
           <div className="flex flex-col items-center justify-center w-full mt-4">
             <span className="font-mono text-[9px] text-[#8a94a6] tracking-[0.2em] uppercase mb-3">ACCURACY</span>
             <span className="font-serif text-[26px] text-[#f5f2ea] leading-none mb-[2px]">
                {accuracy}%
             </span>
             <div className="w-full h-px bg-rule mt-5" />
           </div>
           
           <div className="flex flex-col items-center justify-center w-full mt-10">
             <span className="font-mono text-[9px] text-[#8a94a6] tracking-[0.2em] uppercase mb-4">PACE</span>
             <div className="w-[50px] h-[50px] rounded-full border border-rule/50 flex items-center justify-center relative">
                <svg width="50" height="50" className="absolute top-0 left-0 -rotate-90">
                  <circle cx="25" cy="25" r="23" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber/80" strokeDasharray="144.5" strokeDashoffset={144.5 * (1 - (pace / 100))} strokeLinecap="round" />
                </svg>
                <span className="font-serif text-[18px] text-[#f5f2ea] leading-none">{pace}<span className="text-[14px]">%</span></span>
             </div>
             <div className="w-full h-px bg-rule mt-10" />
           </div>

           <div className="flex flex-col items-center justify-center w-full mt-10">
             <span className="font-mono text-[9px] text-[#8a94a6] tracking-[0.2em] uppercase mb-3">HDG</span>
             <span className="font-serif text-[26px] text-[#f5f2ea] leading-none mb-[2px]">030°</span>
           </div>
           
        </div>
      </div>

      {/* FOOTER */}
      <footer className="h-[calc(80px+var(--sab))] pb-[var(--sab)] border-t border-rule bg-bg shrink-0 px-4 md:px-8 flex items-center justify-between z-40 relative">
         <Button 
            variant="ghost" 
            onClick={handlePrev}
            className={`h-[42px] px-6 rounded-full border border-rule text-[#f5f2ea]/70 hover:bg-rule hidden sm:flex font-mono text-[11px] tracking-widest uppercase transition-colors ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}
         >
            <ArrowLeft size={16} className="mr-2" strokeWidth={1.5} /> PREV
         </Button>

         <Button 
            variant="ghost" 
            onClick={handlePrev}
            className={`w-[42px] h-[42px] rounded-full border border-rule text-[#f5f2ea]/70 hover:bg-rule flex sm:hidden justify-center items-center ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}
         >
            <ArrowLeft size={16} strokeWidth={1.5} />
         </Button>

         <div className="flex items-center gap-3 ml-auto">
            <Button 
              variant="ghost" 
              onClick={handleNext}
              className="h-[42px] px-6 rounded-full border border-transparent text-[#f5f2ea]/50 hover:bg-rule hover:text-[#f5f2ea] uppercase tracking-widest font-mono text-[11px] transition-colors"
            >
              SKIP
            </Button>
            <Button
              variant="ghost"
              onClick={handleNext}
              className="h-[42px] px-6 border border-rule text-bg bg-[#f5f2ea] hover:bg-[#ebe7dc] rounded-full uppercase tracking-[0.15em] font-mono text-[11px] font-semibold flex items-center transition-colors"
            >
              {currentIndex === totalQuestions - 1 ? 'COMPLETE' : (answers[currentQ.id] ? 'NEXT' : 'CONFIRM')} <ArrowRight size={16} className="ml-2" strokeWidth={2} />
            </Button>
         </div>
      </footer>
    </div>
  );
}
