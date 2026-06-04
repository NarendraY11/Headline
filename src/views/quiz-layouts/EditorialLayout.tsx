import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Bookmark, CheckCircle2, Clock, Flag, Sparkles, X, XCircle } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Wordmark } from "../../components/Atoms";
import ReportQuestionModal from "../../components/ReportQuestionModal";
import { FlightControlsDiagram } from "../../components/SystemDiagram";
import { QuizLayoutProps } from "./types";

export default function EditorialLayout({
  currentQ,
  currentIndex,
  totalQuestions,
  questions,
  mode,
  selectedOptionId,
  answers,
  submittedIds,
  revealedIds,
  isSubmittedPractice,
  isRevealedViva,
  isBookmarked,
  timeLeft,
  timeElapsed,
  formatTime,
  aiExplanations,
  isAiLoading,
  handleSelectOption,
  handleSubmitPractice,
  handleRevealViva,
  handleVivaKnew,
  handleVivaDidntKnow,
  handleNext,
  handlePrev,
  handleJump,
  toggleBookmark,
  handleExplainDeeper,
  setShowAbortPrompt,
  showAbortPrompt,
  storageKey,
  customQuestions,
  navigate,
  aiExplainEnabled
}: QuizLayoutProps) {
  const [isReportOpen, setIsReportOpen] = useState(false);
  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-bg">
      <AnimatePresence>
        {showAbortPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              role="dialog"
            aria-modal="true"
            aria-labelledby="abort-dialog-title"
            className="bg-panel border border-rule rounded-xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <h3 id="abort-dialog-title" className="font-serif text-2xl text-ink mb-2">Abort Session?</h3>
              <p className="font-sans text-sm text-ink-2 mb-6">
                Are you sure you want to exit? Your progress for this session will be lost.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" className="border border-signal text-signal hover:bg-signal-soft" onClick={() => {
                   setShowAbortPrompt(false);
                   localStorage.removeItem(storageKey);
                   navigate('/modules');
                }}>
                  Abort
                </Button>
                <Button variant="ghost" className="border border-rule text-ink" onClick={() => setShowAbortPrompt(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHARED TOP BAR */}
      <header className="h-auto min-h-[calc(64px+var(--sat))] pt-[var(--sat)] border-b border-rule bg-bg shrink-0 px-4 md:px-8 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-40 py-3 md:py-0">
        
        {/* MOBILE HEADER LAYOUT (md:hidden) */}
        <div className="flex flex-col gap-3 md:hidden w-full">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setShowAbortPrompt(true)}
                   className="p-1 -ml-1 text-ink"
                 >
                   <ArrowLeft size={20} strokeWidth={1.5} />
                 </button>
                 <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
                   Q {(currentIndex + 1)}/{(totalQuestions)}
                 </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink">
                 <Clock size={13} strokeWidth={1.5} /> 
                 {mode === "timed" && timeLeft !== null ? formatTime(timeLeft) : formatTime(timeElapsed)}
              </div>
           </div>
           <div>
              <Chip variant="solid" className="bg-ink text-bg font-mono tracking-widest text-[9px] uppercase max-w-full truncate inline-flex py-1 px-3">
                {currentQ.ata}
              </Chip>
           </div>
        </div>

        {/* DESKTOP HEADER LAYOUT (hidden md:flex) */}
        <div className="hidden md:flex items-center gap-4">
          <Wordmark compassSize={20} className="hidden sm:flex" />
          <div className="w-px h-6 bg-rule hidden sm:block"></div>
          <Chip variant="solid" className="bg-ink text-bg font-mono tracking-widest text-[10px] break-keep whitespace-nowrap uppercase py-1 px-3">
            {currentQ.ata}
          </Chip>
          {customQuestions && <Chip variant="solid" className="text-[9px] bg-mint text-bg py-1">AI SET</Chip>}
          <span className="font-mono text-[10px] text-muted-2 tracking-widest uppercase ml-1">
            TYPE RATING
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
            QUESTION {(currentIndex + 1).toString().padStart(3, '0')} / {totalQuestions.toString().padStart(2, '0')}
          </div>

          <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${mode === 'timed' && timeLeft !== null && timeLeft < 300 ? 'text-signal animate-pulse' : 'text-ink'}`}>
             <Clock size={13} strokeWidth={1.5} /> 
             {mode === "timed" && timeLeft !== null ? formatTime(timeLeft) : formatTime(timeElapsed)}
          </div>

          <button 
            onClick={() => toggleBookmark(currentQ)}
            className={`p-3 -m-1.5 transition-colors ${isBookmarked ? 'text-signal' : 'text-muted hover:text-ink'}`}
            title="Bookmark this interrogatory"
          >
            <Bookmark size={15} strokeWidth={1.5} fill={isBookmarked ? "currentColor" : "none"} />
          </button>

          <Button 
            variant="ghost"
            onClick={() => setShowAbortPrompt(true)}
            className="h-7 px-3 flex items-center gap-1.5 text-[10px] font-sans text-ink border border-rule rounded-full bg-transparent hover:bg-bg-2"
          >
            Exit <X size={12} strokeWidth={2} />
          </Button>
        </div>
      </header>

      {/* Main Single Column Layout */}
      <main className="flex-1 w-full max-w-[760px] mx-auto px-4 pt-6 pb-24 flex flex-col relative z-10">
        
         {/* Progress Dot Bar */}
        <div className="flex items-center gap-3 w-full mb-10">
          <div className="relative flex-1 min-w-0">
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-bg to-transparent pointer-events-none z-10" />
          <div className="flex items-center justify-start gap-2 overflow-x-auto pb-1 overflow-y-hidden pr-6">
            {questions.map((q, idx) => {
              let dotClass = "bg-rule w-2 h-2"; // upcoming / default

              if (idx === currentIndex) {
                dotClass = "bg-ink w-2.5 h-2.5"; // current
              } else if (mode === 'practice' && submittedIds.has(q.id)) {
                const isCorrect = answers[q.id] === q.correct;
                dotClass = isCorrect ? "bg-mint w-2.5 h-2.5" : "bg-signal w-2.5 h-2.5";
              } else if (mode === 'timed' && answers[q.id]) {
                dotClass = "bg-sky w-2.5 h-2.5";
              } else if (mode === 'viva' && revealedIds.has(q.id)) {
                dotClass = "bg-mint w-2.5 h-2.5";
              }

              return (
                <motion.button
                  key={q.id}
                  layout
                  initial={false}
                  animate={{ scale: idx === currentIndex ? 1.2 : 1 }}
                  onClick={() => handleJump(idx)}
                  aria-label={`Question ${idx + 1}${idx === currentIndex ? ', current' : ''}`}
                  className={`rounded-full transition-colors duration-300 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${dotClass}`}
                />
              );
            })}
          </div>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 shrink-0 tabular-nums">
            {currentIndex + 1}/{totalQuestions}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full flex-1 flex flex-col"
          >
            {/* Question Area */}
            <div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} 
              className={`mb-8 ${mode === "viva" && !isRevealedViva ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => {
                 if (mode === "viva" && !isRevealedViva) {
                    handleRevealViva(currentQ.id);
                 }
              }}
            >
              <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-muted-2 mb-4 flex items-center gap-2">
                <span className="text-signal text-[12px] leading-none mb-[2px]">♦</span> Q {currentIndex + 1} · {currentQ.ata}
              </span>
              <h2 className="font-serif text-[32px] md:text-[38px] text-ink leading-tight tracking-tight">
                {currentQ.prompt}
              </h2>
              {mode === "viva" && !isRevealedViva && (
                <div className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-2 flex items-center gap-2">
                  Tap anywhere to reveal model answer
                </div>
              )}
            </div>

            {/* Optional Diagram Placeholder */}
            {currentQ.diagramCaption && (
              <div className="w-full mt-4 mb-10 border border-rule rounded-xl overflow-hidden relative" style={{ 
                background: 'var(--bg)', 
                backgroundImage: 'linear-gradient(var(--rule) 1px, transparent 1px), linear-gradient(90deg, var(--rule) 1px, transparent 1px)', 
                backgroundSize: '40px 40px',
                backgroundPosition: '19px 19px'
              }}>
                 <div className="w-full h-56 flex items-center justify-center backdrop-blur-[1px]">
                   <FlightControlsDiagram />
                 </div>
                 <div className="absolute bottom-0 right-0 font-mono text-[9px] uppercase tracking-widest text-muted-2 bg-bg border-t border-l border-rule px-3 py-1.5 rounded-tl-lg">
                   {currentQ.diagramCaption}
                 </div>
              </div>
            )}

            {/* Choices Area */}
            <motion.div 
              className="space-y-3 flex-1 mb-8"
              variants={{
                show: { transition: { staggerChildren: 0.04 } }
              }}
              initial="hidden"
              animate="show"
            >
              {mode === "viva" ? (
                 // VIVA MODE
                 !isRevealedViva ? (
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} 
                      className="h-40 flex items-center justify-center border-2 border-rule border-dashed rounded-xl bg-panel cursor-pointer hover:border-ink transition-colors"
                      onClick={() => handleRevealViva(currentQ.id)}
                    >
                      <Button variant="ghost" className="pointer-events-none">
                        Reveal Model Answer
                      </Button>
                    </div>
                 ) : (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="p-6 rounded-xl border bg-mint-soft border-mint text-mint flex items-start gap-4"
                    >
                       <div className="w-8 h-8 rounded-full border border-mint flex items-center justify-center shrink-0 mt-0.5">
                         <CheckCircle2 size={18} />
                       </div>
                       <span className="font-sans text-lg font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>
                         {currentQ.choices.find(c => c.id === currentQ.correct)?.label}
                       </span>
                    </motion.div>
                 )
              ) : (
                 // PRACTICE & TIMED MODE
                 currentQ.choices.map((choice, i) => {
                   const charLabel = ['A','B','C','D'][i];
                   const isSelected = selectedOptionId === choice.id;
                   const isCorrect = choice.id === currentQ.correct;
                   
                   let containerClass = "bg-paper border-rule hover:border-rule-strong cursor-pointer text-ink";
                   let iconMarkup = <span className="text-muted font-mono text-xs font-medium">{charLabel}</span>;
                   let isClickable = true;
                   
                   let animateProps = {};

                   if (mode === "practice" && isSubmittedPractice) {
                     isClickable = false;
                     if (isCorrect) {
                       containerClass = "bg-mint-soft border-mint text-mint z-10 relative";
                       iconMarkup = <CheckCircle2 size={18} />;
                       animateProps = { scale: [1, 1.03, 1], transition: { duration: 0.4, ease: "easeInOut" } };
                     } else if (isSelected && !isCorrect) {
                       containerClass = "bg-signal-soft border-signal text-signal opacity-100 z-10 relative";
                       iconMarkup = <XCircle size={18} />;
                       animateProps = { x: [0, -5, 5, -5, 5, 0], transition: { duration: 0.4 } };
                     } else {
                       containerClass = "bg-transparent border-rule opacity-60";
                     }
                   } else if (isSelected) {
                     containerClass = "bg-ink/[0.06] border-ink shadow-sm ring-2 ring-ink ring-offset-1";
                     animateProps = { scale: 1.01 };
                   }

                   return (
                     <motion.div
                       key={choice.id}
                       variants={{
                         hidden: { opacity: 0, y: 10 },
                         show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                       }}
                       animate={Object.keys(animateProps).length > 0 ? animateProps : "show"}
                       whileTap={isClickable ? { scale: 0.98 } : {}}
                       onClick={() => isClickable && handleSelectOption(choice.id)}
                       tabIndex={isClickable ? 0 : -1}
                       onKeyDown={(e) => {
                         if (isClickable && (e.key === "Enter" || e.key === " ")) {
                           e.preventDefault();
                           handleSelectOption(choice.id);
                         }
                       }}
                       aria-label={`Choice ${charLabel}: ${choice.label}`}
                       aria-pressed={isSelected}
                       className={`p-5 rounded-xl border flex items-center gap-5 outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:border-ink/30 transition-shadow ${containerClass}`}
                     >
                       <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center shrink-0 bg-paper transition-colors">
                         {iconMarkup}
                       </div>
                       <span className="font-sans font-medium text-sm md:text-base leading-snug">{choice.label}</span>
                     </motion.div>
                   );
                 })
              )}
            </motion.div>

            {/* Explanation Panel (Animates in) */}
            <AnimatePresence>
              {((isSubmittedPractice && mode === "practice") || (isRevealedViva && mode === "viva")) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="mb-8 border-l-4 border-mint flex flex-col lg:flex-row shadow-sm bg-panel rounded-r-xl overflow-hidden overflow-y-hidden"
                >
                   <div className="p-6 md:p-8 flex-1">
                     <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase mb-4 block">MODEL RATIONALE</span>
                     <p className="font-sans text-[15px] md:text-[16px] text-ink leading-relaxed mb-6">
                        {currentQ.explanation}
                     </p>
                     <div className="flex flex-wrap gap-2.5 items-center">
                       {currentQ.references.map((ref, idx) => (
                          <Chip key={idx} variant="default" className="text-[10px] text-muted-2 tracking-widest">{ref}</Chip>
                       ))}
                       <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide border-t sm:border-t-0 sm:border-l border-rule pt-1.5 sm:pt-0 sm:pl-2.5 sm:ml-0.5 block sm:inline">
                         IP compliant · Verified from DGCA/ICAO/FAA public files
                       </span>
                     </div>
                     <div className="mt-5 pt-4 border-t border-rule/30 flex items-center justify-between">
                       <button 
                         onClick={() => setIsReportOpen(true)}
                         className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted hover:text-signal transition-colors outline-none cursor-pointer"
                       >
                         <Flag size={11} className="text-muted-2" /> Report an issue with this question
                       </button>
                     </div>
                   </div>
                   
                   {/* AI Expansion Area */}
                   {aiExplainEnabled && (
                   <div className="bg-paper p-6 md:p-8 flex-1 border-t lg:border-t-0 lg:border-l border-rule flex flex-col h-auto">
                     <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-[10px] uppercase text-ink font-semibold flex items-center gap-2">
                           <Sparkles size={14} className="text-mint" /> 
                           Ask the Instructor
                        </span>
                        <Chip variant="solid" className="text-[9px] bg-ink text-bg">AI</Chip>
                     </div>
                     
                     {!aiExplanations[currentQ.id] && !isAiLoading ? (
                       <div className="mt-auto flex flex-col gap-4">
                         <p className="font-sans text-sm text-ink-2 leading-relaxed">
                           Need more details? Get a precise technical breakdown from our AI Chief Ground Instructor.
                         </p>
                         <Button variant="ghost" className="w-fit border border-rule hover:bg-bg-2" onClick={handleExplainDeeper}>
                           Explain it differently / I still don't get it
                         </Button>
                       </div>
                     ) : isAiLoading && !aiExplanations[currentQ.id] ? (
                       <div className="mt-4 space-y-3 animate-pulse">
                         <div className="h-4 bg-rule/50 rounded w-full"></div>
                         <div className="h-4 bg-rule/50 rounded w-11/12"></div>
                         <div className="h-4 bg-rule/50 rounded w-4/5"></div>
                         <div className="h-4 bg-rule/50 rounded w-9/12"></div>
                       </div>
                     ) : (
                       <motion.div 
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         className="mt-2 font-sans text-sm text-ink-2 leading-relaxed whitespace-pre-wrap"
                       >
                         {aiExplanations[currentQ.id]}
                         {isAiLoading && <span className="animate-pulse inline-block ml-1">▋</span>}
                       </motion.div>
                     )}
                   </div>
                   )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Responsive Bottom Navigation Controls */}
        <div className="sticky bottom-0 bg-bg mt-auto z-30 flex flex-col">
          {/* Mobile Action Bar */}
          <div className="md:hidden pb-[calc(1rem+var(--sab))] pt-3 border-t border-rule flex items-center gap-3">
             <button
               onClick={() => toggleBookmark(currentQ)}
               aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this question"}
               className={`rounded-full border transition-colors shrink-0 flex items-center justify-center ${isBookmarked ? 'bg-signal-soft border-signal text-signal' : 'bg-transparent border-rule text-muted'}`}
               style={{ width: "48px", height: "48px" }}
             >
               <Bookmark size={18} strokeWidth={2} fill={isBookmarked ? "currentColor" : "none"} />
             </button>

             <div className="flex-1">
                {mode === "practice" && !isSubmittedPractice ? (
                   <Button
                     variant="primary"
                     onClick={handleSubmitPractice}
                     disabled={!selectedOptionId}
                     title={!selectedOptionId ? "Select an answer first" : undefined}
                     className={`w-full h-[48px] bg-ink text-bg rounded-[24px] text-[15px] font-medium flex items-center justify-center border-0 ${!selectedOptionId ? 'opacity-40 cursor-not-allowed' : ''}`}
                   >
                     Submit answer <ArrowRight size={18} className="ml-2" />
                   </Button>
                ) : mode === "viva" && !isRevealedViva ? (
                   <Button
                     variant="primary"
                     onClick={() => handleRevealViva(currentQ.id)}
                     className="w-full h-[48px] bg-ink text-bg rounded-[24px] text-[15px] font-medium flex items-center justify-center border-0"
                   >
                     Reveal answer <ArrowRight size={18} className="ml-2" />
                   </Button>
                ) : mode === "viva" && isRevealedViva && handleVivaKnew ? (
                   <div className="flex gap-2 w-full">
                     <Button
                       variant="primary"
                       onClick={() => handleVivaKnew!(currentQ.id)}
                       className="flex-1 h-[48px] bg-mint text-bg rounded-[24px] text-[14px] font-medium flex items-center justify-center border-0 gap-1.5"
                     >
                       <CheckCircle2 size={16} /> Got it
                     </Button>
                     <Button
                       variant="ghost"
                       onClick={() => handleVivaDidntKnow!(currentQ.id)}
                       className="flex-1 h-[48px] border border-signal text-signal rounded-[24px] text-[14px] font-medium flex items-center justify-center gap-1.5"
                     >
                       Review again
                     </Button>
                   </div>
                ) : mode === "timed" && !answers[currentQ.id] ? (
                   <Button
                     variant="primary"
                     onClick={() => handleSelectOption(selectedOptionId!)}
                     disabled={!selectedOptionId}
                     title={!selectedOptionId ? "Select an answer first" : undefined}
                     className={`w-full h-[48px] bg-ink text-bg rounded-[24px] text-[15px] font-medium flex items-center justify-center border-0 ${!selectedOptionId ? 'opacity-40 cursor-not-allowed' : ''}`}
                   >
                     Confirm <ArrowRight size={18} className="ml-2" />
                   </Button>
                ) : (
                   <Button
                     variant="primary"
                     className="w-full h-[48px] bg-ink text-bg rounded-[24px] text-[15px] font-medium flex items-center justify-center border-0"
                     onClick={handleNext}
                   >
                     {currentIndex === totalQuestions - 1 ? 'Finish' : 'Next'} <ArrowRight size={18} className="ml-2" />
                   </Button>
                )}
             </div>
          </div>

          {/* Desktop Action Bar */}
          <div className="hidden md:flex pb-[calc(1.5rem+var(--sab))] pt-4 border-t border-rule items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={handlePrev}
              className={`h-9 px-4 text-[13px] transition-opacity ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
               <ArrowLeft size={16} className="mr-1.5" /> Previous
            </Button>

            <div className="flex items-center gap-3">
               {mode === "practice" && !isSubmittedPractice && (
                 <Button variant="ghost" className="h-9 px-4 text-[13px]" onClick={handleNext}>
                   Skip
                 </Button>
               )}

               {/* Contextual Action Button */}
               {mode === "practice" && !isSubmittedPractice ? (
                  <Button
                    variant="primary"
                    onClick={handleSubmitPractice}
                    disabled={!selectedOptionId}
                    title={!selectedOptionId ? "Select an answer first" : undefined}
                    className={`h-9 px-5 text-[13px] ${!selectedOptionId ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    Submit answer <ArrowRight size={16} className="ml-1.5" />
                  </Button>
               ) : mode === "viva" && !isRevealedViva ? (
                 <Button
                    variant="primary"
                    onClick={() => handleRevealViva(currentQ.id)}
                    className="h-9 px-5 text-[13px]"
                  >
                    Reveal answer <ArrowRight size={16} className="ml-1.5" />
                  </Button>
               ) : mode === "viva" && isRevealedViva && handleVivaKnew ? (
                 <>
                   <Button
                     variant="ghost"
                     onClick={() => handleVivaDidntKnow!(currentQ.id)}
                     className="h-9 px-4 text-[13px] border border-signal text-signal hover:bg-signal-soft"
                   >
                     Review again
                   </Button>
                   <Button
                     variant="primary"
                     onClick={() => handleVivaKnew!(currentQ.id)}
                     className="h-9 px-5 text-[13px] bg-mint border-0 text-bg hover:bg-mint/80 flex items-center gap-1.5"
                   >
                     <CheckCircle2 size={15} /> Got it
                   </Button>
                 </>
               ) : mode === "timed" && !answers[currentQ.id] ? (
                 <Button
                    variant="primary"
                    onClick={() => handleSelectOption(selectedOptionId!)}
                    disabled={!selectedOptionId}
                    title={!selectedOptionId ? "Select an answer first" : undefined}
                    className={`h-9 px-5 text-[13px] ${!selectedOptionId ? 'opacity-40 cursor-not-allowed' : ''}`}
                 >
                    Confirm <ArrowRight size={16} className="ml-1.5" />
                 </Button>
               ) : (
                  <Button variant="primary" className="h-9 px-5 text-[13px]" onClick={handleNext}>
                    {currentIndex === totalQuestions - 1 ? 'Finish' : 'Next'} <ArrowRight size={16} className="ml-1.5" />
                  </Button>
               )}
            </div>
          </div>
        </div>
      </main>
      <ReportQuestionModal questionId={currentQ.id} isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
