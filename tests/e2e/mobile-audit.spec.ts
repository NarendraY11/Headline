/**
 * Mobile audit — screenshot capture only.
 * Captures Today, drawer open, bottom nav visible at all target viewports.
 */
import { test } from "@playwright/test";
import { loginAndGoto } from "./helpers/auth";

const VIEWPORTS = [
  { name: "360", w: 360, h: 780 },
  { name: "375", w: 375, h: 812 },
  { name: "390", w: 390, h: 844 },
  { name: "412", w: 412, h: 915 },
  { name: "430", w: 430, h: 932 },
];

for (const vp of VIEWPORTS) {
  test(`today-${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await loginAndGoto(page, "/today");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `tests/screenshots/mobile-audit/today-${vp.name}.png`, fullPage: false });
  });

  test(`today-fullpage-${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await loginAndGoto(page, "/today");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `tests/screenshots/mobile-audit/today-fullpage-${vp.name}.png`, fullPage: true });
  });

  test(`drawer-${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await loginAndGoto(page, "/today");
    await page.waitForLoadState("networkidle");
    // Open drawer via hamburger
    const hamburger = page.getByRole("button", { name: /menu|open/i }).first();
    if (await hamburger.isVisible()) await hamburger.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `tests/screenshots/mobile-audit/drawer-${vp.name}.png`, fullPage: false });
  });
}

// Landscape
test("today-390-landscape", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await loginAndGoto(page, "/today");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/screenshots/mobile-audit/today-390-landscape.png", fullPage: false });
});
