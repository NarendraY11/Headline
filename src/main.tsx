// Tiny entry chunk. The goal here is to keep top-level evaluation cheap so the
// browser can paint the prerendered hero (the LCP element) before any heavy JS
// runs. Critical CSS stays static (it must be in the initial render-blocking
// stylesheet); everything expensive — Sentry, the App route tree, providers —
// lives in ./mountApp and is dynamically imported AFTER first paint.
import '@fontsource/geist-sans/300.css';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './index.css';
import { initPostHog } from './lib/posthog';

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

// Prerendered route: #root already holds real React-committed markup (and no
// #app-splash shell), so we hydrate. Otherwise (dev server / uncovered route)
// #root is just the splash shell and we mount fresh. mountApp re-applies this
// distinction; we only need it here to decide whether to yield a paint first.
const shouldHydrate = rootEl.childElementCount > 0 && !document.getElementById('app-splash');

// Importing ./mountApp downloads AND evaluates the heavy app graph (React,
// motion, supabase, the route tree) — that evaluation is the ~550ms task that
// blocks first paint. It must run AFTER the browser has painted the prerendered
// hero, and crucially in a separate macrotask: import().then() resolves on the
// microtask queue, which the browser drains before it commits a paint, so a
// plain rAF (or double-rAF) still lets the eval starve the paint. rAF gets us to
// the frame boundary; setTimeout(0) then defers the import to a fresh macrotask,
// which yields to rendering first. Net: prerendered LCP paints (~250ms), THEN
// the graph loads and hydrates. Nothing mutates #root in the gap, so there's no
// hydration mismatch; only interactivity is deferred (prerendered <a> links work
// natively meanwhile).
const boot = () =>
  import('./mountApp').then((m) => m.mountApp(rootEl, shouldHydrate));

if (shouldHydrate) {
  requestAnimationFrame(() => setTimeout(boot, 0));
} else {
  // Dev / non-prerendered routes: #root is just the splash shell, nothing to
  // paint early, so mount as soon as the graph loads.
  boot();
}
