import React, { useState, useRef, useEffect } from "react";
import { Flame, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { useLogbook } from "../hooks/useLogbook";
import { Link } from "react-router-dom";

export default function StreakWidget() {
  const { userData } = useAuth();
  const { logbook } = useLogbook();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Calculate unique dates the user was active
  const uniqueDates: string[] = [
    ...new Set(
      logbook.map((att: any) => att.dateISO?.split("T")[0]).filter(Boolean) as string[]
    ),
  ]
    .sort()
    .reverse();

  let computedStreak = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
      let expectedDate = new Date(uniqueDates[0]);
      for (const dStr of uniqueDates) {
        if (dStr === expectedDate.toISOString().split("T")[0]) {
          computedStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  const displayedStreak = (userData?.streakCount ?? parseInt(localStorage.getItem("heading_streak_count") || "0")) || computedStreak;

  // Check if today has work logged
  const todayStr = new Date().toISOString().split("T")[0];
  const hasStudiedToday = uniqueDates.includes(todayStr);

  // Handle escape / close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      {/* Target button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-signal/10 hover:bg-signal/15 rounded-full border border-signal/10 transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-signal"
        title="Streak Details"
      >
        <Flame size={14} className={`text-signal ${hasStudiedToday ? "fill-signal/30 animate-pulse" : "fill-signal/10"}`} />
        <span className="font-mono text-xs font-bold text-signal">{displayedStreak}</span>
      </button>

      {/* Popover pane */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 bg-paper border border-rule rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] py-4 px-5 z-50 origin-top-right text-left"
          >
            {/* Header row */}
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[9px] text-muted-2 uppercase tracking-[0.2em]">Pilot Logbook</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-muted-2 hover:text-ink cursor-pointer transition-colors p-0.5 rounded hover:bg-bg"
              >
                <X size={13} />
              </button>
            </div>

            {/* Main content */}
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-signal/15 shrink-0">
                <Flame size={24} className="text-signal fill-signal/25" />
              </div>
              <div className="min-w-0">
                <h4 className="font-serif text-lg font-bold text-ink leading-snug">
                  {displayedStreak > 0 ? `${displayedStreak} Day Streak` : "0 Day Streak"}
                </h4>
                <p className="font-sans text-xs text-muted leading-relaxed mt-0.5">
                  {displayedStreak > 0
                    ? hasStudiedToday
                      ? "Keep it up! Active session logged for today."
                      : "Practice today to extend your current streak."
                    : "Establish consistency. Practice can secure your goals."}
                </p>
              </div>
            </div>

            {/* Monthly Calendar View */}
            <div className="bg-bg/40 border border-rule/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wider">
                  {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <span className="font-mono text-[8.5px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                  {uniqueDates.filter(d => d.startsWith(new Date().toISOString().slice(0, 7))).length} Active Days
                </span>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((dayName, idx) => (
                  <span key={idx} className="font-mono text-[8px] text-muted-2 font-bold uppercase">
                    {dayName}
                  </span>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {(() => {
                  const now = new Date();
                  const cy = now.getFullYear();
                  const cm = now.getMonth();
                  const firstDay = new Date(cy, cm, 1);
                  const startDay = firstDay.getDay();
                  const totalDays = new Date(cy, cm + 1, 0).getDate();
                  const padNum = (n: number) => String(n).padStart(2, "0");

                  const cells = [];
                  // Empty padding
                  for (let i = 0; i < startDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="w-6 h-6" />);
                  }

                  // Day cells
                  for (let d = 1; d <= totalDays; d++) {
                    const cellDateStr = `${cy}-${padNum(cm + 1)}-${padNum(d)}`;
                    const isTodayCell = d === now.getDate() && cm === now.getMonth() && cy === now.getFullYear();
                    const isActive = uniqueDates.includes(cellDateStr);

                    cells.push(
                      <div
                        key={`day-${d}`}
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-mono transition-all relative ${
                          isActive
                            ? "bg-signal text-white font-bold shadow-[0_2px_6px_rgba(235,94,40,0.15)]"
                            : isTodayCell
                              ? "border border-dashed border-signal/60 text-signal font-semibold bg-signal/5"
                              : "text-ink/75 hover:bg-bg-2"
                        }`}
                        title={
                          isActive 
                            ? `Active on ${d} ${now.toLocaleDateString("en-US", { month: "short" })}` 
                            : isTodayCell 
                              ? "Today" 
                              : undefined
                        }
                      >
                        {d}
                        {isActive && isTodayCell && (
                          <span className="absolute bottom-0.5 w-1 h-1 bg-white rounded-full"></span>
                        )}
                        {!isActive && isTodayCell && (
                          <span className="absolute bottom-0.5 w-1 h-1 bg-signal rounded-full"></span>
                        )}
                      </div>
                    );
                  }

                  return cells;
                })()}
              </div>

              {/* Legend & Details */}
              <div className="flex items-center justify-center gap-4 border-t border-rule/40 pt-2.5 mt-2.5">
                <div className="flex items-center gap-1.5 font-mono text-[8px] text-muted-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-signal" />
                  <span>Practiced</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[8px] text-muted-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-dashed border-signal/60 bg-signal/5" />
                  <span>Today</span>
                </div>
              </div>
            </div>

            {/* Rules explanation */}
            <div className="bg-bg-2/30 rounded-lg p-2.5 border border-rule/30 mb-4">
              <span className="font-mono text-[8.5px] text-muted-2 uppercase tracking-wide block mb-1">STREAK LOGIC SPECIFICATION</span>
              <p className="font-sans text-[10px] text-muted leading-relaxed">
                Logbook streaks are preserved by answering questions in either Mock Exam or Practice modes once per 24-hour UTC day.
              </p>
            </div>

            {/* CTA action */}
            {(!hasStudiedToday || displayedStreak === 0) && (
              <Link 
                to="/modules" 
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 bg-signal hover:opacity-90 text-white font-semibold rounded-lg text-xs py-2 px-3 transition-opacity font-sans"
              >
                Start Study Session <ArrowRight size={13} />
              </Link>
            )}
            
            {hasStudiedToday && displayedStreak > 0 && (
              <div className="text-center font-mono text-[10px] text-emerald-600 bg-emerald-500/5 border border-emerald-500/10 py-1.5 rounded-lg">
                ✓ Active today · streak secured
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
