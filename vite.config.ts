import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import Beasties from 'beasties';

function beastiesPlugin() {
  return {
    name: 'beasties',
    apply: 'build',
    async closeBundle() {
      const fs = await import('fs/promises');
      const htmlPath = path.resolve(process.cwd(), 'dist/index.html');
      
      try {
        const html = await fs.readFile(htmlPath, 'utf8');
        const beasties = new Beasties({
          path: path.resolve(process.cwd(), 'dist'),
          publicPath: '/',
          pruneSource: false,
        });
        const processedHtml = await beasties.process(html);
        await fs.writeFile(htmlPath, processedHtml);
      } catch (e) {
        console.warn('Beasties failed during closeBundle:', e);
      }
    }
  };
}


export default defineConfig(() => {
  return {
    define: {
      '__APP_VERSION__': JSON.stringify(
        process.env.npm_package_version || '1.0.0'
      )
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
      beastiesPlugin() as any,
      ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.json', template: 'raw-data' }) as any] : []),
      VitePWA({
        registerType: 'autoUpdate',
        // New builds activate immediately so users never get stuck on a stale
        // precached shell (important given the prerender + esbuild server pipeline).
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'offline.html'],
        manifest: {
          name: 'Heading — Pilot Exam Prep',
          short_name: 'Heading',
          description:
            'Premium pilot exam preparation — realistic DGCA, EASA & A320 mock exams, study diagnostics, and analytics.',
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
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          // Some vendor chunks (recharts/motion) are large; lift the precache cap.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // App shell: SPA navigations fall back to the precached index.html so
          // routes work offline. Never hijack API / SEO endpoints.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
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
