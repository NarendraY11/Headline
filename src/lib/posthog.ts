// Thin wrapper around posthog-js. Everything no-ops when VITE_POSTHOG_KEY is
// absent, so the app runs unchanged until the key is configured in Vercel.
// Capturing is gated on the existing cookie-consent choice
// (localStorage "heading_cookie_consent"): opted out until the user accepts.
//
// posthog-js (~190 KB) is loaded via dynamic import() the first time analytics
// is actually initialized, keeping it OUT of the entry chunk. Always-mounted
// modules (AuthContext, CookieConsent, RouteMetaHelper) import these wrappers
// statically, so the wrappers themselves must not statically import posthog-js.
//
// Adblocker/privacy-tool resilience: a probe fetch is sent to the PostHog
// ingestion host before init. If the host is unreachable (ERR_BLOCKED_BY_CLIENT
// or network error), we set `blocked = true` and skip init entirely so the SDK
// never retries and the console stays clean.

import type { PostHog } from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = ((import.meta.env.VITE_POSTHOG_HOST as string) || "https://eu.i.posthog.com").trim();

let ph: PostHog | null = null;
let initialized = false;
let blocked = false;
let loading: Promise<PostHog | null> | null = null;

const enabled = () => !!KEY && typeof window !== "undefined" && !blocked;

// Probe whether the PostHog host is reachable. Uses a HEAD request to the
// decide endpoint (lightweight, no payload). Resolves false if blocked/offline.
async function isHostReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${HOST}/decide?v=3`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
      // No credentials; we just need to know if the host is reachable.
      mode: "no-cors",
    });
    // no-cors responses are opaque (type==="opaque") but do NOT throw on success.
    return res.type === "opaque" || res.ok;
  } catch {
    return false;
  }
}

export async function initPostHog(): Promise<void> {
  if (initialized || blocked || !KEY || typeof window === "undefined") return;
  if (!loading) {
    loading = import("posthog-js").then((m) => m.default).catch(() => null);
  }

  // Probe first — if the ingestion host is blocked (adblocker / privacy
  // protection / firewall), bail out silently before the SDK even loads.
  const reachable = await isHostReachable();
  if (!reachable) {
    blocked = true;
    loading = null;
    return;
  }

  ph = await loading;
  if (!ph || initialized) return;

  let consent: string | null = null;
  try {
    consent = localStorage.getItem("heading_cookie_consent");
  } catch {
    /* storage blocked — treat as no consent */
  }

  try {
    ph.init(KEY as string, {
      api_host: HOST,
      capture_pageview: false, // sent manually on route change
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
      // Don't drop cookies or capture until the user has accepted.
      opt_out_capturing_by_default: consent !== "true",
      // Silence SDK-level transport errors so adblocker noise stays off console.
      on_xhr_error: () => {
        blocked = true;
      },
    });
    initialized = true;
  } catch {
    blocked = true;
  }
}

export function posthogConsentGranted() {
  if (!enabled()) return;
  void initPostHog().then(() => ph?.opt_in_capturing());
}

export function posthogConsentDeclined() {
  if (!enabled() || !initialized || !ph) return;
  ph.opt_out_capturing();
}

export function posthogCapture(event: string, props?: Record<string, unknown>) {
  if (!enabled() || !initialized || !ph) return;
  try {
    ph.capture(event, props);
  } catch {
    blocked = true;
  }
}

export function posthogPageview(path: string) {
  if (!enabled() || !initialized || !ph) return;
  try {
    ph.capture("$pageview", { $current_url: window.location.href, path });
  } catch {
    blocked = true;
  }
}

export function posthogIdentify(id: string, props?: Record<string, unknown>) {
  if (!enabled() || !initialized || !ph) return;
  try {
    ph.identify(id, props);
  } catch {
    blocked = true;
  }
}

export function posthogReset() {
  if (!enabled() || !initialized || !ph) return;
  try {
    ph.reset();
  } catch {
    blocked = true;
  }
}
