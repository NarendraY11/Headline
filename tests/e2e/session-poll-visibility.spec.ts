/**
 * Verifies the session-poll visibility + online gating added in:
 *   perf(auth): gate session poll on tab visibility and online state
 *
 * Approach:
 *  - Runs against localhost:3000 (server.ts: Express + Vite middleware, all APIs live).
 *  - Uses page.route() to intercept /api/session/check so responses are
 *    controlled and request counts are authoritative, regardless of DB state.
 *  - Triggers runCheck via the `online` event (onOnline calls runCheck
 *    unconditionally) so we don't need real tab switching.
 *  - Uses Object.defineProperty to set document.visibilityState and
 *    navigator.onLine — runCheck reads these as plain properties, so the
 *    overrides are honored by the guards inside runCheck.
 *
 * Guard logic under test (AuthContext.tsx):
 *   runCheck() {
 *     if (document.visibilityState === 'hidden') return   // guard A
 *     if (navigator.onLine === false)           return   // guard B
 *     ... apiFetch('/api/session/check')                  // only if both pass
 *   }
 *   onOnline() { void runCheck() }   // always triggers runCheck (no pre-check)
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAndGoto } from "./helpers/auth";

const BASE = "http://localhost:3000";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Wait for the auth useEffect to register its listeners.
 *  registerActiveSession() writes client_session_id to localStorage
 *  synchronously before the Supabase upsert, so this is a reliable gate. */
async function waitForAuthEffect(page: Page) {
  await page.waitForFunction(
    () => localStorage.getItem("client_session_id") !== null,
    { timeout: 10_000 }
  );
}

/** Route /api/session/check to a controlled mock that counts calls. */
async function mockSessionCheck(page: Page, valid = true) {
  let count = 0;
  await page.route("**/api/session/check", (route) => {
    count++;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ valid }),
    });
  });
  return { getCount: () => count, reset: () => { count = 0; } };
}

/** Set document.visibilityState and navigator.onLine via defineProperty,
 *  then dispatch the `online` event to trigger onOnline → runCheck. */
async function triggerWithState(
  page: Page,
  opts: { visibility: "visible" | "hidden"; onLine: boolean }
) {
  await page.evaluate((o) => {
    Object.defineProperty(document, "visibilityState", {
      value: o.visibility, writable: true, configurable: true,
    });
    Object.defineProperty(navigator, "onLine", {
      value: o.onLine, writable: true, configurable: true,
    });
    window.dispatchEvent(new Event("online"));
  }, opts);
  // Allow async runCheck (supabase.auth.getSession + fetch) to complete
  await page.waitForTimeout(4000);
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

test.use({ baseURL: BASE });

test.describe("Session poll — visibility / online gating", () => {
  /**
   * TEST A — guard A: visible+online → runCheck fires, fetch is called.
   * Proves the normal (unguarded) path works end-to-end.
   */
  test("A: visible+online — runCheck fires session check", async ({ page }) => {
    await loginAndGoto(page, "/today");
    await waitForAuthEffect(page);

    const mock = await mockSessionCheck(page);
    await triggerWithState(page, { visibility: "visible", onLine: true });

    expect(mock.getCount(), "session/check should fire when visible+online").toBeGreaterThanOrEqual(1);
  });

  /**
   * TEST B — guard A: hidden+online → runCheck returns early, no fetch.
   */
  test("B: hidden tab — no session check fires", async ({ page }) => {
    await loginAndGoto(page, "/today");
    await waitForAuthEffect(page);

    const mock = await mockSessionCheck(page);
    await triggerWithState(page, { visibility: "hidden", onLine: true });

    expect(mock.getCount(), "no session/check while tab is hidden").toBe(0);
  });

  /**
   * TEST C — guard B: visible+offline → runCheck returns early, no fetch.
   */
  test("C: offline — no session check fires", async ({ page }) => {
    await loginAndGoto(page, "/today");
    await waitForAuthEffect(page);

    const mock = await mockSessionCheck(page);
    await triggerWithState(page, { visibility: "visible", onLine: false });

    expect(mock.getCount(), "no session/check while offline").toBe(0);
  });

  /**
   * TEST D — both guards fail: hidden+offline → no fetch.
   */
  test("D: hidden+offline — no session check fires", async ({ page }) => {
    await loginAndGoto(page, "/today");
    await waitForAuthEffect(page);

    const mock = await mockSessionCheck(page);
    await triggerWithState(page, { visibility: "hidden", onLine: false });

    expect(mock.getCount(), "no session/check when hidden AND offline").toBe(0);
  });

  /**
   * TEST E — inFlight guard: rapid-fire `online` events with visible+online
   * should produce at most 1 concurrent fetch (inFlight flag).
   */
  test("E: inFlight guard — rapid online events produce ≤1 concurrent check", async ({
    page,
  }) => {
    await loginAndGoto(page, "/today");
    await waitForAuthEffect(page);

    const mock = await mockSessionCheck(page);

    // Fire three online events synchronously — inFlight should collapse to 1
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible", writable: true, configurable: true,
      });
      Object.defineProperty(navigator, "onLine", {
        value: true, writable: true, configurable: true,
      });
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });
    await page.waitForTimeout(5000);

    expect(
      mock.getCount(),
      "inFlight guard should collapse 3 rapid triggers to 1 fetch"
    ).toBe(1);
  });

  /**
   * TEST F — cleanup: navigate SPA, then verify no duplicate listeners.
   * Duplicate listeners would produce >1 fetch per trigger.
   */
  test("F: no duplicate listeners after SPA navigation", async ({ page }) => {
    await loginAndGoto(page, "/today");
    await waitForAuthEffect(page);

    // Navigate within AppShell (AuthContext stays mounted)
    await page.goto(`${BASE}/analytics`);
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/today`);
    await page.waitForTimeout(500);

    const mock = await mockSessionCheck(page);
    await triggerWithState(page, { visibility: "visible", onLine: true });

    // Duplicate listeners would produce 2+; correct cleanup → 1
    expect(
      mock.getCount(),
      "exactly 1 session/check after navigation — no listener leak"
    ).toBe(1);
  });
});
