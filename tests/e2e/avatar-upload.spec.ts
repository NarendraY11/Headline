import { test, expect } from "@playwright/test";
import { loginAndGoto } from "./helpers/auth";

// Verifies the avatar upload validation shipped in PR #5:
// reject non-image MIME types, reject files > 5 MB, accept a valid image.
// The file input is hidden (triggered by a button) but Playwright can set
// files on it directly. Files are built in-memory — no fixtures on disk.

// Minimal valid 1x1 PNG.
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const fileInput = (page: import("@playwright/test").Page) =>
  page.locator('input[type="file"]');

test.beforeEach(async ({ page }) => {
  await loginAndGoto(page, "/profile");
});

test("rejects a non-image file type", async ({ page }) => {
  await fileInput(page).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(page.getByText(/Unsupported file type/i)).toBeVisible();
});

test("rejects an oversized image (> 5 MB)", async ({ page }) => {
  await fileInput(page).setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024, 1), // 6 MB
  });

  await expect(page.getByText(/Maximum size is 5 MB/i)).toBeVisible();
});

test("accepts a valid image under 5 MB", async ({ page }) => {
  await fileInput(page).setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: VALID_PNG,
  });

  // No validation error should appear for a valid image.
  await expect(page.getByText(/Unsupported file type/i)).toHaveCount(0);
  await expect(page.getByText(/Maximum size is 5 MB/i)).toHaveCount(0);
});
