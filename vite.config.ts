import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Inject <link rel=preload> for the above-the-fold fonts so the hero text is
// painted in the real face at FCP instead of swapping from a fallback (FOUT =
// layout shift). Only the latin-400-normal subset of the two hero families
// (geist-sans body, instrument-serif display); other weights/subsets still
// lazy-load via the stylesheet. Runs in closeBundle so the hashed filenames
// are known; the prerender step re-snapshots dist/index.html afterwards.
function fontPreloadPlugin() {
  const TARGETS = [/^geist-sans-latin-400-normal-.*\.woff2$/, /^instrument-serif-latin-400-normal-.*\.woff2$/];
  return {
    name: 'font-preload',
    apply: 'build' as const,
    async closeBundle() {
      const fs = await import('fs/promises');
      const distDir = path.resolve(process.cwd(), 'dist');
      try {
        const assets = await fs.readdir(path.join(distDir, 'assets'));
        const fonts = TARGETS.map(re => assets.find(f => re.test(f))).filter(Boolean) as string[];
        if (fonts.length === 0) return;
        const links = fonts
          .map(f => `    <link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${f}">`)
          .join('\n');
        const htmlPath = path.join(distDir, 'index.html');
        const html = await fs.readFile(htmlPath, 'utf8');
        if (html.includes('rel="preload" as="font"')) return; // idempotent
        await fs.writeFile(htmlPath, html.replace('</head>', `${links}\n  </head>`));
      } catch (e) {
        console.warn('font-preload plugin skipped:', e);
      }
    },
  };
}

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  return {
    // Strip debug logging from production bundles. console.warn/error are kept
    // for genuine diagnostics (and Sentry now captures errors); console.log/
    // info/debug + debugger are dropped. Dev (command='serve') is untouched.
    esbuild: isBuild
      ? { pure: ['console.log', 'console.info', 'console.debug'], drop: ['debugger'] }
      : {},
    define: {
      '__APP_VERSION__': JSON.stringify(
        process.env.npm_package_version || '1.0.0'
      ),
      // Sentry release: prefer the immutable Vercel commit SHA so every deploy
      // maps to an exact source revision; fall back to the package version (and
      // finally '0.0.0') for local/preview builds without the Vercel env.
      '__SENTRY_RELEASE__': JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.npm_package_version ||
        '0.0.0'
      ),
      // True only when building on Vercel infra (VERCEL=1 is a Vercel system
      // env var). Used to gate @vercel/speed-insights so it never renders during
      // local dev or the prerender step (where /_vercel/* paths don't exist).
      'import.meta.env.VITE_ON_VERCEL': JSON.stringify(!!process.env.VERCEL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    plugins: [
      react(),
      tailwindcss(),
      fontPreloadPlugin(),
      ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.json', template: 'raw-data' }) as any] : []),
      // Upload source maps to Sentry on prod builds when auth token is present.
      // Hidden source maps: build emits them but they are not served publicly.
      ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
      })] : []),
      VitePWA({
        registerType: 'autoUpdate',
        // New builds activate immediately so users never get stuck on a stale
        // precached shell (important given the prerender + esbuild server pipeline).
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'offline.html'],
        manifest: {
          id: '/',
          name: 'Heading — Pilot Exam Prep',
          short_name: 'Heading',
          description:
            'Premium pilot exam preparation — realistic DGCA, EASA & A320 mock exams, study diagnostics, and analytics.',
          lang: 'en',
          dir: 'ltr',
          categories: ['education', 'productivity'],
          theme_color: '#14305a',
          background_color: '#14305a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Long-press app-icon jump targets (Android/desktop PWA).
          shortcuts: [
            {
              name: "Today",
              short_name: "Today",
              description: "Your daily study dashboard",
              url: "/today",
              icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Mock Exams",
              short_name: "Mocks",
              description: "Launch a timed mock exam",
              url: "/mock-exams",
              icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Exam Centre",
              short_name: "Exams",
              description: "Adaptive mocks and DGCA simulator",
              url: "/exam-centre",
              icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Flight Schedule",
              short_name: "Schedule",
              description: "Your study mission calendar",
              url: "/schedule",
              icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          // Pull the Web Push handlers into the Workbox-generated SW. sw-push.js
          // lives in public/ so it ships to the site root next to the SW.
          importScripts: ['sw-push.js'],
          // Some vendor chunks (recharts/motion) are large; lift the precache cap.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // App shell: SPA navigations fall back to the precached index.html so
          // routes work offline. Never hijack API / SEO endpoints.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/llms\.txt$/],
          runtimeCaching: [
            // Supabase auth: NEVER cache tokens / session.
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith('.supabase.co') && url.pathname.includes('/auth/'),
              handler: 'NetworkOnly',
            },
            // Supabase data (REST/Realtime): Network First, short cache for offline reads.
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith('.supabase.co') && !url.pathname.includes('/auth/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-data',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Images & fonts: Stale While Revalidate.
            {
              urlPattern: ({ request }) =>
                request.destination === 'image' || request.destination === 'font',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: "esnext",
      // Hidden source maps: Sentry vite plugin uploads then strips the
      // sourceMappingURL comment so maps are never served to end users.
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            const n = id.replace(/\\/g, '/');
            // react/jsx-runtime MUST land with react. If left to rollup it gets
            // hoisted into whichever vendor chunk first imports it (was
            // vendor-motion), so every JSX component statically pulls that chunk
            // onto the critical path. Match react FIRST, before motion etc.
            if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(n)) return 'vendor-react';
            if (/\/node_modules\/(motion|framer-motion)\//.test(n)) return 'vendor-motion';
            if (n.includes('/node_modules/@supabase/')) return 'vendor-supabase';
            // Split Sentry into its own stable chunk: it was landing in the app
            // entry chunk, so every app-code deploy busted the ~30KB+ SDK cache.
            if (n.includes('/node_modules/@sentry/') || n.includes('/node_modules/@sentry-internal/')) return 'vendor-sentry';
            if (n.includes('/node_modules/recharts/')) return 'vendor-recharts';
            // d3 is only used by the lazy MasterySunburst (analytics route); keep
            // it isolated so it never leaks into the entry/critical chunk.
            if (/\/node_modules\/d3(-[a-z]+)?\//.test(n)) return 'vendor-d3';
            return undefined;
          }
        }
      }
    }
  };
});
