// =====================================================================
// Phase B smoke test: Quiz finish flow (answer → submit → results).
// Validates the finishQuiz() 300-line monster doesn't throw on happy path.
// =====================================================================

import { test, expect } from "@playwright/test";

test.describe("Quiz Finish Flow", () => {
  test("quiz results page renders after answering questions", async ({ page }) => {
    // Start a practice quiz (no auth required for practice mode with static questions).
    await page.goto("/quiz?mode=practice&count=5");

    // Wait for first question to load.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 5000 });

    // Answer 5 questions (click any choice, then Next/Submit).
    for (let i = 0; i < 5; i++) {
      const choices = page.getByRole("button", { name: /^[A-D]\)/ });
      await choices.first().click();

      const nextOrSubmit = page.getByRole("button", { name: /(next question|submit quiz)/i });
      await nextOrSubmit.click();
    }

    // Results page should render (score card, percentage, pass/fail).
    await expect(page.getByText(/your score|results|quiz complete/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/\d+%|\d+\/\d+/)).toBeVisible();
  });

  // Full coverage (timed mode, auth, XP ledger, mission completion, adaptive
  // regen) requires test users + seeded questions. This smoke layer only
  // validates the finish-and-render path doesn't crash.
});
