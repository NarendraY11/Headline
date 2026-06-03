import { test, expect } from "@playwright/test";
import { loginAndGoto } from "./helpers/auth";

// Verifies instant single-device enforcement (PR #28): when a second device
// logs into the same account, it overwrites the single active_sessions row and
// Supabase Realtime should evict the first device near-instantly. The first
// device's logout() redirects to "/", so a return to the home path is the
// reliable eviction signal.
//
// Two browser contexts = two isolated localStorages = two distinct
// client_session_id values, i.e. two "devices".
test("second-device login evicts the first device", async ({ browser }) => {
  // Device A: sign in and land on a protected route.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  pageA.on("console", (m) => console.log(`[A console] ${m.type()}: ${m.text()}`));
  await loginAndGoto(pageA, "/today");
  await expect(pageA).toHaveURL(/\/today/);

  // Device B: sign in with the same account -> overwrites the session slot.
  const ctxB = await browser.newContext();
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
