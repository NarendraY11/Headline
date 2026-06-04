import {
    Check,
    ChevronDown
} from "lucide-react";
import React, { useState } from "react";


export function CustomDropdown({ value, options, onChange }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || value;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-40" onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsOpen(false);
        }
    }}>
      <div 
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between bg-paper border rounded-md text-ink px-4 py-3 cursor-pointer select-none font-mono text-xs shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy hover:bg-bg-2 ${isOpen ? 'border-navy ring-2 ring-navy/30' : 'border-rule-strong hover:border-ink/40'}`}
        aria-label={`Select option, current is ${selectedLabel}`}
      >
        <span className="uppercase tracking-wider">{selectedLabel}</span>
        <ChevronDown size={14} className={`text-ink-2 ml-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div 
          role="listbox"
          className="absolute top-full right-0 mt-1.5 bg-paper border border-rule-strong rounded-md shadow-lg z-10 w-full overflow-hidden"
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              tabIndex={0}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }
              }}
              className="px-4 py-2.5 text-sm font-sans flex items-center justify-between cursor-pointer hover:bg-[#FDFCF8] dark:hover:bg-bg-2 text-ink transition-colors focus:bg-[#FDFCF8] dark:focus:bg-bg-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky/60 aria-selected:bg-sky-soft aria-selected:font-medium dark:aria-selected:bg-bg-2"
            >
              <span className="capitalize">{opt.label}</span>
              {value === opt.value && <Check size={14} className="text-ink ml-4" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
