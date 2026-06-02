import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

// Custom install banner. Captures the browser's beforeinstallprompt event so we
// can show our own UI instead of the default mini-infobar, and remembers a
// dismissal in localStorage so we don't nag.
const DISMISS_KEY = "pwa_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed (standalone) — never show.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress the default mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      // One-shot event; can't be reused.
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[90] animate-fadeIn">
      <div className="bg-paper border border-rule rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-navy text-bg flex items-center justify-center shrink-0">
          <Download size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-sm text-ink leading-tight">Install Heading</p>
          <p className="font-sans text-[11.5px] text-muted-2 leading-relaxed mt-0.5">
            Add the app to your home screen for faster access and offline study.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={install}
              className="px-3.5 py-1.5 bg-navy text-white hover:bg-navy-dark font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer"
            >
              Install App
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 text-muted hover:text-ink font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="p-1 text-muted hover:text-ink rounded transition-colors cursor-pointer shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
