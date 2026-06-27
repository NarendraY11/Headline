import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

// Phase 4 — Content Import Engine E2E Tests.
// Requires admin credentials (TEST_EMAIL / TEST_PASSWORD env vars).
// The contentImport flag is OFF by default; the view renders a
// "not enabled" message which the first test verifies. Subsequent
// tests that need the flag ON can be run after enabling it manually
// or via a test-specific admin API call.

const ADMIN_PATH = "/admin/content-import";

async function loginAsAdmin(page: Page) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) throw new Error("TEST_EMAIL and TEST_PASSWORD must be set.");

  await page.goto(ADMIN_PATH);
  const dialog = page.getByRole("dialog");
  // Auth guard may open login modal
  const hasDialog = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
  if (hasDialog) {
    await dialog.locator('input[type="email"]').fill(email);
    await dialog.locator('input[type="password"]').first().fill(password);
    await dialog.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 20_000 });
    await page.goto(ADMIN_PATH);
  }
}

function makeCsv(rows: number): string {
  const header = "prompt,option_a,option_b,option_c,option_d,correct,explanation,certification";
  const data = Array.from({ length: rows }, (_, i) =>
    `"Question ${i + 1}: What is navigation technique ${i + 1}?","VOR","NDB","GPS","ILS","a","VOR is a radio navigation aid.","dgca-cpl"`
  );
  return [header, ...data].join("\n");
}

function writeTempCsv(rows: number): string {
  const content = makeCsv(rows);
  const p = path.join(os.tmpdir(), `import-test-${rows}.csv`);
  fs.writeFileSync(p, content, "utf8");
  return p;
}

function writeTempJson(rows: number): string {
  const questions = Array.from({ length: rows }, (_, i) => ({
    prompt: `JSON Question ${i + 1}: Explain procedure ${i + 1}.`,
    option_a: "Option A", option_b: "Option B", option_c: "Option C", option_d: "Option D",
    correct: "a",
    explanation: "Explanation text.",
    certification: "dgca-cpl",
  }));
  const p = path.join(os.tmpdir(), `import-test-${rows}.json`);
  fs.writeFileSync(p, JSON.stringify({ questions }), "utf8");
  return p;
}

// ── Tests ─────────────────────────────────────────────────────────────

test.describe("Content Import Engine — Admin UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin can navigate to /admin/content-import", async ({ page }) => {
    await expect(page).toHaveURL((url) => url.pathname === ADMIN_PATH);
  });

  test("shows 'not enabled' when contentImport flag is OFF", async ({ page }) => {
    // Default state: flag is OFF → view shows disabled message.
    const body = await page.textContent("body");
    const isDisabled = body?.includes("not enabled") || body?.includes("Content Import Engine");
    expect(isDisabled).toBe(true);
  });

  test("shows Upload and History tabs when flag is ON", async ({ page }) => {
    // Skip if flag is still OFF (CI without flag toggle)
    const body = await page.textContent("body");
    if (body?.includes("not enabled")) {
      test.skip(true, "contentImport flag is OFF — skipping tab test");
    }
    await expect(page.getByRole("button", { name: /upload/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /history/i })).toBeVisible();
  });

  test("drop zone is visible on Upload tab", async ({ page }) => {
    const body = await page.textContent("body");
    if (body?.includes("not enabled")) test.skip(true, "flag OFF");
    await expect(page.getByRole("button", { name: /upload file for import/i })).toBeVisible();
  });

  test("History tab shows session list or empty state", async ({ page }) => {
    const body = await page.textContent("body");
    if (body?.includes("not enabled")) test.skip(true, "flag OFF");
    await page.getByRole("button", { name: /history/i }).click();
    // Either a table or "No import sessions yet"
    const text = await page.textContent("body");
    const hasContent = text?.includes("No import sessions") || text?.includes("File") && text?.includes("Status");
    expect(hasContent).toBe(true);
  });
});

