import { test, expect } from "@playwright/test";
import { loginAndGoto } from "./helpers/auth";

// Single-device enforcement, device identity = user-agent (option B).
//
// A genuinely different device (different UA) that logs into the same account
// overwrites the single active_sessions row and Supabase Realtime evicts the
// first device near-instantly. The first device's logout() redirects to "/",
// so a return to the home path is the reliable eviction signal.
//
// Two browser contexts = two isolated localStorages = two distinct
// client_session_id values. To represent two *devices* we must also give them
// distinct user-agents — same-UA contexts are treated as one device (PWA +
// browser on one phone) and must NOT evict each other.
const UA_DEVICE_B =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

test("different-device login evicts the first device", async ({ browser }) => {
  // Device A: sign in and land on a protected route.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  pageA.on("console", (m) => console.log(`[A console] ${m.type()}: ${m.text()}`));
  await loginAndGoto(pageA, "/today");
  await expect(pageA).toHaveURL(/\/today/);

  // Device B: a DIFFERENT device (distinct UA) signs in -> overwrites the slot.
  const ctxB = await browser.newContext({ userAgent: UA_DEVICE_B });
  const pageB = await ctxB.newPage();
  const tB = Date.now();
  await loginAndGoto(pageB, "/today");
  console.log(`[timing] device B logged in at +${Date.now() - tB}ms`);

  // Device A should be evicted: logout() sends it back to "/".
  // 40s window so the 30s poll fallback can also be observed if Realtime fails.
  const tEvict = Date.now();
  await expect
    .poll(() => new URL(pageA.url()).pathname, { timeout: 40_000, intervals: [500] })
    .toBe("/");
  console.log(`[timing] device A evicted at +${Date.now() - tEvict}ms after B login`);

  await ctxA.close();
  await ctxB.close();
});

test("same-device second context does NOT evict (PWA + browser)", async ({ browser }) => {
  // Device A: sign in and land on a protected route.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await loginAndGoto(pageA, "/today");
  await expect(pageA).toHaveURL(/\/today/);

  // Same physical device, second context (e.g. installed PWA): SAME default UA,
  // different localStorage -> different client_session_id. Must be tolerated.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await loginAndGoto(pageB, "/today");

  // Give Realtime + one 30s poll cycle a chance to (wrongly) fire, then assert
  // device A is still on the protected route.
  await pageA.waitForTimeout(35_000);
  expect(new URL(pageA.url()).pathname).toBe("/today");

  await ctxA.close();
  await ctxB.close();
});
