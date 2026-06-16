// Sentry must initialize before anything else, so this file is imported first
// in main.tsx. Init is gated on VITE_SENTRY_DSN: with no DSN set the SDK is a
// no-op, so builds/previews without the env var behave exactly as before.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Query params that may carry credentials/PII. Their values are replaced with
// [Filtered] anywhere we scrub a URL (event request URLs, breadcrumb URLs,
// transaction names). Matched case-insensitively.
const SENSITIVE_QUERY_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "key",
  "apikey",
  "api_key",
  "secret",
  "password",
  "pwd",
  "email",
  "signature",
  "sig",
];

// Replace sensitive query-string values with [Filtered] while preserving the
// URL shape (path + which params were present). Falls back to a regex scrub for
// non-absolute / unparseable strings so we never leak a raw token via a partial
// path. Returns the input untouched when there's nothing query-like.
function scrubUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return url as undefined;
  if (url.indexOf("?") === -1 && url.indexOf("=") === -1) return url;

  const filterParams = (params: URLSearchParams) => {
    let touched = false;
    for (const key of Array.from(params.keys())) {
      if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase())) {
        params.set(key, "[Filtered]");
        touched = true;
      }
    }
    return touched;
  };

  try {
    // Absolute URL.
    const u = new URL(url);
    filterParams(u.searchParams);
    return u.toString();
  } catch {
    // Relative URL or path?query — parse just the query portion.
    const qIndex = url.indexOf("?");
    if (qIndex !== -1) {
      const path = url.slice(0, qIndex);
      const params = new URLSearchParams(url.slice(qIndex + 1));
      filterParams(params);
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    }
    // No '?' but contains '=' (e.g. a hash-routed token) — regex fallback.
    let out = url;
    for (const key of SENSITIVE_QUERY_KEYS) {
      out = out.replace(
        new RegExp(`([?&#]${key}=)[^&#]*`, "gi"),
        "$1[Filtered]"
      );
    }
    return out;
  }
}

if (dsn) {
  // Suppress unhandled rejections originating from blocked Sentry transport.
  // NOTE: must NOT use { passive: true } — passive listeners cannot call
  // e.preventDefault(), so the event would still propagate to the console.
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e.reason?.message || e.reason || "");
    if (
      msg.includes("sentry.io") ||
      msg.includes("ingest.") ||
      msg.includes("ERR_BLOCKED") ||
      msg.includes("Failed to fetch") && (e.reason?.stack || "").includes("sentry")
    ) {
      e.preventDefault();
    }
  });

  // Custom transport that swallows network errors silently. Sentry's default
  // fetch transport throws on ERR_BLOCKED_BY_CLIENT, which leaks to the console
  // even after the unhandledrejection guard above (browser logs the network error
  // before JS sees the rejection). Wrapping the transport stops both.
  function makeSilentTransport(options: Parameters<typeof Sentry.makeFetchTransport>[0]) {
    const inner = Sentry.makeFetchTransport(options);
    return {
      send: async (request: Parameters<typeof inner.send>[0]) => {
        try {
          return await inner.send(request);
        } catch {
          // Transport blocked — discard silently, app continues.
          return {};
        }
      },
      flush: (timeout?: number) => inner.flush(timeout),
    };
  }

  try {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __SENTRY_RELEASE__,
    // Never attach default PII (IP address, cookies, user from headers). We
    // identify users explicitly elsewhere with non-sensitive ids only.
    sendDefaultPii: false,
    transport: makeSilentTransport,
    // Capture browser perf traces + session replays for user-facing debugging.
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Sample 20% of transactions in prod; full rate in dev.
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    // Only propagate trace headers to our own API (avoids CORS noise to 3rd parties).
    tracePropagationTargets: ["localhost", /^\/(api)\//],
    // Replays: 10% of normal sessions, 100% of sessions with an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: true,
    // Strip token query-strings + PII from URLs before anything leaves the
    // browser. Covers the event's own request URL and every attached breadcrumb.
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (typeof crumb.data?.url === "string") {
            crumb.data.url = scrubUrl(crumb.data.url);
          }
          if (typeof crumb.data?.from === "string") {
            crumb.data.from = scrubUrl(crumb.data.from);
          }
          if (typeof crumb.data?.to === "string") {
            crumb.data.to = scrubUrl(crumb.data.to);
          }
        }
      }
      return event;
    },
    // Transaction names/URLs are derived from the route — scrub them too so a
    // tokened path can't surface as a transaction name.
    beforeSendTransaction(event) {
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      if (typeof event.transaction === "string") {
        event.transaction = scrubUrl(event.transaction) ?? event.transaction;
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      // Drop breadcrumbs for requests to analytics/monitoring hosts — when
      // blocked by an adblocker these produce high-volume network-error crumbs
      // that fill the event payload with noise.
      const url = crumb.data?.url as string | undefined;
      if (url && (url.includes("sentry.io") || url.includes("posthog.com") || url.includes("ingest."))) {
        return null;
      }
      if (typeof crumb.data?.url === "string") {
        crumb.data.url = scrubUrl(crumb.data.url);
      }
      if (typeof crumb.data?.from === "string") {
        crumb.data.from = scrubUrl(crumb.data.from);
      }
      if (typeof crumb.data?.to === "string") {
        crumb.data.to = scrubUrl(crumb.data.to);
      }
      return crumb;
    },
  });
  } catch {
    // Sentry init failed (e.g. DSN invalid, network blocked during setup).
    // App continues without monitoring.
  }
}
