// Sentry init — must run before any other app code.
import './instrument';
import * as Sentry from '@sentry/react';
import '@fontsource/geist-sans/300.css';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import {StrictMode, Suspense, lazy} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import { initPostHog } from './lib/posthog';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.tsx';
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

// Defer product analytics init until the browser is idle after first paint, so
// it doesn't add startup main-thread cost. (No-op until VITE_POSTHOG_KEY is set;
// capturing stays opted out until cookie consent is accepted.)
const runWhenIdle = (cb: () => void) =>
  typeof (window as any).requestIdleCallback === "function"
    ? (window as any).requestIdleCallback(cb)
    : setTimeout(cb, 1);

runWhenIdle(() => {
  // initPostHog internally dynamic-imports posthog-js, so the heavy SDK stays
  // out of the entry chunk; the wrapper itself is tiny.
  initPostHog();
});

// Capture beforeinstallprompt as early as possible — the event fires once,
// often before React mounts. Store on window so PwaInstallBanner can read it.
(window as any).__pwaPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaPrompt = e;
});

// Recover from stale-chunk errors after a new deploy: a lazy route's dynamic
// import 404s because the hashed filenames changed under the running tab. Reload
// once to pull the fresh index + chunk manifest. The session flag prevents a
// reload loop if the chunk is genuinely missing; it's cleared after a healthy
// load so a later deploy in the same session can still self-heal.
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem('vite-preload-retry')) return;
  sessionStorage.setItem('vite-preload-retry', '1');
  event.preventDefault();
  window.location.reload();
});
runWhenIdle(() => sessionStorage.removeItem('vite-preload-retry'));

const rootEl = document.getElementById('root')!;
const errorHooks = {
  // React 19 error hooks → Sentry (complements the in-app ErrorBoundary).
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
};
const appTree = (
  <StrictMode>
    <FeatureFlagsProvider>
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
    </FeatureFlagsProvider>
  </StrictMode>
);

// scripts/prerender.ts snapshots real React-committed markup into dist/index.html
// per route. createRoot() was wiping that markup and rebuilding the entire tree
// client-side from an empty root — the prerendered HTML painted for ~1 frame
// then got discarded, so LCP measured the FRESH client render (3s+), not the
// prerendered one. hydrateRoot() reuses the existing DOM instead of replacing
// it, so the prerendered LCP element stays painted through to interactivity.
// Falls back to createRoot when #root still has only the static #app-splash
// shell (local dev `vite` server, or a route the prerender script doesn't
// cover) — hydrating against the splash markup would mismatch the real tree
// and React would silently discard it and re-render anyway, so skip straight
// to createRoot for those.
if (rootEl.childElementCount > 0 && !document.getElementById('app-splash')) {
  hydrateRoot(rootEl, appTree, errorHooks);
} else {
  createRoot(rootEl, errorHooks).render(appTree);
}
