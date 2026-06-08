import { useEffect, useState } from "react";

// Surfaces a non-blocking "new version available" prompt when the service
// worker that controls this page is swapped for a freshly-deployed one.
//
// The SW uses `registerType: 'autoUpdate'` + skipWaiting/clientsClaim (see
// vite.config.ts), so a new build activates and claims open clients on its own
// — but the already-loaded JS keeps running the old bundle until a reload. This
// banner lets the user pull the new version on their own terms instead of
// hitting a stale-chunk error later. (Hard chunk-load failures are auto-recovered
// by the `vite:preloadError` handler in main.tsx.)
export function PWAUpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // The first install also fires `controllerchange` (clientsClaim). Only a
    // swap where a controller ALREADY existed at load time is a real update.
    const hadController = !!navigator.serviceWorker.controller;
    const onChange = () => {
      if (hadController) setShow(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[10000] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-rule bg-paper px-4 py-2.5 shadow-lg">
        <span className="font-sans text-xs text-ink">
          A new version is available.
        </span>
        <button
          onClick={() => window.location.reload()}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-paper bg-ink rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss update notice"
          className="text-muted hover:text-ink transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
