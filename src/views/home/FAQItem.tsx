import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-rule py-4">
      <button className="flex w-full justify-between items-center text-left py-2 focus:outline-none" onClick={() => setOpen(!open)}>
        <span className="font-sans font-medium text-ink">{question}</span>
        <ChevronDown size={18} className={`text-muted transition-transform duration-300 ${open ? '-rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
        <p className="font-sans font-light text-ink-2 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}
