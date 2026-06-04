import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, CheckCircle2, Bookmark, X } from "lucide-react";
import { Button, Wordmark } from "../../components/Atoms";
import { QuizLayoutProps } from "./types";
import { useEffect, useRef } from "react";

export default function FlashcardLayout({
  currentQ,
  currentIndex,
  totalQuestions,
  isRevealedViva,
  isBookmarked,
  timeElapsed,
  formatTime,
  handleRevealViva,
  handleVivaKnew,
  handleVivaDidntKnow,
  handleNext,
  handlePrev,
  toggleBookmark,
  setShowAbortPrompt,
  showAbortPrompt,
  storageKey,
  customQuestions,
  navigate
}: QuizLayoutProps) {
  
  // Focus the card on mount or when question changes to enable keyboard shortcut right away
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, [currentIndex]);

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-bg">
      {/* MINIMAL TOP BAR */}
      <header className="h-[calc(72px+var(--sat))] pt-[var(--sat)] px-4 md:px-8 flex items-center justify-between shrink-0 z-40 bg-bg relative">
        <div className="flex items-center gap-4 w-1/3">
          <Wordmark compassSize={18} className="text-ink hidden sm:flex" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8a94a6]">
            Heading <span className="mx-1 text-rule">·</span> {customQuestions ? 'CUSTOM' : 'FL'} <span className="mx-1 text-rule">·</span> 380
          </span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 justify-center text-[#8a94a6] w-auto whitespace-nowrap">
          <span className="font-mono text-[10px] tracking-widest uppercase opacity-70">
            {currentIndex + 1} / {totalQuestions}
          </span>
          <div className="w-16 md:w-28 h-1 bg-rule rounded-full relative overflow-hidden">
             <div className="absolute top-0 left-0 h-full bg-ink rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }} />
          </div>
          <div className="font-mono text-[10px] tracking-[0.1em] text-ink">
            {formatTime(timeElapsed)}
          </div>
        </div>

        <div className="flex items-center justify-end w-1/3">
          <Button 
            variant="ghost"
            onClick={() => setShowAbortPrompt(true)}
            className="h-8 px-3 flex items-center gap-1.5 text-[10px] md:text-[11px] font-mono border border-rule rounded-full bg-transparent hover:bg-bg-2 uppercase tracking-widest text-ink transition-colors"
          >
            Exit <X size={14} strokeWidth={1.5} className="mt-[-1px]" />
          </Button>
        </div>
      </header>

      {/* CENTER FLOATING CARD */}
      <main className="flex-1 w-full mx-auto px-4 py-8 flex flex-col justify-center relative z-10 overflow-y-auto no-scrollbar pb-16">
         <div className="w-full max-w-[660px] mx-auto flex flex-col items-stretch">
           <AnimatePresence mode="wait">
             <motion.div
               ref={cardRef}
               key={currentQ.id}
               initial={{ opacity: 0, y: 10, scale: 0.98 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: -10, scale: 0.98 }}
               transition={{ duration: 0.3, ease: "easeOut" }}
               className="bg-paper border border-rule rounded-[24px] p-6 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full outline-none focus-visible:ring-2 focus-visible:ring-ink/20 cursor-pointer"
               tabIndex={0}
               onClick={() => { if (!isRevealedViva) handleRevealViva(currentQ.id) }}
               onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                     e.preventDefault(); // prevent scroll
                     if (!isRevealedViva) handleRevealViva(currentQ.id);
                     else handleNext();
                  }
               }}
             >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-0 mb-6">
                   <span className="font-mono text-[10px] uppercase tracking-widest text-[#8a94a6] flex items-center gap-2 mt-1">
                      <span className="text-signal text-[12px] leading-none mb-[2px]">♦</span> ATA {currentQ.ata}
                   </span>
                   <span className="font-mono text-[9px] uppercase tracking-widest text-[#8a94a6]/60">
                      FORM · {currentQ.ata.split('·')[0].trim().replace(/\s/g, '-')} · REV {(currentIndex + 1).toString().padStart(2, '0')}
                   </span>
                </div>

                <h2 className="font-serif text-[26px] sm:text-[28px] md:text-[30px] text-ink leading-[1.15] tracking-tight mb-8 pb-8 border-b border-rule/50">
                  {currentQ.prompt}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentQ.choices.map((choice, i) => {
                     const charLabel = ['A','B','C','D'][i];
                     const isCorrect = choice.id === currentQ.correct;

                     let containerClass = "bg-transparent border-rule text-ink-2";
                     let circleClass = "border-rule text-muted";

                     if (isRevealedViva && isCorrect) {
                        containerClass = "bg-mint-soft border-mint text-ink ring-1 ring-mint shadow-sm";
                        circleClass = "bg-mint border-mint text-paper";
                     } else if (isRevealedViva && !isCorrect) {
                        containerClass = "bg-transparent border-rule/40 text-[#8a94a6] opacity-60";
                     }

                     return (
                       <div key={choice.id} className={`p-5 rounded-[16px] border flex gap-4 transition-all duration-300 ${containerClass}`}>
                          <div className={`w-[26px] h-[26px] shrink-0 rounded-full border flex items-center justify-center transition-colors duration-300 ${circleClass}`}>
                             {isRevealedViva && isCorrect ? <Check size={14} strokeWidth={2.5} /> : <span className="font-mono text-[10px] leading-none mt-[1px] font-medium">{charLabel}</span>}
                          </div>
                          <span className="font-sans text-[13px] leading-snug font-medium pt-[3px]">{choice.label}</span>
                       </div>
                     )
                  })}
                </div>
             </motion.div>
           </AnimatePresence>

           {/* FOOTER TOOLBAR */}
           <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-2 z-20">
             <Button
               variant="ghost"
               onClick={handlePrev}
               className={`w-11 h-11 rounded-full border border-rule text-[#8a94a6] hover:text-ink flex justify-center items-center bg-paper shadow-sm transition-colors shrink-0 ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}
               aria-label="Previous question"
             >
               <ArrowLeft size={18} strokeWidth={1.5} />
             </Button>

             <Button
               variant="ghost"
               onClick={() => toggleBookmark(currentQ)}
               aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this question"}
               className={`h-11 px-4 sm:px-5 rounded-full border bg-paper shadow-sm transition-colors text-[13px] font-medium font-sans flex items-center gap-2 ${isBookmarked ? 'border-transparent text-paper bg-signal hover:bg-signal-strong shadow-md' : 'border-rule text-ink hover:bg-bg-2'}`}
             >
               <Bookmark size={15} strokeWidth={isBookmarked ? 2.5 : 1.5} fill={isBookmarked ? "currentColor" : "none"} className={isBookmarked ? 'mb-px' : ''} /> Save
             </Button>

             {!isRevealedViva ? (
               <Button
                 variant="ghost"
                 onClick={() => handleRevealViva(currentQ.id)}
                 className="h-11 px-6 sm:px-8 rounded-full border border-transparent bg-ink hover:bg-ink-2 text-bg shadow-sm transition-colors text-[14px] font-medium font-sans flex items-center justify-center gap-2 flex-1 sm:min-w-[180px] sm:max-w-xs"
               >
                 Reveal answer →
               </Button>
             ) : handleVivaKnew ? (
               <>
                 <Button
                   variant="ghost"
                   onClick={() => handleVivaDidntKnow!(currentQ.id)}
                   className="h-11 px-5 sm:px-6 rounded-full border border-signal text-signal bg-paper hover:bg-signal-soft shadow-sm transition-colors text-[13px] font-medium font-sans flex items-center gap-1.5 flex-1 sm:max-w-[160px]"
                 >
                   Review again
                 </Button>
                 <Button
                   variant="ghost"
                   onClick={() => handleVivaKnew!(currentQ.id)}
                   className="h-11 px-6 sm:px-8 rounded-full border border-transparent bg-mint hover:bg-mint/80 text-bg shadow-sm transition-colors text-[14px] font-medium font-sans flex items-center justify-center gap-2 flex-1 sm:min-w-[160px] sm:max-w-xs"
                 >
                   <CheckCircle2 size={16} /> Got it
                 </Button>
               </>
             ) : (
               <Button
                 variant="ghost"
                 onClick={handleNext}
                 className="h-11 px-6 sm:px-8 rounded-full border border-transparent bg-ink hover:bg-ink-2 text-bg shadow-sm transition-colors text-[14px] font-medium font-sans flex items-center justify-center gap-2 flex-1 sm:min-w-[180px] sm:max-w-xs"
               >
                 {currentIndex === totalQuestions - 1 ? 'Complete →' : 'Next →'}
               </Button>
             )}

             <Button
               variant="ghost"
               onClick={handleNext}
               className="h-11 px-5 sm:px-6 rounded-full border border-rule bg-paper hover:bg-bg-2 text-ink shadow-sm transition-colors text-[13px] font-medium font-sans flex items-center"
             >
               Pass
             </Button>
           </div>
         </div>
      </main>
    </div>
  );
}

