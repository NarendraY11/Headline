// Sentry must initialize before anything else, so this file is imported first
// in main.tsx. Init is gated on VITE_SENTRY_DSN: with no DSN set the SDK is a
// no-op, so builds/previews without the env var behave exactly as before.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,
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
  });
}
