import { Download, Share, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const DISMISS_KEY = "pwa_install_dismissed";
const HAS_SESSION_KEY = "pwa_has_session";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function hasSession() {
  if (localStorage.getItem(HAS_SESSION_KEY) === "true") return true;
  try {
    const lb = localStorage.getItem("heading_logbook");
    if (lb) {
      const parsed = JSON.parse(lb);
      return Array.isArray(parsed) && parsed.length > 0;
    }
  } catch {}
  return false;
}

export function PwaInstallPrompt() {
  const { user } = useAuth();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIos, setShowIos] = useState(false);
  // Track whether we've already tried to show after a session event
  const sessionChecked = useRef(false);

  // Capture beforeinstallprompt unconditionally — don't gate on session here.
  // The event fires once early; if we miss it the banner can never appear.
  useEffect(() => {
    if (!user) return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Show immediately if user already has a session, otherwise wait.
      if (hasSession()) setVisible(true);
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
  }, [user]);

  // React to HAS_SESSION_KEY being set later in the same session (QuizView sets it).
  // Uses storage event (cross-tab) + a direct poll on mount.
  useEffect(() => {
    if (!user || visible || !deferred) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const tryShow = () => {
      if (!sessionChecked.current && hasSession()) {
        sessionChecked.current = true;
        setVisible(true);
      }
    };

    tryShow(); // immediate check in case QuizView already wrote the key
    window.addEventListener("storage", tryShow);
    return () => window.removeEventListener("storage", tryShow);
  }, [user, visible, deferred]);

  // iOS: no beforeinstallprompt — show manual instructions instead.
  useEffect(() => {
    if (!user) return;
    if (!isIOS()) return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    if (!hasSession()) {
      // Poll for session key (set by QuizView after first session)
      const interval = setInterval(() => {
        if (hasSession()) {
          clearInterval(interval);
          setShowIos(true);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
    setShowIos(true);
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  // Android/Desktop Chrome+Edge banner
  if (visible && deferred) {
    return (
      <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[90] animate-fadeIn">
        <div className="bg-paper border border-rule rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy text-bg flex items-center justify-center shrink-0">
            <Download size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-semibold text-sm text-ink leading-tight">Install Heading</p>
            <p className="font-sans text-[11.5px] text-muted-2 leading-relaxed mt-0.5">
              Add to your home screen for faster access and offline study.
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

  // iOS Safari: manual Add to Home Screen instructions
  if (showIos) {
    return (
      <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[90] animate-fadeIn">
        <div className="bg-paper border border-rule rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy text-bg flex items-center justify-center shrink-0">
            <Share size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-semibold text-sm text-ink leading-tight">Install Heading</p>
            <p className="font-sans text-[11.5px] text-muted-2 leading-relaxed mt-0.5">
              Tap the <span className="font-semibold text-ink">Share</span> button{" "}
              <span className="inline-block align-text-bottom opacity-70">
                <Share size={11} />
              </span>{" "}
              at the bottom of Safari, then choose{" "}
              <span className="font-semibold text-ink">Add to Home Screen</span>.
            </p>
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

  return null;
}
