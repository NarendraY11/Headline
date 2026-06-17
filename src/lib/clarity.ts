// Thin wrapper for Microsoft Clarity. No-ops when VITE_CLARITY_PROJECT_ID is
// absent. Injection is gated on cookie consent (localStorage
// "heading_cookie_consent" === "true") to match PostHog behaviour and comply
// with GDPR/ePrivacy — Clarity sets cookies and records sessions, both require
// consent. The script is injected once; subsequent calls are idempotent.

const PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

let injected = false;

function injectScript(id: string): void {
  if (injected || typeof window === "undefined") return;
  injected = true;

  // Clarity initialisation shim (matches the official snippet, minified form)
  (function (c: Window & { clarity?: Function }, l: Document, a: string, r: string, i: string, t?: HTMLScriptElement, y?: Element) {
    (c[a as keyof Window] as any) = (c[a as keyof Window] as any) || function () {
      ((c[a as keyof Window] as any).q = (c[a as keyof Window] as any).q || []).push(arguments);
    };
    (c[a as keyof Window] as any).v = "0.1";
    t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y?.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

export function initClarity(): void {
  if (!PROJECT_ID || typeof window === "undefined") return;

  let consent: string | null = null;
  try {
    consent = localStorage.getItem("heading_cookie_consent");
  } catch {
    /* storage blocked */
  }

  if (consent === "true") {
    injectScript(PROJECT_ID);
  }
}

export function clarityConsentGranted(): void {
  if (!PROJECT_ID || typeof window === "undefined") return;
  injectScript(PROJECT_ID);
}
