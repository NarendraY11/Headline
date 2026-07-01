import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load test credentials from .env.test (kept out of git).
dotenv.config({ path: ".env.test" });

// E2E config. BASE_URL resolution order:
//   1. BASE_URL env var (CI, preview, or explicit override)
//   2. APP_URL from .env.test (set this for local dev)
//   3. http://localhost:5173 (Vite default — requires `vite dev` running)
// Production URL is NOT a fallback; tests must be explicitly pointed there.
const BASE_URL =
  process.env.BASE_URL ||
  process.env.APP_URL ||
  "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
