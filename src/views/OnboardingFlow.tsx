import { ArrowRight, Check, Flame, Lock, MoveLeft, MoveRight, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";
import { TRAINING_PATHS, resolveTargetExam } from "../data/trainingPaths";
import { trackEvent } from "../lib/track";

const stepsData = [
  {
    id: 1,
    title: "What are you flying towards?",
    accent: "towards?",
    subtitle: "Select your target exam and flight clearance authority to personalize your telemetry.",
    stepName: "EXAM"
  },
  {
    id: 2,
    title: "Plot your flight intensity.",
    accent: "intensity.",
    subtitle: "Configure your daily study pace and exam target date. Warm up gently or push standard training.",
    stepName: "PACING"
  },
  {
    id: 3,
    title: "Pre-flight system checks.",
    accent: "checks.",
    subtitle: "Complete a short 5-question mock diagnostic to calibrate your baseline telemetry.",
    stepName: "DIAGNOSTIC"
  },
  {
    id: 4,
    title: "Your flight plan is prepared.",
    accent: "prepared.",
    subtitle: "We've compiled your diagnostic results and fine-tuned your study pacing queue.",
    stepName: "DEBRIEF"
  }
];

const DIAG_QUESTIONS = [
  {
    subject: "Principles of Flight",
    question: "What is the primary operational effect of a cabin temperature inversion relative to standard pressure lapse rates?",
    options: [
      { key: "A", text: "Increases pressure thickness and decreases lift efficiency" },
      { key: "B", text: "Restricts vertical mixing, trapping air pollutants below and improving flight visibility above" },
      { key: "C", text: "Triggers automatic deployment of the Emergency Ram Air Turbine" },
      { key: "D", text: "Creates a negative altitude margin on standard barometric altimeters" }
    ],
    correct: "B",
    explanation: "Temperature inversions restrict vertical convective currents, trapping dust, smog, and moisture below the inversion layer, leading to exceptionally clean air and superior flight visibility above it."
  },
  {
    subject: "Airbus A320 Systems",
    question: "In Airbus A320 Flight Control Normal Law, what does releasing the sidestick to neutral command or maintain?",
    options: [
      { key: "A", text: "Maintains a fixed control surface deflection angle" },
      { key: "B", text: "Zero roll rate, constant 1g longitudinal load factor, and automatic pitch trim compensation" },
      { key: "C", text: "Discharges pneumatic emergency line values dynamically" },
      { key: "D", text: "Reverts immediately to Mechanical Backup with dampening default" }
    ],
    correct: "B",
    explanation: "In Normal Law, releasing the sidestick to neutral commands a zero roll rate in roll-control, and maintains a constant load factor (1g) with autopilot-like pitch auto-trim."
  },
  {
    subject: "Air Navigation",
    question: "If your magnetic heading is 090° (due East) and wind is coming from 180° (due South) at 30 knots, you are experiencing:",
    options: [
      { key: "A", text: "Direct headwind only" },
      { key: "B", text: "Starboard-side direct crosswind (causing leftwards drift)" },
      { key: "C", text: "Direct tailwind only" },
      { key: "D", text: "Port-side direct crosswind" }
    ],
    correct: "B",
    explanation: "A wind blowing from 180° is from the South. When heading 090° (due East), the wind hits from the right (starboard) side, pushing the plane leftwards."
  },
  {
    subject: "Meteorology",
    question: "What is the standard ISA temperature dry adiabatic lapse rate below the tropopause?",
    options: [
      { key: "A", text: "1.98°C (approx. 2°C) temperature decrease per 1,000 feet of altitude climb" },
      { key: "B", text: "3.50°C temperature increase per 1,000 feet of altitude climb" },
      { key: "C", text: "0.50°C temperature decrease per 1,000 feet of altitude climb" },
      { key: "D", text: "Absolute isothermal gradient regardless of elevation changes" }
    ],
    correct: "A",
    explanation: "Under ICAO standard atmospheres (ISA), temperature decreases at a steady rate of approximately 1.98°C per 1,000 feet (often taught as 2°C/1,000 ft) up to the tropopause."
  },
  {
    subject: "Air Law",
    question: "When climbing through standard transition altitude, what pressure setting MUST pilots transition to on their altimeter?",
    options: [
      { key: "A", text: "Local QNH corrected to mean sea level" },
      { key: "B", text: "Standard Pressure Setting of 1013.25 hPa (or 29.92 inHg)" },
      { key: "C", text: "QFE local airport station level pressure" },
      { key: "D", text: "Absolute vacuum datum gauge value" }
    ],
    correct: "B",
    explanation: "Passing above the transition altitude, all aircraft set 1013.2 hPa / 29.92 inHg as standard barometric reference to fly safely at Flight Levels (FL) rather than altitude heights."
  }
];

const intensityPresets = [
  { id: "10", label: "Warmup Journey", desc: "10 questions / day — Sustainable consistency", sub: "Perfect for busy line crew updating profiles." },
  { id: "25", label: "Active Aircrew", desc: "25 questions / day — Standard pacing", sub: "Designed for commercial preparation and type conversion." },
  { id: "50", label: "Full Throttle / Cadet", desc: "50 questions / day — Intense training", sub: "Rigorous flight-school focus for immediate checks." }
];

const datePresets = [
  { id: "1-month", label: "1 Month" },
  { id: "3-months", label: "3 Months" },
  { id: "6-months", label: "6 Months" },
  { id: "flexible", label: "Flexible Schedule" }
];

function Step1Exam({
  pathway,
  setPathway,
  goal,
  setGoal,
}: {
  pathway: string;
  setPathway: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
}) {
  const activePaths = TRAINING_PATHS.filter(p => p.status === "active");
  const comingSoon = TRAINING_PATHS.filter(p => p.status === "coming_soon");
  const selectedPath = TRAINING_PATHS.find(p => p.id === pathway);

  // ---- LEVEL 2: a pathway is chosen → pick a primary goal ----
  if (selectedPath) {
    const selectedGoal = selectedPath.goals.find(g => g.id === goal);
    return (
      <motion.div
        key="level2"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22 }}
        className="space-y-5"
      >
        <button
          type="button"
          onClick={() => { setPathway(""); setGoal(""); }}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors"
        >
          <MoveLeft size={13} /> {selectedPath.label}
        </button>

        <span className="block font-sans text-[11px] text-muted-2 font-bold uppercase tracking-wider">
          {selectedPath.goalPrompt}
        </span>

        <div role="radiogroup" aria-label={selectedPath.goalPrompt} className="space-y-3">
          {selectedPath.goals.map(g => {
            const isSel = goal === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={isSel}
                onClick={() => setGoal(g.id)}
                className={`w-full text-left p-4 sm:p-5 border rounded-[16px] transition-all flex items-center ${isSel ? 'border-ink ring-1 ring-ink bg-bg-2 shadow-sm' : 'border-rule bg-bg hover:border-ink/30'}`}
              >
                <span className="flex-1 font-serif text-[18px] text-ink">{g.label}</span>
                <span className={`w-[20px] h-[20px] rounded-full border flex items-center justify-center shrink-0 ml-4 transition-colors ${isSel ? 'border-ink bg-ink text-bg' : 'border-rule'}`}>
                  {isSel && <Check size={12} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Informational context panel — non-interactive */}
        {selectedGoal?.includes && selectedGoal.includes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            role="note"
            aria-label={`${selectedGoal.label} includes`}
            className="border border-rule rounded-[16px] p-4 bg-muted-soft/60"
          >
            <span className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 font-bold mb-3">
              {selectedGoal.label} · Includes
            </span>
            <ul className="space-y-2">
              {selectedGoal.includes.map(subj => (
                <li key={subj} className="flex items-center gap-2.5 font-sans text-[13px] text-ink-2">
                  <Check size={13} className="text-mint shrink-0" /> {subj}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ---- LEVEL 1: choose a training path ----
  return (
    <motion.div
      key="level1"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <div>
        <span className="block font-sans text-[11px] text-muted-2 font-bold uppercase tracking-wider mb-3">AVAILABLE NOW</span>
        <div role="radiogroup" aria-label="Training path" className="space-y-3">
          {activePaths.map(p => {
            const isSel = pathway === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={isSel}
                onClick={() => { setPathway(p.id); setGoal(""); }}
                className={`w-full text-left p-5 border rounded-[16px] transition-all flex items-center ${isSel ? 'border-ink ring-1 ring-ink bg-bg-2 shadow-sm' : 'border-rule bg-bg hover:border-ink/30'}`}
              >
                <div className="flex-1">
                  <div className="font-serif text-[18px] text-ink mb-1">{p.label}</div>
                  <div className="font-sans text-[12px] text-muted-2 leading-relaxed">{p.description}</div>
                </div>
                <MoveRight size={16} className="text-muted-2 shrink-0 ml-4" />
              </button>
            );
          })}
        </div>
      </div>

      {comingSoon.length > 0 && (
        <div>
          <span className="block font-sans text-[11px] text-muted-2 font-bold uppercase tracking-wider mb-3">COMING SOON</span>
          <div className="space-y-3">
            {comingSoon.map(p => (
              <div
                key={p.id}
                aria-disabled="true"
                aria-label={`${p.label} — coming soon`}
                title={p.tooltip}
                className="w-full text-left p-5 border border-rule rounded-[16px] flex items-center opacity-50 cursor-not-allowed select-none bg-bg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-serif text-[18px] text-ink">{p.label}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rule text-muted-2 font-mono text-[8px] tracking-widest font-bold uppercase">
                      <Lock size={8} /> Coming Soon
                    </span>
                  </div>
                  <div className="font-sans text-[12px] text-muted-2 leading-relaxed">{p.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Step2Pacing({ 
  dailyGoal, 
  setDailyGoal, 
  targetDatePreset, 
  setTargetDatePreset,
  customDate,
  setCustomDate
}: { 
  dailyGoal: string; 
  setDailyGoal: (v: string) => void;
  targetDatePreset: string;
  setTargetDatePreset: (v: string) => void;
  customDate: string;
  setCustomDate: (v: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <span className="block font-sans text-[11px] text-muted-2 font-bold uppercase tracking-wider mb-4">DAILY TRAINING DRILL INTENSITY</span>
        <div className="space-y-3">
          {intensityPresets.map(preset => {
            const isSel = dailyGoal === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setDailyGoal(preset.id)}
                className={`w-full text-left p-4 sm:p-5 border rounded-[16px] transition-all flex items-center ${isSel ? 'border-ink ring-1 ring-ink bg-bg-2' : 'border-rule bg-bg hover:border-ink/20'}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-serif text-lg font-medium text-ink">{preset.label}</span>
                    <span className="font-mono text-[10px] text-muted-2">• {preset.desc}</span>
                  </div>
                  <p className="font-sans text-xs text-muted leading-relaxed">{preset.sub}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-4 transition-colors ${isSel ? 'border-ink bg-ink text-bg' : 'border-rule'}`}>
                  {isSel && <Check size={11} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-rule pt-6">
        <span className="block font-sans text-[11px] text-muted-2 font-bold uppercase tracking-wider mb-4">TARGET EXAM TIMELINE</span>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {datePresets.map(preset => {
            const isSel = targetDatePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setTargetDatePreset(preset.id);
                  if (preset.id !== "custom") {
                    const d = new Date();
                    if (preset.id === "1-month") d.setDate(d.getDate() + 30);
                    else if (preset.id === "3-months") d.setDate(d.getDate() + 90);
                    else if (preset.id === "6-months") d.setDate(d.getDate() + 180);
                    else d.setDate(d.getDate() + 90); // default
                    setCustomDate(d.toISOString().split("T")[0]);
                  }
                }}
                className={`py-3.5 px-4 border rounded-[14px] font-sans font-medium text-sm transition-all text-center ${isSel ? 'border-ink ring-1 ring-ink bg-ink text-bg' : 'border-rule bg-bg text-ink hover:bg-bg-2'}`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div>
          <span className="block font-sans text-[10px] text-muted-2 uppercase tracking-wide mb-2">Configure target calendar date:</span>
          <input 
            type="date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setTargetDatePreset("custom");
            }}
            className="w-full h-11 bg-bg border border-rule-strong rounded-[12px] px-4 font-sans text-ink focus:outline-none focus:border-ink transition-all text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// Time estimates per question index (shown to user; not a live countdown to avoid pressure)
const QUESTION_TIME_HINTS = ["~60s", "~48s", "~36s", "~24s", "~12s"];

const PROCESSING_STEPS = [
  "Evaluating Knowledge Areas",
  "Mapping Study Route",
  "Preparing Personalized Mission",
];

const BRIEFING_ITEMS = [
  "Identify your strengths",
  "Detect knowledge gaps",
  "Build your study route",
  "Estimate exam readiness",
];

type DiagPhase = "briefing" | "question" | "processing";

function OnboardingDiagnostic({
  currentIdx,
  onAnswer,
  diagAnswers,
  diagSubmitted,
  onSubmitAnswer,
  onNext
}: {
  currentIdx: number;
  onAnswer: (optionKey: string) => void;
  diagAnswers: Record<number, string>;
  diagSubmitted: Record<number, boolean>;
  onSubmitAnswer: () => void;
  onNext: () => void;
}) {
  const [phase, setPhase] = useState<DiagPhase>("briefing");
  const [processingDone, setProcessingDone] = useState(0); // 0–3 checklist items revealed

  // Processing animation: reveal checklist items, then call onNext after 1400ms
  useEffect(() => {
    if (phase !== "processing") return;
    const timers = [
      setTimeout(() => setProcessingDone(1), 300),
      setTimeout(() => setProcessingDone(2), 700),
      setTimeout(() => setProcessingDone(3), 1100),
      setTimeout(() => onNext(), 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = DIAG_QUESTIONS[currentIdx];
  const selectedChoice = diagAnswers[currentIdx] || "";
  const isSubmitted = diagSubmitted[currentIdx] || false;
  const isCorrect = selectedChoice === q.correct;
  const completedCount = Object.keys(diagSubmitted).length;
  const progressPct = Math.round((completedCount / 5) * 100);

  // After last question is submitted + user clicks "Assemble", show processing
  const handleProceed = () => {
    if (currentIdx < 4) {
      onNext();
    } else {
      setPhase("processing");
    }
  };

  // ── PHASE: BRIEFING ──────────────────────────────────────────────────────
  if (phase === "briefing") {
    return (
      <motion.div
        key="briefing"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header badge */}
        <div className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-signal font-bold">
          <Radar size={11} className="text-signal" />
          Pre-Flight Assessment
        </div>

        {/* Title */}
        <div>
          <h2 className="font-serif text-[36px] md:text-[44px] leading-[1.05] text-ink tracking-tight mb-3">
            60-Second<br /><span className="italic text-navy">Flight Check</span>
          </h2>
          <p className="font-sans text-[14px] md:text-[15px] text-ink-2 leading-relaxed max-w-md">
            We'll assess your current knowledge level and generate your first personalized study mission.
          </p>
        </div>

        {/* Benefit list */}
        <ul className="space-y-2.5" aria-label="What this diagnostic does">
          {BRIEFING_ITEMS.map(item => (
            <li key={item} className="flex items-center gap-3 font-sans text-[13px] text-ink-2">
              <span className="w-5 h-5 rounded-full border border-mint/40 bg-mint/8 flex items-center justify-center shrink-0">
                <Check size={11} className="text-mint" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        {/* Meta pills */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule rounded-full font-mono text-[10px] tracking-widest text-muted-2 uppercase">
            5 Questions
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule rounded-full font-mono text-[10px] tracking-widest text-muted-2 uppercase">
            ~60 Seconds
          </span>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => setPhase("question")}
          className="h-12 px-8 font-sans font-semibold text-sm bg-ink text-bg rounded-full hover:bg-ink-2 transition-all shadow-sm flex items-center gap-2"
          autoFocus
        >
          Begin Diagnostic <ArrowRight size={15} />
        </button>
      </motion.div>
    );
  }

  // ── PHASE: PROCESSING ────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <motion.div
        key="processing"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="py-8 space-y-8"
        aria-live="polite"
        aria-label="Analyzing diagnostic results"
      >
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-signal font-bold mb-3">
            Telemetry Analysis
          </div>
          <h2 className="font-serif text-[28px] md:text-[34px] text-ink leading-tight tracking-tight">
            Analyzing Flight Data<span className="animate-pulse">...</span>
          </h2>
        </div>

        <ul className="space-y-4" aria-label="Analysis progress">
          {PROCESSING_STEPS.map((label, i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, x: -8 }}
              animate={processingDone > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 font-sans text-[14px] text-ink-2"
            >
              <span className="w-5 h-5 rounded-full bg-mint/10 border border-mint/30 flex items-center justify-center shrink-0">
                <Check size={11} className="text-mint" />
              </span>
              {label}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    );
  }

  // ── PHASE: QUESTION ──────────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`q-${currentIdx}`}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.22 }}
        className="space-y-5"
      >
        {/* Telemetry strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Subject badge */}
              <span className="font-mono text-[9px] uppercase tracking-widest text-signal font-bold bg-signal/8 border border-signal/20 px-2 py-0.5 rounded-[4px]">
                {q.subject}
              </span>
              <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest">
                Check {currentIdx + 1} of 5
              </span>
            </div>
            <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest">
              {QUESTION_TIME_HINTS[currentIdx]} remaining
            </span>
          </div>

          {/* Aviation-style progress bar */}
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Diagnostic progress: ${completedCount} of 5 complete`}
            className="h-[3px] w-full bg-rule rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-ink rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-bg border border-rule rounded-[20px] p-6 md:p-8 shadow-sm">
          <p className="font-serif text-[19px] md:text-[22px] leading-[1.45] text-ink mb-7">
            {q.question}
          </p>

          <div
            role="radiogroup"
            aria-label={`Answer options for check ${currentIdx + 1}`}
            className="space-y-3"
          >
            {q.options.map((opt) => {
              const isSelected = selectedChoice === opt.key;
              let optClass = "border-rule hover:border-ink/25 hover:bg-bg-2/50 cursor-pointer";

              if (isSubmitted) {
                if (opt.key === q.correct) {
                  optClass = "border-mint bg-mint-soft text-mint";
                } else if (isSelected) {
                  optClass = "border-signal bg-signal-soft/35 text-signal";
                } else {
                  optClass = "border-rule opacity-50";
                }
              } else if (isSelected) {
                optClass = "border-ink ring-1 ring-ink bg-bg-2";
              }

              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isSubmitted}
                  onClick={() => onAnswer(opt.key)}
                  className={`w-full text-left p-4 md:p-5 border rounded-[14px] transition-all flex items-start gap-4 text-[14px] leading-relaxed ${optClass}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 font-mono text-[10px] uppercase font-bold mt-0.5 transition-colors ${
                      isSelected && !isSubmitted ? 'bg-ink text-bg border-ink'
                      : isSubmitted && opt.key === q.correct ? 'bg-mint text-bg border-mint'
                      : isSubmitted && isSelected ? 'bg-signal text-bg border-signal'
                      : 'border-rule text-muted'
                    }`}
                  >
                    {opt.key}
                  </span>
                  <span className="flex-1 text-ink">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation (post-submit) */}
          {isSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-6 p-4 md:p-5 bg-muted-soft rounded-[14px] border border-rule/50"
            >
              <div className="flex items-center gap-2 mb-2 font-mono text-[9px] uppercase tracking-widest font-bold">
                {isCorrect ? (
                  <>
                    <Check size={13} className="text-mint" />
                    <span className="text-mint">Check Verified</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={13} className="text-signal" />
                    <span className="text-signal">Check Advisory</span>
                  </>
                )}
              </div>
              <p className="font-sans text-[13px] leading-relaxed text-ink-2 opacity-90">
                {q.explanation}
              </p>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          {!isSubmitted ? (
            <button
              type="button"
              disabled={!selectedChoice}
              onClick={onSubmitAnswer}
              className="h-11 px-7 font-sans font-medium text-sm bg-ink text-bg rounded-full hover:bg-ink-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Lock Check
            </button>
          ) : (
            <button
              type="button"
              onClick={handleProceed}
              className="h-11 px-7 font-sans font-medium text-sm bg-ink text-bg rounded-full hover:bg-ink-2 transition-all flex items-center gap-2 shadow-sm"
            >
              {currentIdx < 4 ? "Next Check" : "Assemble Study Plan"}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function FinalDebrief({
  exam,
  dailyGoal,
  customDate,
  score
}: {
  exam: string;
  dailyGoal: string;
  customDate: string;
  score: number;
}) {
  const examTitle = exam.replace(/-/g, " ").toUpperCase();
  const intensityLabel = intensityPresets.find(i => i.id === dailyGoal)?.label || "Active Aircrew";
  
  let feedbackText = "";
  let feedbackTitle = "";
  
  if (score === 5) {
    feedbackTitle = "Outstanding Flight Readiness Baseline";
    feedbackText = "Exceptional baseline standard. You demonstrate highly polished systems awareness, barometric tracking, and aerodynamic logic. Keep the throttle active.";
  } else if (score >= 3) {
    feedbackTitle = "Stable Flight Foundation";
    feedbackText = "Solid core performance. You understand flight level principles and navigation, but systems autocompensation, dry adiabatics, and wind drift angles need touch-ups. Focus Meteorology & Airbus details next.";
  } else {
    feedbackTitle = "Continuous Training Advisory";
    feedbackText = "Advisory: Critical subject coordinates are currently operating outside standard tolerance. Let's build your fundamentals securely. Recommended starting blocks: Principles of Flight & Air Law.";
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#101214] text-bg rounded-[22px] p-6 shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute -bottom-12 -right-12 opacity-5 pointer-events-none">
          <Flame size={240} className="text-white" />
        </div>

        <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/75 font-semibold">
            TELEMETRY ANALYSIS · DIAGNOSED
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-mint bg-mint/10 border border-mint/20 px-2 py-0.5 rounded-full">
            SYSTEM CALIBRATED
          </span>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="relative flex items-center justify-center w-20 h-20 bg-white/5 rounded-full border border-white/10 shrink-0">
            <span className="font-serif text-3xl font-bold text-white">{score}</span>
            <span className="font-serif text-sm text-white/75 absolute bottom-1 right-2 w-max">/5</span>
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-white leading-tight mb-1">
              {feedbackTitle}
            </h3>
            <p className="font-mono text-[10px] text-white/75 uppercase tracking-widest">
              DIAGNOSTIC SCORE: {Math.round((score / 5) * 100)}% ACCURACY
            </p>
          </div>
        </div>

        <p className="font-sans text-[13px] text-white/85 leading-relaxed bg-white/[0.03] p-4 rounded-[14px] mb-4">
          {feedbackText}
        </p>
      </div>

      <div className="bg-bg border border-rule rounded-[18px] p-5 space-y-4 shadow-sm text-sm">
        <div className="flex justify-between items-center border-b border-rule/50 pb-3">
          <span className="font-sans text-muted">Primary Objective</span>
          <span className="font-mono text-xs font-semibold text-ink">{examTitle}</span>
        </div>
        <div className="flex justify-between items-center border-b border-rule/50 pb-3">
          <span className="font-sans text-muted">Daily Goal Speed</span>
          <span className="font-sans font-medium text-ink">{intensityLabel} ({dailyGoal} cards/day)</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-sans text-muted">Target Clearance Date</span>
          <span className="font-sans font-medium text-ink">{customDate ? new Date(customDate).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Flexible"}</span>
        </div>
      </div>

      <div className="bg-mint-soft border border-mint/[0.3] p-4 rounded-[14px] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-mint/10 border border-mint/20 flex items-center justify-center text-mint shrink-0">
          <Sparkles size={14} />
        </div>
        <p className="font-sans text-[12.5px] leading-relaxed text-ink-2">
          <strong>Up next:</strong> We have logged this telemetry profile and generated your live review decks. Enter the cockpit to start your custom flight sequence.
        </p>
      </div>
    </div>
  );
}

export function OnboardingFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [pathway, setPathway] = useState("");
  const [goal, setGoal] = useState("");
  const [resolveError, setResolveError] = useState(false);
  const [dailyGoal, setDailyGoal] = useState("25");
  const [targetDatePreset, setTargetDatePreset] = useState("3-months");
  const [customDate, setCustomDate] = useState("");

  // Diagnostic Test States
  const [currentDiagIdx, setCurrentDiagIdx] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState<Record<number, string>>({});
  const [diagSubmitted, setDiagSubmitted] = useState<Record<number, boolean>>({});
  const [diagScore, setDiagScore] = useState(0);

  const { updateUserData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Generate default date: 3 months from now
    const d = new Date();
    d.setDate(d.getDate() + 90);
    setCustomDate(d.toISOString().split("T")[0]);
  }, []);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      // Diagnostic handled separately by 'Assembly Study Plan' button in the Diagnostic test itself
      // It will auto-proceed once all 5 are answered
    } else {
      finalizeOnboarding();
    }
  };

  const finalizeOnboarding = () => {
    const targetExam = resolveTargetExam(pathway, goal);

    // Guard: resolveTargetExam returns null on unknown combinations.
    // This should never happen in normal flow (Continue is disabled until
    // both pathway + goal are set), but protects against edge cases.
    if (!targetExam) {
      setResolveError(true);
      return;
    }

    // Funnel analytics: capture the two-level selection + derived target.
    trackEvent("onboarding_completed", {
      metadata: { pathway, goal, targetExam, diagnosticScore: diagScore }
    });

    // Save onboarding data in profile & localStorage
    updateUserData({
      targetExam,
      nextExam: customDate,
      dailyGoal: parseInt(dailyGoal),
      onboardingCompleted: true,
      settings: {
        lastDiagnosticScore: diagScore,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingPath: pathway,
        onboardingGoal: goal
      }
    }).catch(() => {});

    localStorage.setItem("heading_onboarding_completed", "true");
    onClose();
    navigate("/today");
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      // Skip diagnostic and proceed directly to results debrief with a 0-score
      setStep(4);
    }
  };

  const handleAnswerChoice = (choice: string) => {
    setDiagAnswers(prev => ({ ...prev, [currentDiagIdx]: choice }));
  };

  const handleLockAnswer = () => {
    const isCorrect = diagAnswers[currentDiagIdx] === DIAG_QUESTIONS[currentDiagIdx].correct;
    if (isCorrect) {
      setDiagScore(prev => prev + 1);
    }
    setDiagSubmitted(prev => ({ ...prev, [currentDiagIdx]: true }));
  };

  const handleProceedDiag = () => {
    if (currentDiagIdx < 4) {
      setCurrentDiagIdx(prev => prev + 1);
    } else {
      // Proceed to the final compilation results step
      setStep(4);
    }
  };

  const currentStepData = stepsData[step - 1];

  return (
    <div className="fixed inset-0 z-[200] bg-bg flex flex-col md:flex-row overflow-hidden animate-[fadeIn_0.3s_ease-out]">
      {/* Left Column Background Pane (~43%) */}
      <div className="w-full h-auto md:h-full md:w-[43%] flex flex-col justify-between p-8 md:p-12 lg:p-16 relative bg-bg shrink-0 border-b md:border-b-0 border-rule">
        <div className="flex items-center gap-3 mb-10 md:mb-0">
          <Wordmark compassSize={20} />
          <span className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase border border-rule px-1.5 py-0.5 rounded-[4px] mt-0.5 opacity-80">GROUND SCHOOL</span>
        </div>
        
        <div className="my-auto max-w-lg mb-8 md:mb-auto">
          <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase flex items-center gap-2 mb-6 font-semibold">
            <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
            PRE-FLIGHT BRIEF · STEP {step} OF 4
          </div>
          
          <h1 className="font-serif text-[42px] md:text-[50px] lg:text-[60px] leading-[1.0] text-ink mb-6 tracking-tight">
            {currentStepData.title.split(" ").map((w, i) => 
              w.toLowerCase() === currentStepData.accent.toLowerCase()
              ? <span key={i} className="italic text-navy">{w} </span> 
              : <span key={i}>{w} </span>
            )}
          </h1>
          <p className="font-sans text-[15px] md:text-[17px] text-ink-2 font-light leading-relaxed max-w-md">
            {currentStepData.subtitle}
          </p>
        </div>

        <div className="hidden md:block font-mono text-[9px] text-muted tracking-[0.2em] uppercase">
          PILOT FORMULATION · 0{step} OF 04 · STABLE
        </div>
      </div>

      {/* Right Column Interactive Flow Pane (~57%) */}
      <div className="w-full md:w-[57%] h-full bg-paper md:border-l border-rule flex flex-col overflow-hidden relative">
        <div className="px-6 md:px-12 lg:px-20 pt-10 md:pt-16 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32">
          {/* Progress horizontal steps indicator */}
          <div className="flex gap-2.5 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-ink' : i < step ? 'bg-mint' : 'bg-rule'}`} />
            ))}
          </div>
          
          <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-1">
            0{step} / {currentStepData.stepName}
          </div>
          
          <div className="flex-1 mt-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className={`w-full ${step === 3 ? 'max-w-2xl' : 'max-w-lg'}`}
              >
                {step === 1 && (
                  <Step1Exam pathway={pathway} setPathway={setPathway} goal={goal} setGoal={setGoal} />
                )}
                {step === 2 && (
                  <Step2Pacing 
                    dailyGoal={dailyGoal} 
                    setDailyGoal={setDailyGoal} 
                    targetDatePreset={targetDatePreset}
                    setTargetDatePreset={setTargetDatePreset}
                    customDate={customDate}
                    setCustomDate={setCustomDate}
                  />
                )}
                {step === 3 && (
                  <OnboardingDiagnostic 
                    currentIdx={currentDiagIdx}
                    onAnswer={handleAnswerChoice}
                    diagAnswers={diagAnswers}
                    diagSubmitted={diagSubmitted}
                    onSubmitAnswer={handleLockAnswer}
                    onNext={handleProceedDiag}
                  />
                )}
                {step === 4 && (
                  <FinalDebrief
                    exam={resolveTargetExam(pathway, goal) ?? ""}
                    dailyGoal={dailyGoal}
                    customDate={customDate}
                    score={diagScore}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer actions block (Hidden on step 3 since it has custom inside-card locks) */}
        {step !== 3 && (
          <div className="px-6 md:px-12 lg:px-20 py-4 md:py-6 flex items-center justify-between border-t border-rule mt-auto shrink-0 sticky bottom-0 bg-paper/95 backdrop-blur-md z-10 w-full">
            {step > 1 ? (
              <button onClick={handleBack} className="h-10 px-4 flex items-center justify-center font-sans font-medium text-xs text-ink border border-rule rounded-full hover:bg-bg transition-colors">
                <MoveLeft size={14} className="mr-1.5" /> Back
              </button>
            ) : <div />}

            <div className="flex items-center gap-6">
              {/* SKIP only on step 2 (pacing has safe defaults). Step 1 pathway
                  selection is required — no valid fallback targetExam exists. */}
              {step === 2 && (
                <button onClick={handleSkip} className="font-mono text-[10px] text-muted font-bold hover:text-ink tracking-widest uppercase transition-colors">
                  SKIP
                </button>
              )}
              
              {resolveError && step === 4 && (
                <span className="font-mono text-[10px] text-signal uppercase tracking-widest">
                  Selection error — go back and reselect your pathway
                </span>
              )}
              {!resolveError && (
                <button
                  onClick={finalizeOnboarding}
                  className={`h-11 px-6 font-sans font-semibold text-sm bg-ink text-bg rounded-full hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center ${step === 4 ? '' : 'hidden'}`}
                >
                  Enter Study Path <ArrowRight size={14} className="ml-1.5" />
                </button>
              )}

              <button 
                onClick={handleNext}
                disabled={
                  (step === 1 && (!pathway || !goal)) ||
                  (step === 2 && (!dailyGoal || !customDate))
                }
                className={`h-11 px-6 font-sans font-semibold text-sm bg-ink text-bg rounded-full hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center ${step === 4 ? 'hidden' : ''}`}
              >
                Continue <MoveRight size={14} className="ml-1.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
