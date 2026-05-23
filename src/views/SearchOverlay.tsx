import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Search, BookOpen, Clock } from "lucide-react";
import { subjects, mockExams } from "../data/topics";

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const searchLower = query.toLowerCase();

  const results = [
    // Modules
    ...subjects.filter(s => s.title.toLowerCase().includes(searchLower) || s.id.toLowerCase().includes(searchLower)).map(s => ({
      id: s.id,
      title: s.title,
      type: "Module",
      icon: <BookOpen size={14} />,
      onClick: () => { navigate(`/topic/${s.id}`); onClose(); }
    })),
    // Virtual Exams
    ...mockExams.filter(e => e.subject.toLowerCase().includes(searchLower) || e.code.toLowerCase().includes(searchLower)).map(e => ({
      id: e.id,
      title: e.subject,
      type: "Exam",
      icon: <Clock size={14} />,
      onClick: () => { navigate(`/quiz/${e.id}`); onClose(); }
    }))
  ];

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!query.trim()) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].onClick();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, query, results, selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Ensure selected item is into view
  useEffect(() => {
    if (searchContainerRef.current) {
      const activeEl = searchContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-xl bg-paper border border-rule shadow-2xl rounded-xl overflow-hidden relative z-10 flex flex-col max-h-[70vh]"
      >
        <div className="p-4 border-b border-rule flex items-center gap-3">
          <Search size={20} className="text-muted-2" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Jump to module, ATA chapter, or exam..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none font-sans text-ink placeholder:text-muted-2 text-lg"
          />
          <kbd className="hidden sm:inline-block font-mono text-[10px] text-muted-2 bg-panel px-2 py-1 rounded border border-rule">ESC</kbd>
        </div>

        {query.trim().length > 0 && (
          <div className="overflow-y-auto p-2" ref={searchContainerRef}>
            {results.length > 0 ? (
              results.map((r, i) => {
                const isActive = i === selectedIndex;
                return (
                  <button
                    key={`${r.id}-${i}`}
                    data-active={isActive ? "true" : "false"}
                    onClick={r.onClick}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-colors group ${isActive ? 'bg-panel' : 'hover:bg-panel'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-ink text-paper' : 'bg-rule/50 text-ink group-hover:bg-ink group-hover:text-paper'}`}>
                        {r.icon}
                      </div>
                      <span className="font-sans font-medium text-ink">{r.title}</span>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 bg-bg-2 px-2 py-1 rounded">
                      {r.type}
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="p-8 text-center text-muted-2 font-mono text-xs uppercase tracking-widest">
                No telemetry found for "{query}"
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