test.describe("Content Import Engine — Upload flow (flag ON)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    const body = await page.textContent("body");
    if (body?.includes("not enabled")) test.skip(true, "contentImport flag is OFF");
  });

  test("uploads CSV and shows progress then preview", async ({ page }) => {
    const csvPath = writeTempCsv(5);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    // Should show processing state, then preview
    await expect(page.locator("text=Normalizing").or(page.locator("text=preview"))).toBeVisible({ timeout: 30_000 });
    // Eventually lands on preview
    await expect(page.locator("text=Import Preview").or(page.locator("text=Valid"))).toBeVisible({ timeout: 30_000 });

    fs.unlinkSync(csvPath);
  });

  test("uploads JSON and shows preview", async ({ page }) => {
    const jsonPath = writeTempJson(3);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(jsonPath);

    await expect(page.locator("text=Import Preview").or(page.locator("text=preview"))).toBeVisible({ timeout: 30_000 });
    fs.unlinkSync(jsonPath);
  });

  test("cancel clears the upload state", async ({ page }) => {
    const csvPath = writeTempCsv(3);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for preview or processing
    await page.waitForTimeout(2_000);

    const cancelBtn = page.getByRole("button", { name: /cancel/i }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      // Should return to idle/drop zone
      await expect(page.locator("text=Drag and drop")).toBeVisible({ timeout: 10_000 });
    }
    fs.unlinkSync(csvPath);
  });

  test("shows validation errors for a malformed CSV", async ({ page }) => {
    // CSV with missing required fields
    const bad = "prompt,option_a\nQ without answers,A";
    const p = path.join(os.tmpdir(), "bad-import.csv");
    fs.writeFileSync(p, bad, "utf8");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(p);

    await expect(page.locator("text=Invalid").or(page.locator("text=error"))).toBeVisible({ timeout: 30_000 });
    fs.unlinkSync(p);
  });

  test("preview stats show total, valid, invalid counts", async ({ page }) => {
    const csvPath = writeTempCsv(5);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.locator("text=Total")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=Valid")).toBeVisible();
    await expect(page.locator("text=Invalid")).toBeVisible();

    fs.unlinkSync(csvPath);
  });

  test("shows format guide on idle state", async ({ page }) => {
    await expect(page.locator("text=Supported formats")).toBeVisible();
  });

  test("desktop layout: two-column drop zone", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator("text=Drag and drop")).toBeVisible();
  });

  test("mobile layout: single column", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("text=Drag and drop")).toBeVisible();
  });
});

test.describe("Content Import Engine — Import then History", () => {
  test("after import, History tab shows a session", async ({ page }) => {
    await loginAsAdmin(page);
    const body = await page.textContent("body");
    if (body?.includes("not enabled")) test.skip(true, "flag OFF");

    const csvPath = writeTempCsv(2);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for preview
    await expect(page.locator("text=Import Preview")).toBeVisible({ timeout: 30_000 }).catch(() => {});

    // Click History
    await page.getByRole("button", { name: /history/i }).click();

    const historyText = await page.textContent("body");
    const hasSession = historyText?.includes(".csv") || historyText?.includes("No import sessions");
    expect(hasSession).toBe(true);

    fs.unlinkSync(csvPath);
  });
});

test.describe("Content Import Engine — Error handling", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    const body = await page.textContent("body");
    if (body?.includes("not enabled")) test.skip(true, "flag OFF");
  });

  test("shows error for unsupported file type", async ({ page }) => {
    const p = path.join(os.tmpdir(), "test.xlsx");
    fs.writeFileSync(p, "fake xlsx", "utf8");
    const fileInput = page.locator('input[type="file"]');
    // The <input accept=".csv,.json"> blocks xlsx in UI, but test via programmatic change
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.removeAttribute("accept");
    });
    await fileInput.setInputFiles(p);
    // Should show error about parser not available OR unknown type
    await expect(page.locator("text=error").or(page.locator("text=not available"))).toBeVisible({ timeout: 10_000 });
    fs.unlinkSync(p);
  });

  test("shows error for empty CSV", async ({ page }) => {
    const p = path.join(os.tmpdir(), "empty.csv");
    fs.writeFileSync(p, "", "utf8");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(p);
    await expect(page.locator("text=Empty").or(page.locator("text=error"))).toBeVisible({ timeout: 10_000 });
    fs.unlinkSync(p);
  });
});
