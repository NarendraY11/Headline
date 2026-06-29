// =====================================================================
// Phase B smoke test: Auth flow (sign-in, sign-up, password reset).
// Covers S1 (trial activation) + basic AuthModal/AuthContext correctness.
// =====================================================================

import { test, expect } from "@playwright/test";

test.describe("Auth Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("sign-up flow renders and validates", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.getByRole("button", { name: /sign up/i }).click();

    // Email + password fields present.
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i).first();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Submit without filling → validation errors.
    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await expect(page.getByText(/email.*required|please enter.*email/i)).toBeVisible({ timeout: 3000 });
  });

  test("sign-in flow renders", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("password reset flow renders", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.getByRole("button", { name: /forgot password/i }).click();

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  // Full e2e auth (sign-up → verify email → sign-in) requires a real Supabase
  // project or mocks. This smoke layer only verifies the UI renders + basic
  // client-side validation. Extend with test-user credentials when ready.
});
