import { test, expect } from "@playwright/test";
import { loginAndGoto } from "./helpers/auth";

// UX-Nav Phase 2C — Profile → Account Workspace. Verifies the 6-tab IA, deep
// links, legacy redirects, Back/Forward, keyboard nav, and console cleanliness.
// Requires TEST_EMAIL / TEST_PASSWORD in .env.test and a BASE_URL serving the
// new build (e.g. `vite preview` + BASE_URL=http://localhost:4173).

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "enrollment", label: "Enrollment" },
  { key: "referral", label: "Referral" },
  { key: "preferences", label: "Preferences" },
  { key: "membership", label: "Membership" },
  { key: "account", label: "Account" },
];

// Pre-existing env/backend noise on the local preview (no prod keys): blocked
// analytics, Supabase 4xx, and the getXpBalance RPC. We assert only that Phase
// 2C introduces no NEW app/React errors, ignoring these.
const BENIGN = [
  /Failed to load resource/i,
  /getXpBalance/i,
  /PGRST/i,
  /analytics|posthog|clarity/i,
];
const isAppError = (t: string) => !BENIGN.some((re) => re.test(t));

test.describe("Profile Account Workspace", () => {
  test("all six tabs load and are reachable by click", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await loginAndGoto(page, "/profile");
    await expect(page.getByRole("tablist", { name: /account workspace/i })).toBeVisible();

    for (const t of TABS) {
      await page.getByRole("tab", { name: t.label }).click();
      await expect(page.getByRole("tab", { name: t.label })).toHaveAttribute("aria-selected", "true");
      if (t.key !== "overview") {
        await expect(page).toHaveURL(new RegExp(`tab=${t.key}`));
      }
    }

    const appErrors = errors.filter(isAppError);
    expect(appErrors, `app console errors: ${appErrors.join("\n")}`).toEqual([]);
  });

  test("deep links land on the correct tab", async ({ page }) => {
    // Authenticate once; the session persists so we can hit deep links directly
    // (the auth helper matches on pathname only, so it can't carry a ?query).
    await loginAndGoto(page, "/profile");
    for (const t of TABS.filter((x) => x.key !== "overview")) {
      await page.goto(`/profile?tab=${t.key}`);
      await expect(page.getByRole("tab", { name: t.label })).toHaveAttribute("aria-selected", "true");
    }
  });

  test("legacy routes redirect into the workspace", async ({ page }) => {
    await loginAndGoto(page, "/learning-context");
    await expect(page).toHaveURL(/tab=enrollment/);
    await expect(page.getByRole("tab", { name: "Enrollment" })).toHaveAttribute("aria-selected", "true");

    await page.goto("/referral");
    await expect(page).toHaveURL(/tab=referral/);
    await expect(page.getByRole("tab", { name: "Referral" })).toHaveAttribute("aria-selected", "true");
  });

  test("browser Back/Forward walks the tab history", async ({ page }) => {
    await loginAndGoto(page, "/profile");
    await page.getByRole("tab", { name: "Membership" }).click();
    await expect(page).toHaveURL(/tab=membership/);
    await page.getByRole("tab", { name: "Account" }).click();
    await expect(page).toHaveURL(/tab=account/);

    await page.goBack();
    await expect(page).toHaveURL(/tab=membership/);
    await page.goForward();
    await expect(page).toHaveURL(/tab=account/);
  });

  test("arrow keys move between tabs (roving tabindex)", async ({ page }) => {
    await loginAndGoto(page, "/profile");
    await page.getByRole("tab", { name: "Overview" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Enrollment" })).toHaveAttribute("aria-selected", "true");
  });

  test("mobile viewport keeps tabs reachable without horizontal page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndGoto(page, "/profile");
    await expect(page.getByRole("tablist", { name: /account workspace/i })).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
