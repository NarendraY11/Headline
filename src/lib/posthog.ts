import posthog from "posthog-js";

// Thin wrapper around posthog-js. Everything no-ops when VITE_POSTHOG_KEY is
// absent, so the app runs unchanged until the key is configured in Vercel.
// Capturing is gated on the existing cookie-consent choice
// (localStorage "heading_cookie_consent"): opted out until the user accepts.

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || "https://eu.i.posthog.com";

let initialized = false;
const enabled = () => !!KEY && typeof window !== "undefined";

export function initPostHog() {
  if (initialized || !enabled()) return;
  let consent: string | null = null;
  try {
    consent = localStorage.getItem("heading_cookie_consent");
  } catch {
    /* storage blocked — treat as no consent */
  }
  posthog.init(KEY as string, {
    api_host: HOST,
    capture_pageview: false, // sent manually on route change
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    // Don't drop cookies or capture until the user has accepted.
    opt_out_capturing_by_default: consent !== "true",
  });
  initialized = true;
}

export function posthogConsentGranted() {
  if (!enabled()) return;
  initPostHog();
  posthog.opt_in_capturing();
}

export function posthogConsentDeclined() {
  if (!enabled() || !initialized) return;
  posthog.opt_out_capturing();
}

export function posthogCapture(event: string, props?: Record<string, unknown>) {
  if (!enabled() || !initialized) return;
  posthog.capture(event, props);
}

export function posthogPageview(path: string) {
  if (!enabled() || !initialized) return;
  posthog.capture("$pageview", { $current_url: window.location.href, path });
}

export function posthogIdentify(id: string, props?: Record<string, unknown>) {
  if (!enabled() || !initialized) return;
  posthog.identify(id, props);
}

export function posthogReset() {
  if (!enabled() || !initialized) return;
  posthog.reset();
}

export { posthog };
