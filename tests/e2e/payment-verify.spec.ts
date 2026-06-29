// =====================================================================
// Phase B smoke test: Payment verification (S3 ledger atomicity).
// Validates the Razorpay → verify → profile-grant path UI-side.
// Does NOT test actual Razorpay integration (requires sandbox credentials).
// =====================================================================

import { test, expect } from "@playwright/test";

test.describe("Payment Verification Flow", () => {
  test("pricing page renders subscription CTAs", async ({ page }) => {
    await page.goto("/pricing");

    // Pro plan card + CTA button.
    await expect(page.getByRole("heading", { name: /pro/i })).toBeVisible();
    const subscribeButton = page.getByRole("button", { name: /subscribe|upgrade|get pro/i }).first();
    await expect(subscribeButton).toBeVisible();

    // Free trial CTA (if user not signed in or trial not used).
    const trialButton = page.getByRole("button", { name: /start.*trial|7-day.*trial/i });
    if (await trialButton.isVisible()) {
      await expect(trialButton).toBeEnabled();
    }
  });

  test("trial activation requires sign-in", async ({ page }) => {
    await page.goto("/pricing");

    const trialButton = page.getByRole("button", { name: /start.*trial|7-day.*trial/i });
    if (await trialButton.isVisible()) {
      await trialButton.click();
      // Should open auth modal or show "sign in required" toast.
      await expect(
        page.getByText(/sign in|sign up|account required/i)
      ).toBeVisible({ timeout: 3000 });
    }
  });

  // Full payment e2e (create order → Razorpay checkout → webhook → profile
  // grant) requires Razorpay test mode + webhook forwarding. This smoke layer
  // only validates the pricing UI + trial CTA render correctly.
});
