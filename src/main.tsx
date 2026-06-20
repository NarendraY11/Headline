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
import {createRoot} from 'react-dom/client';
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

// Delay Clarity past first paint. Using setTimeout(3000) instead of
// requestIdleCallback: rIC fires during React's first commit phase which still
// races the LCP element. A fixed 3s delay ensures Clarity's chunk download
// never lands in the critical network chain.
setTimeout(() => {
  import('@microsoft/clarity').then(({ default: Clarity }) => {
    Clarity.init('x8h37kdqmc');
  });
}, 3000);

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

createRoot(document.getElementById('root')!, {
  // React 19 error hooks → Sentry (complements the in-app ErrorBoundary).
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
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
  </StrictMode>,
);
