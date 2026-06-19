// Comprehensive WCAG 2.2 axe-core sweep. Public + auth-modal + logged-in routes.
// ponytail: CDN-injected axe (no dep add); login via /login form.
import { chromium } from 'playwright';

const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;

const PUBLIC = ['/', '/about', '/pricing', '/blog', '/contact', '/privacy', '/a320-systems'];
const AUTHED = ['/dashboard', '/modules', '/mock-exams', '/profile', '/bookmarks', '/qotd'];

async function axeRun(page) {
  try { await page.evaluate(() => { if (!window.axe) throw 0; }); }
  catch { await page.addScriptTag({ url: AXE }); await page.waitForFunction(() => !!window.axe, { timeout: 10000 }); }
  return page.evaluate(() => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
  }));
}

const all = []; // {route, id, impact, desc, tags, nodes:[targets], summary}
function collect(route, violations) {
  let n = 0;
  for (const v of violations) {
    n += v.nodes.length;
    all.push({
      route, id: v.id, impact: v.impact || 'minor', desc: v.description,
      tags: v.tags.filter(t => t.startsWith('wcag')).join(','),
      nodes: v.nodes.slice(0, 5).map(x => x.target.join(' ')),
      count: v.nodes.length,
      summary: v.nodes[0]?.failureSummary?.split('\n').slice(0, 2).join(' ') || ''
    });
  }
  process.stdout.write(`  ${route.padEnd(16)} ${violations.length} rules / ${n} nodes\n`);
  return n;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  const page = await ctx.newPage();

  process.stdout.write('\n--- PUBLIC ROUTES ---\n');
  for (const r of PUBLIC) {
    try {
      await page.goto(BASE + r, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1800);
      collect(r, (await axeRun(page)).violations);
    } catch (e) { process.stdout.write(`  ${r} ERROR ${e.message}\n`); }
  }

  process.stdout.write('\n--- AUTH MODAL / LOGIN ---\n');
  try {
    await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    collect('/login', (await axeRun(page)).violations);
  } catch (e) { process.stdout.write(`  /login ERROR ${e.message}\n`); }

  if (EMAIL && PASS) {
    process.stdout.write('\n--- AUTHED ROUTES ---\n');
    try {
      await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.locator('input[type="email"]').first().fill(EMAIL);
      await page.locator('input[type="password"]').first().fill(PASS);
      await page.locator('button', { hasText: /sign in|log in/i }).first().click();
      await page.waitForTimeout(4000);
      process.stdout.write(`  login -> ${page.url()}\n`);
      for (const r of AUTHED) {
        try {
          await page.goto(BASE + r, { waitUntil: 'load', timeout: 30000 });
          await page.waitForTimeout(2000);
          collect(r, (await axeRun(page)).violations);
        } catch (e) { process.stdout.write(`  ${r} ERROR ${e.message}\n`); }
      }
    } catch (e) { process.stdout.write(`  LOGIN FAILED ${e.message}\n`); }
  } else {
    process.stdout.write('\n--- AUTHED ROUTES SKIPPED (no creds) ---\n');
  }

  await browser.close();

  const W = { critical: 10, serious: 6, moderate: 3, minor: 1 };
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const byRule = {};
  let penalty = 0;
  for (const v of all) {
    byImpact[v.impact] = (byImpact[v.impact] || 0) + v.count;
    byRule[v.id] = (byRule[v.id] || 0) + v.count;
    penalty += (W[v.impact] || 1) * v.count;
  }
  const score = Math.max(0, 100 - penalty);

  process.stdout.write('\n========== SUMMARY ==========\n');
  process.stdout.write(`Routes audited: ${PUBLIC.length + 1 + (EMAIL && PASS ? AUTHED.length : 0)}\n`);
  process.stdout.write(`Impact: critical=${byImpact.critical} serious=${byImpact.serious} moderate=${byImpact.moderate} minor=${byImpact.minor}\n`);
  process.stdout.write(`Weighted penalty: ${penalty}  =>  SCORE: ${score}/100\n`);
  process.stdout.write('\n--- DISTINCT RULES ---\n');
  for (const [id, c] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    const ex = all.find(v => v.id === id);
    process.stdout.write(`[${ex.impact.toUpperCase()}] ${id} (${c}x) ${ex.tags}\n  ${ex.desc}\n  e.g. ${ex.route}: ${ex.nodes[0]}\n`);
  }
  process.stdout.write('\nJSON_START\n' + JSON.stringify({ score, byImpact, byRule, findings: all }) + '\nJSON_END\n');
}
main().catch(e => { console.error(e.message); process.exit(1); });
