// Apply the persisted theme BEFORE first paint. Without this the `dark` class
// is only added later by a React effect (and only when the toggle mounts),
// causing a flash of the wrong theme + layout/contrast shift (CLS) on load.
//
// Externalized (was an inline <script> in index.html) so the production CSP can
// drop `script-src 'unsafe-inline'` — a same-origin `'self'` script needs no
// inline allowance and no per-file hash to maintain.
(function () {
  try {
    if (localStorage.getItem('heading_theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
