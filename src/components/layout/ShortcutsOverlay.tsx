import {
    X
} from "lucide-react";
import { useEffect } from "react";


export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-paper border border-rule shadow-2xl rounded-xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-ink"><X size={20} /></button>
        <h2 className="font-serif text-3xl text-ink mb-6">Keyboard Binding</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-rule pb-3">
            <span className="font-sans text-sm text-ink-2">Select Answer</span>
            <div className="flex gap-2 font-mono text-xs"><kbd className="px-2 py-1 bg-panel border border-rule rounded">1-4</kbd> <span className="opacity-50 text-xs mt-1">or</span> <kbd className="px-2 py-1 bg-panel border border-rule rounded">A-D</kbd></div>
          </div>
          <div className="flex justify-between items-center border-b border-rule pb-3">
            <span className="font-sans text-sm text-ink-2">Submit / Next</span>
            <kbd className="px-2 py-1 bg-panel border border-rule rounded font-mono text-xs">Enter</kbd>
          </div>
          <div className="flex justify-between items-center border-b border-rule pb-3">
            <span className="font-sans text-sm text-ink-2">Reveal (Viva Mode)</span>
            <kbd className="px-2 py-1 bg-panel border border-rule rounded font-mono text-xs">Spacebar</kbd>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="font-sans text-sm text-ink-2">Show Shortcuts</span>
            <kbd className="px-2 py-1 bg-panel border border-rule rounded font-mono text-xs">?</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
