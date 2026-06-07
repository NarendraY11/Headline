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
// SpeedInsights is lazy + idle-mounted (below) so it never competes with first
// paint. Lazy import keeps it out of the entry chunk.
const SpeedInsights = lazy(() =>
  import("@vercel/speed-insights/react").then((m) => ({ default: m.SpeedInsights }))
);

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
              <Suspense fallback={null}>
                <SpeedInsights />
              </Suspense>
            </LoadingProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </FeatureFlagsProvider>
  </StrictMode>,
);
