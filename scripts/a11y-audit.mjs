import { chromium } from 'playwright';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';
const BASE = 'http://localhost:5173';

async function axeRun(page) {
  // inject only once; subsequent calls reuse the global
  try {
    await page.evaluate(() => { if (typeof window.axe === 'undefined') throw new Error('no axe'); });
  } catch (_) {
    await page.addScriptTag({ url: AXE_CDN });
    await page.waitForFunction(() => typeof window.axe !== 'undefined', { timeout: 10000 });
  }
  return page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }
    })
  );
}

function print(label, violations) {
  process.stdout.write('\n=== ' + label + ' ===\n');
  if (!violations.length) { process.stdout.write('PASS: 0 violations\n'); return 0; }
  let count = 0;
  for (const v of violations) {
    count++;
    const impact = (v.impact || 'unknown').toUpperCase();
    process.stdout.write('[' + impact + '] [' + v.id + '] ' + v.description + '\n');
    for (const node of v.nodes.slice(0, 3)) {
      process.stdout.write('  target: ' + node.target.join(' > ') + '\n');
      if (node.failureSummary) process.stdout.write('  fix: ' + node.failureSummary.split('\n')[0] + '\n');
    }
    if (v.nodes.length > 3) process.stdout.write('  ...+' + (v.nodes.length - 3) + ' more\n');
  }
  return count;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let total = 0;

  // Load home once — stay on this page for all audits
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. Home (no modal)
  let r = await axeRun(page);
  total += print('Home (public, no modal)', r.violations);

  // 2. Sign In modal
  const btns = await page.locator('button, a').filter({ hasText: /^sign in$/i }).all();
  if (btns.length) {
    await btns[0].click();
    await page.waitForTimeout(700);
    r = await axeRun(page);
    total += print('Auth Modal – Sign In tab', r.violations);
  }

  // 3. Sign Up tab (within open modal)
  const signupTab = page.locator('[role="tab"]').filter({ hasText: /sign up/i });
  if (await signupTab.count()) {
    await signupTab.first().click();
    await page.waitForTimeout(400);
    r = await axeRun(page);
    total += print('Auth Modal – Sign Up tab', r.violations);
  }

  // 4. Forgot Password tab
  const forgotLink = page.locator('button').filter({ hasText: /forgot/i });
  if (await forgotLink.count()) {
    await forgotLink.first().click();
    await page.waitForTimeout(400);
    r = await axeRun(page);
    total += print('Auth Modal – Forgot Password', r.violations);
  }

  await browser.close();
  process.stdout.write('\nTotal violation categories: ' + total + '\n');
}

main().catch(e => { console.error(e.message); process.exit(1); });
