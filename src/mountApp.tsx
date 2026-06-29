// Heavy app graph, split out of the entry chunk.
//
// main.tsx dynamically imports this module *after* the browser has painted the
// prerendered DOM. Everything expensive to evaluate at boot — Sentry, the full
// App route tree, every context provider — lives here so it is downloaded and
// evaluated off the critical path, not during entry-script eval where it would
// block first paint / LCP.
//
// `./instrument` stays the first import so Sentry.init() runs before any other
// app code evaluates (it is a no-op when VITE_SENTRY_DSN is unset).
import './instrument';
import * as Sentry from '@sentry/react';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { AuthModalProvider } from './contexts/AuthModalContext.tsx';
import { LoadingProvider } from './contexts/LoadingContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import { FeatureFlagsProvider } from './hooks/useFeatureFlags';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt.tsx';

// SpeedInsights only loads on Vercel infra — /_vercel/speed-insights/script.js
// is only served there. Guarded by VITE_ON_VERCEL (baked at build time via
// vite.config.ts define) so the component is null during local dev / prerender,
// preventing SyntaxError from the server returning HTML for the missing script.
const SpeedInsights = import.meta.env.VITE_ON_VERCEL
  ? lazy(() => import("@vercel/speed-insights/react").then((m) => ({ default: m.SpeedInsights })))
  : null;

// Mount the React tree onto #root.
//
// shouldHydrate=true: scripts/prerender.ts snapshotted real React-committed
// markup into dist/index.html for this route, so hydrateRoot() reuses the
// existing DOM instead of replacing it — the prerendered LCP element stays
// painted straight through to interactivity. createRoot() would wipe the
// prerendered markup and rebuild from scratch, making LCP measure the fresh
// client render.
//
// shouldHydrate=false: #root only has the static #app-splash shell (local dev
// `vite` server, or a route prerender doesn't cover). Hydrating against splash
// markup would mismatch the real tree and React would discard it anyway, so
// mount fresh with createRoot().
export function mountApp(rootEl: HTMLElement, shouldHydrate: boolean) {
  const errorHooks = {
    // React 19 error hooks → Sentry (complements the in-app ErrorBoundary).
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
  };

  const appTree = (
    <StrictMode>
      <FeatureFlagsProvider>
        <AuthModalProvider>
        <AuthProvider>
          <NotificationProvider>
            <ToastProvider>
              <LoadingProvider>
                <App />
                <PWAUpdatePrompt />
                {SpeedInsights && (
                  <Suspense fallback={null}>
                    <SpeedInsights />
                  </Suspense>
                )}
              </LoadingProvider>
            </ToastProvider>
          </NotificationProvider>
        </AuthProvider>
        </AuthModalProvider>
      </FeatureFlagsProvider>
    </StrictMode>
  );

  if (shouldHydrate) {
    hydrateRoot(rootEl, appTree, errorHooks);
  } else {
    createRoot(rootEl, errorHooks).render(appTree);
  }
}
