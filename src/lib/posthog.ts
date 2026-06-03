// Thin wrapper around posthog-js. Everything no-ops when VITE_POSTHOG_KEY is
// absent, so the app runs unchanged until the key is configured in Vercel.
// Capturing is gated on the existing cookie-consent choice
// (localStorage "heading_cookie_consent"): opted out until the user accepts.
//
// posthog-js (~190 KB) is loaded via dynamic import() the first time analytics
// is actually initialized, keeping it OUT of the entry chunk. Always-mounted
// modules (AuthContext, CookieConsent, RouteMetaHelper) import these wrappers
// statically, so the wrappers themselves must not statically import posthog-js.

import type { PostHog } from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || "https://eu.i.posthog.com";

let ph: PostHog | null = null;
let initialized = false;
let loading: Promise<PostHog | null> | null = null;

const enabled = () => !!KEY && typeof window !== "undefined";

export async function initPostHog(): Promise<void> {
  if (initialized || !enabled()) return;
  if (!loading) {
    loading = import("posthog-js").then((m) => m.default);
  }
  ph = await loading;
  if (!ph || initialized) return;

  let consent: string | null = null;
  try {
    consent = localStorage.getItem("heading_cookie_consent");
  } catch {
    /* storage blocked — treat as no consent */
  }
  ph.init(KEY as string, {
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
  // Ensure posthog is loaded+initialized, then opt in.
  void initPostHog().then(() => ph?.opt_in_capturing());
}

export function posthogConsentDeclined() {
  if (!enabled() || !initialized || !ph) return;
  ph.opt_out_capturing();
}

export function posthogCapture(event: string, props?: Record<string, unknown>) {
  if (!enabled() || !initialized || !ph) return;
  ph.capture(event, props);
}

export function posthogPageview(path: string) {
  if (!enabled() || !initialized || !ph) return;
  ph.capture("$pageview", { $current_url: window.location.href, path });
}

export function posthogIdentify(id: string, props?: Record<string, unknown>) {
  if (!enabled() || !initialized || !ph) return;
  ph.identify(id, props);
}

export function posthogReset() {
  if (!enabled() || !initialized || !ph) return;
  ph.reset();
}
