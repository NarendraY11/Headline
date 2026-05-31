import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
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
    plugins: [react(), tailwindcss(), beastiesPlugin() as any],
    build: {
      target: "esnext",
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['motion/react'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-recharts': ['recharts']
          }
        }
      }
    }
  };
});
