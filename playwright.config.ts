import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load test credentials from .env.test (kept out of git).
dotenv.config({ path: ".env.test" });

// E2E config. Target defaults to the live production site; override with
// BASE_URL to point at a preview deploy or local server. Auth credentials
// come from env (see .env.test.example) — never hardcode them.
const BASE_URL = process.env.BASE_URL || "https://www.heading380.in";

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
