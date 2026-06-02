import { Page, expect } from "@playwright/test";

/**
 * Logs in through the AuthModal and lands on the requested protected route.
 *
 * Visiting a protected route while logged out makes AuthGuard redirect home
 * and auto-open the sign-in modal; after a successful sign-in the
 * AuthModalTrigger restores the originally requested path.
 */
export async function loginAndGoto(page: Page, path: string) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_EMAIL and TEST_PASSWORD must be set (see .env.test.example)."
    );
  }

  await page.goto(path);

  // The sign-in modal opens automatically via AuthGuard.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.locator('input[type="email"]').fill(email);
  await dialog.locator('input[type="password"]').first().fill(password);
  await dialog.getByRole("button", { name: "Sign In", exact: true }).click();

  // Modal closes and we are redirected back to the protected path.
  await expect(dialog).toBeHidden();
  await page.waitForURL((url) => url.pathname.startsWith(path), { timeout: 20_000 });
}
