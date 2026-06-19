import { defineConfig } from "vitest/config";
import path from "path";

// Unit/integration test runner. Kept separate from vite.config.ts so the build
// pipeline (PWA, sitemap, font-preload, sentry plugins) never loads under test.
// E2E (Playwright) lives in tests/e2e and is run via `npm run test:e2e`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    // E2E specs use @playwright/test, not vitest — never collect them here.
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
});
