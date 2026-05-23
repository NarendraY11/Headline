import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Wordmark } from "../components/Atoms";
import { Check, MoveRight, MoveLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const stepsData = [
  {
    id: 1,
    title: "Where are you headed?",
    accent: "headed?",
    subtitle: "Select your primary goal to help us personalize your telemetry and module difficulty.",
    stepName: "GOAL"
  },
  {
    id: 2,
    title: "What are you flying towards?",
    accent: "towards?",
    subtitle: "We'll build your study plan around the exact paper, type, and date you tell us. You can change any of this later.",
    stepName: "EXAM"
  },
  {
    id: 3,
    title: "When's the checkride?",
    accent: "checkride?",
    subtitle: "Tell us when your exam is scheduled, or give us a rough estimate. We'll adjust your daily study queue accordingly.",
    stepName: "DATE"
  },
  {
    id: 4,
    title: "Your flight plan is ready.",
    accent: "ready.",
    subtitle: "We've configured your study queue and mock templates based on your target check.",
    stepName: "PLAN"
  }
];

const goals = [
  { id: 'cadet', title: 'Student Pilot / Cadet', desc: 'Preparing for initial ground school tests.' },
  { id: 'type-rating', title: 'A320 Type Rating', desc: 'Transitioning to the Airbus A320 family.' },
  { id: 'recurrent', title: 'Line Crew / Recurrent', desc: 'Brushing up for annual assessments.' },
  { id: 'exploring', title: 'Just exploring', desc: 'Looking around the question bank.' }
];

function Step1Goal({ goal, setGoal }: { goal: string, setGoal: (v: string) => void }) {
  return (
    <div>
      <div className="space-y-4">
        {goals.map(g => (
          <button 
             key={g.id} 
             onClick={() => setGoal(g.id)}
             className={`w-full text-left p-6 border rounded-[16px] transition-all flex items-center ${goal === g.id ? 'border-ink ring-1 ring-ink bg-bg-2 shadow-sm' : 'border-rule hover:border-ink/30 bg-bg'}`}
          >
             <div className="flex-1">
               <div className="font-serif text-[20px] text-ink mb-1">{g.title}</div>
               <div className="font-sans text-[14px] text-muted">{g.desc}</div>
             </div>
             <div className={`w-[24px] h-[24px] rounded-full border flex items-center justify-center shrink-0 ml-4 transition-colors ${goal === g.id ? 'border-ink bg-ink text-bg' : 'border-rule'}`}>
                {goal === g.id && <Check size={14} />}
             </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const exams = [
  { id: 'dgca-cpl', cat: 'DGCA · CPL', title: 'Commercial Pilot License — Paper I & II', desc: 'India · Para 4' },
  { id: 'easa-atpl', cat: 'EASA · ATPL', title: 'Airline Transport Pilot License (14 papers)', desc: 'EU · CB-IR-2024' },
  { id: 'a320-type', cat: 'A320 TYPE', title: 'Airbus A320 Family · Initial Type Rating', desc: 'CFM56 / IAE V2500' },
  { id: 'ir-renewal', cat: 'IR · RENEWAL', title: 'Instrument Rating · Renewal & Revalidation', desc: 'Annual' }
];

function Step2Exam({ exam, setExam }: { exam: string, setExam: (v: string) => void }) {
  return (
    <div>
      <div className="space-y-4">
        {exams.map(e => {
          const isSel = exam === e.id;
          return (
            <button 
               key={e.id}
               onClick={() => setExam(e.id)}
               className={`w-full text-left p-6 border rounded-[16px] transition-all flex items-center ${isSel ? 'border-ink ring-1 ring-ink bg-bg-2 shadow-sm' : 'border-rule bg-bg hover:border-ink/30'}`}
            >
               <div className="flex-1">
                 <div className={`inline-block mb-3 px-2 py-1 rounded-[4px] font-mono text-[9px] tracking-widest font-semibold uppercase ${isSel ? 'bg-ink text-bg' : 'bg-rule text-muted-2'}`}>
                   {e.cat}
                 </div>
                 <div className="font-serif text-[18px] md:text-[20px] text-ink mb-1">{e.title}</div>
                 <div className="font-sans text-[14px] text-muted">{e.desc}</div>
               </div>
               
               <div className={`w-[24px] h-[24px] rounded-full border flex items-center justify-center shrink-0 ml-4 transition-colors ${isSel ? 'border-ink bg-ink text-bg' : 'border-rule'}`}>
                  {isSel && <Check size={14} />}
               </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const datePresets = [
  { id: '1-month', label: '1 Month' },
  { id: '3-months', label: '3 Months' },
  { id: '6-months', label: '6 Months' },
  { id: 'not-sure', label: 'Not sure yet' }
];

function Step3Date({ date, setDate }: { date: string, setDate: (v: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {datePresets.map(d => (
           <button
             key={d.id}
             onClick={() => setDate(d.id)}
             className={`p-5 border rounded-[16px] font-sans font-medium text-[15px] transition-all text-center ${date === d.id ? 'border-ink ring-1 ring-ink bg-ink text-bg shadow-sm' : 'border-rule bg-bg text-ink hover:bg-bg-2 hover:border-ink/30'}`}
           >
             {d.label}
           </button>
        ))}
      </div>
      
      <div className="relative mb-8">
         <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-rule" /></div>
         <div className="relative flex justify-center"><span className="bg-paper px-4 font-mono text-[10px] text-muted tracking-widest uppercase">OR SELECT DATE</span></div>
      </div>
      
      <div>
        <input 
          type="date"
          value={date.includes('-') && date.split('-').length === 3 ? date : ''}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-14 bg-bg border border-rule rounded-[16px] px-5 font-sans text-ink focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink transition-all"
        />
      </div>
    </div>
  )
}

function Step4Plan({ goal, exam, date }: { goal: string, exam: string, date: string }) {
  return (
    <div>
      <div className="bg-bg border border-rule rounded-[16px] p-8 space-y-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-rule pb-6">
           <span className="font-sans text-[15px] text-muted">Primary Goal</span>
           <span className="font-sans font-medium text-ink">{goal ? goals.find(g => g.id === goal)?.title : 'Not set'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-rule pb-6">
           <span className="font-sans text-[15px] text-muted">Target Exam</span>
           <span className="font-sans font-medium text-ink">{exam ? exams.find(e => e.id === exam)?.title : 'General Study'}</span>
        </div>
        <div className="flex justify-between items-center">
           <span className="font-sans text-[15px] text-muted">Timeline</span>
           <span className="font-sans font-medium text-ink">{datePresets.find(d => d.id === date)?.label || date || 'Flexible'}</span>
        </div>
      </div>
      
      <div className="mt-8 p-6 bg-navy/5 border border-navy/10 rounded-[16px] flex gap-5 items-start">
         <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center shrink-0">
           <Check size={18} className="text-paper" />
         </div>
         <div className="font-sans text-[15px] text-navy/90 flex-1 leading-relaxed mt-0.5">
           Your module dashboard has been customized. Mock templates and rule-of-the-air spacings are tuned to your target configuration.
         </div>
      </div>
    </div>
  );
}

export function OnboardingFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("");
  const [exam, setExam] = useState("");
  const [date, setDate] = useState("");
  const { updateUserData } = useAuth();
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      updateUserData({ targetExam: exam || goal || "general", targetDate: date });
      localStorage.setItem("heading_onboarding_completed", "true");
      onClose();
      navigate("/modules");
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSkip = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const currentStepData = stepsData[step - 1];

  return (
    <div className="fixed inset-0 z-[200] bg-bg flex flex-col md:flex-row overflow-hidden animate-[fadeIn_0.3s_ease-out]">
      {/* Left Pane (~45%) */}
      <div className="w-full h-auto md:h-full md:w-[45%] flex flex-col justify-between p-8 md:p-12 lg:p-16 relative bg-bg shrink-0 border-b md:border-b-0 border-rule">
        <div className="flex items-center gap-3 mb-10 md:mb-0">
          <Wordmark compassSize={20} />
          <span className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase border border-rule px-1.5 py-0.5 rounded-[4px] mt-0.5 opacity-80 border-opacity-50">FL · 380</span>
        </div>
        
        <div className="my-auto max-w-lg mb-8 md:mb-auto">
          <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
            PRE-FLIGHT · STEP {step} OF 4
          </div>
          
          <h1 className="font-serif text-[42px] md:text-[52px] lg:text-[64px] leading-[1.0] text-ink mb-6 tracking-tight">
            {currentStepData.title.split(" ").map((w, i) => 
              w.toLowerCase() === currentStepData.accent.toLowerCase()
              ? <span key={i} className="italic text-navy">{w} </span> 
              : <span key={i}>{w} </span>
            )}
          </h1>
          <p className="font-sans text-[16px] md:text-[18px] text-ink-2 font-light leading-relaxed max-w-md">
            {currentStepData.subtitle}
          </p>
        </div>

        <div className="hidden md:block font-mono text-[9px] text-muted tracking-[0.2em] uppercase">
          PRE-FLIGHT · 0{step} OF 04 · HEADING
        </div>
      </div>

      {/* Right Pane (~55%) */}
      <div className="w-full md:w-[55%] h-full bg-paper md:border-l border-rule flex flex-col overflow-hidden relative">
        <div className="px-8 md:px-16 lg:px-24 pt-12 md:pt-20 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32">
          {/* dots */}
          <div className="flex gap-2.5 mb-10">
            {[1,2,3,4].map(i => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === step ? 'bg-ink' : i < step ? 'bg-mint' : 'bg-rule'}`} />
            ))}
          </div>
          
          <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-1">
            0{step} / {currentStepData.stepName}
          </div>
          
          {/* Right pane content based on step */}
          <div className="flex-1 mt-6">
            <AnimatePresence mode="wait">
               <motion.div
                 key={step}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 transition={{ duration: 0.3 }}
                 className="w-full max-w-lg"
               >
                  {step === 1 && <Step1Goal goal={goal} setGoal={setGoal} />}
                  {step === 2 && <Step2Exam exam={exam} setExam={setExam} />}
                  {step === 3 && <Step3Date date={date} setDate={setDate} />}
                  {step === 4 && <Step4Plan goal={goal} exam={exam} date={date} />}
               </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer block */}
        <div className="px-8 md:px-16 lg:px-24 py-6 md:py-8 flex items-center justify-between border-t border-rule mt-auto shrink-0 sticky bottom-0 bg-paper/95 backdrop-blur-md z-10 w-full">
           {step > 1 ? (
              <button onClick={handleBack} className="h-[44px] px-5 flex items-center justify-center font-sans font-medium text-[14px] text-ink border border-rule rounded-full hover:bg-bg transition-colors">
                <MoveLeft size={16} className="mr-2" /> Back
              </button>
           ) : <div />}

           <div className="flex items-center gap-8">
              {step < 4 && (
                 <button onClick={handleSkip} className="font-mono text-[11px] text-muted font-medium hover:text-ink tracking-widest uppercase transition-colors">
                   SKIP
                 </button>
              )}
              <button 
                 onClick={handleNext} 
                 disabled={
                   (step === 1 && !goal) ||
                   (step === 2 && !exam) ||
                   (step === 3 && !date)
                 }
                 className="h-[44px] px-7 flex items-center justify-center font-sans font-medium text-[15px] bg-ink text-bg rounded-full hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {step === 4 ? "Finish" : "Continue"} <MoveRight size={16} className="ml-2" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
