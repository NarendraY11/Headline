import { Download, Share, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { posthogCapture } from "../../lib/posthog";

const DISMISS_KEY = "pwa_banner_dismissed_at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < DISMISS_TTL_MS;
}

/**
 * Inline PWA install banner for the Today Dashboard.
 * Shows under the welcome header — mobile-first, responsive desktop.
 */
export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const shownRef = useRef(false);

  // Android / Desktop Chrome & Edge
  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    // Check global captured before React mounted (main.tsx captures early)
    const early = (window as any).__pwaPrompt as BeforeInstallPromptEvent | null;
    if (early && !shownRef.current) {
      shownRef.current = true;
      setDeferred(early);
      setVisible(true);
      posthogCapture("pwa_banner_shown", { platform: "android_desktop" });
    }

    // Also listen for fires that happen after React mounts
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaPrompt = e;
      setDeferred(e as BeforeInstallPromptEvent);
      if (!shownRef.current) {
        shownRef.current = true;
        setVisible(true);
        posthogCapture("pwa_banner_shown", { platform: "android_desktop" });
      }
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

  // iOS Safari
  useEffect(() => {
    if (!isIOS() || isStandalone() || isDismissed()) return;
    if (!shownRef.current) {
      shownRef.current = true;
      setShowIos(true);
      posthogCapture("pwa_banner_shown", { platform: "ios" });
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIos(false);
    posthogCapture("pwa_install_dismissed");
  };

  const install = async () => {
    if (!deferred) return;
    posthogCapture("pwa_install_clicked");
    await deferred.prompt();
    try {
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        posthogCapture("pwa_install_accepted");
      } else {
        posthogCapture("pwa_install_dismissed", { via: "native_prompt" });
      }
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  // Android / Desktop install prompt
  if (visible && deferred) {
    return (
      <div
        role="region"
        aria-label="Install Heading App"
        aria-live="polite"
        className="bg-bg-2 border border-rule rounded-xl px-4 py-4 mb-4"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl bg-navy text-bg flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Smartphone size={18} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-sans font-semibold text-sm text-ink leading-tight">
              Install Heading
            </p>
            <p className="font-mono text-[10px] text-muted-2 uppercase tracking-wide mt-0.5">
              Your cockpit for daily CPL preparation.
            </p>

            {/* Benefit chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5" aria-label="App benefits">
              {["One-tap access", "Study reminders", "Works offline"].map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-navy/8 border border-navy/12 font-mono text-[9.5px] uppercase tracking-wide text-ink-2"
                >
                  <span className="text-mint font-bold" aria-hidden="true">✓</span>
                  {b}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={install}
                aria-label="Install the Heading app"
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 bg-navy text-bg hover:opacity-90 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-opacity cursor-pointer"
              >
                <Download size={12} aria-hidden="true" />
                Install App
              </button>
              <button
                onClick={dismiss}
                aria-label="Remind me later about installing the app"
                className="min-h-[44px] px-2 font-mono text-[10px] uppercase font-bold text-muted hover:text-ink tracking-wider transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="p-1.5 text-muted-2 hover:text-ink rounded transition-colors cursor-pointer shrink-0"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari: manual Add to Home Screen
  if (showIos) {
    return (
      <div
        role="region"
        aria-label="Install Heading App on iOS"
        aria-live="polite"
        className="bg-bg-2 border border-rule rounded-xl px-4 py-4 mb-4"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl bg-navy text-bg flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Share size={18} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-sans font-semibold text-sm text-ink leading-tight">
              Install Heading
            </p>
            <p className="font-mono text-[10px] text-muted-2 uppercase tracking-wide mt-0.5">
              Your cockpit for daily CPL preparation.
            </p>
            <p className="font-sans text-[11.5px] text-muted-2 leading-relaxed mt-2">
              Tap{" "}
              <span className="font-semibold text-ink inline-flex items-center gap-0.5">
                Share <Share size={10} aria-hidden="true" />
              </span>{" "}
              then{" "}
              <span className="font-semibold text-ink">Add to Home Screen</span>.
            </p>
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="p-1.5 text-muted-2 hover:text-ink rounded transition-colors cursor-pointer shrink-0"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
