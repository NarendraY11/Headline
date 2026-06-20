// Phase 2-8: Authenticated audit after checking how login works
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:4174';
const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;
if (!EMAIL || !PASS) {
  console.error('Missing credentials: set TEST_EMAIL and TEST_PASSWORD env vars before running this audit.');
  process.exit(1);
}
const OUT = 'mobile-audit/playwright';
fs.mkdirSync(OUT, { recursive: true });

let issues = [];
let shots = 0;

async function ss(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true }).catch(e => console.warn('ss fail:', e.message));
  shots++;
}

async function checkOverflow(page, label) {
  const r = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const bad = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > cw + 4 && rect.width > 0) {
        bad.push({ tag: el.tagName, cls: String(el.className||'').slice(0,50), right: Math.round(rect.right), cw });
      }
    });
    return { hScroll: sw > cw, bad: bad.slice(0,5) };
  }).catch(() => ({ hScroll: false, bad: [] }));
  if (r.hScroll || r.bad.length) {
    issues.push({ sev: 'High', label, msg: 'Horizontal overflow', detail: JSON.stringify(r.bad) });
  }
}

async function checkTouchTargets(page, label) {
  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[href], [role="button"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
        out.push({ tag: el.tagName, text: String(el.textContent||'').trim().slice(0,30), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    return out.slice(0,8);
  }).catch(() => []);
  if (small.length) {
    issues.push({ sev: 'Medium', label, msg: `${small.length} touch targets < 40px`, detail: JSON.stringify(small) });
  }
}

async function doLogin(pg) {
  // Navigate to a protected route - auth guard will show modal/redirect
  await pg.goto(`${BASE}/today`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2000);

  // Try to dismiss cookie banner
  await pg.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (String(b.textContent).includes('Decline') || String(b.textContent).includes('decline')) b.click();
    });
  }).catch(() => {});
  await pg.waitForTimeout(500);

  // Check if email input visible - from auth modal or redirect
  let ef = pg.locator('input[type="email"]').first();
  let visible = await ef.isVisible().catch(() => false);

  if (!visible) {
    // Maybe on home page, open auth modal
    await pg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    // Click mobile menu
    const menuBtn = pg.locator('#mobile-menu-toggle');
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await pg.waitForTimeout(600);
    }
    // Click start/sign in
    const startBtn = pg.locator('button:has-text("Start studying")').first();
    const signInBtn = pg.locator('button:has-text("Sign in")').first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    } else if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click();
    }
    await pg.waitForTimeout(800);
    ef = pg.locator('input[type="email"]').first();
    visible = await ef.isVisible().catch(() => false);
  }

  if (!visible) {
    // Try /login route
    await pg.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    ef = pg.locator('input[type="email"]').first();
    visible = await ef.isVisible().catch(() => false);
  }

  if (visible) {
    await ef.fill(EMAIL);
    const pf = pg.locator('input[type="password"]').first();
    await pf.fill(PASS);
    const sb = pg.locator('button[type="submit"]').first();
    await sb.click();
    await pg.waitForTimeout(5000);
    console.log('Post-login URL:', pg.url());
    return true;
  }
  console.warn('Could not find login form');
  return false;
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// === Phase 2: Login flow ===
console.log('\nPhase 2: Login flow (iPhone 15)...');
const loginCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const loginPg = await loginCtx.newPage();

await loginPg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
await loginPg.waitForTimeout(1500);
await loginPg.evaluate(() => {
  document.querySelectorAll('button').forEach(b => { if (String(b.textContent).includes('Decline')) b.click(); });
}).catch(() => {});
await loginPg.waitForTimeout(400);
await ss(loginPg, 'P2_01_home_before_login');

// Open mobile menu
const menuBtn = loginPg.locator('#mobile-menu-toggle');
if (await menuBtn.isVisible().catch(() => false)) {
  await menuBtn.click();
  await loginPg.waitForTimeout(600);
  await ss(loginPg, 'P2_02_mobile_menu_open');
  await checkOverflow(loginPg, 'Mobile menu drawer');
}

// Click Start studying
const startBtn = loginPg.locator('button:has-text("Start studying")').first();
if (await startBtn.isVisible().catch(() => false)) {
  await startBtn.click();
  await loginPg.waitForTimeout(800);
  await ss(loginPg, 'P2_03_auth_modal_open');
  await checkOverflow(loginPg, 'Auth modal');
  await checkTouchTargets(loginPg, 'Auth modal');
}

const ef = loginPg.locator('input[type="email"]').first();
if (await ef.isVisible().catch(() => false)) {
  await ef.fill(EMAIL);
  const pf = loginPg.locator('input[type="password"]').first();
  await pf.fill(PASS);
  await ss(loginPg, 'P2_04_credentials_filled');

  // Check forgot password link
  const forgot = loginPg.locator('text=Forgot').first();
  const forgotVis = await forgot.isVisible().catch(() => false);
  console.log('Forgot password link visible:', forgotVis);

  const sb = loginPg.locator('button[type="submit"]').first();
  await sb.click();
  await loginPg.waitForTimeout(5000);
  await ss(loginPg, 'P2_05_after_login');
  console.log('Login URL:', loginPg.url());

  // Forgot password flow
  const menuBtn2 = loginPg.locator('#mobile-menu-toggle');
  if (await menuBtn2.isVisible().catch(() => false)) {
    await menuBtn2.click(); await loginPg.waitForTimeout(400);
    const signInBtn2 = loginPg.locator('button:has-text("Sign in")').first();
    if (await signInBtn2.isVisible().catch(() => false)) { await signInBtn2.click(); await loginPg.waitForTimeout(500); }
    const forgotLink = loginPg.locator('text=Forgot password').first();
    if (await forgotLink.isVisible().catch(() => false)) {
      await forgotLink.click();
      await loginPg.waitForTimeout(500);
      await ss(loginPg, 'P2_06_forgot_password_ui');
    }
  }
}
await loginCtx.close();

// === Phase 3: Authenticated – iPhone 15 ===
console.log('\nPhase 3: Authenticated routes (iPhone 15)...');
const authCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const authPg = await authCtx.newPage();
await doLogin(authPg);
const authedUrl = authPg.url();
console.log('Authenticated, URL:', authedUrl);
await ss(authPg, 'P3_00_authed');

const authRoutes = ['/today', '/modules', '/analytics', '/bookmarks', '/profile', '/study-plan', '/schedule', '/exam-centre', '/mock-exams', '/referral'];
for (const route of authRoutes) {
  await authPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await authPg.waitForTimeout(900);
  await ss(authPg, `P3${route.replace(/\//g, '_')}`);
  await checkOverflow(authPg, `iPhone15 ${route}`);
  await checkTouchTargets(authPg, `iPhone15 ${route}`);
  const len = await authPg.evaluate(() => document.body.innerText.length).catch(() => 0);
  if (len < 60) issues.push({ sev: 'High', label: `iPhone15 ${route}`, msg: 'Page blank / empty', detail: `len:${len}` });
}

// Bottom nav visibility
await authPg.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(600);
const bnav = authPg.locator('nav[aria-label="Bottom navigation"]');
const bnavVis = await bnav.isVisible().catch(() => false);
console.log('Bottom nav visible:', bnavVis);
if (!bnavVis) issues.push({ sev: 'High', label: 'BottomNav', msg: 'Not visible on mobile', detail: '' });
await ss(authPg, 'P3_bottom_nav');

// Mobile menu drawer (authenticated)
const mm = authPg.locator('#mobile-menu-toggle');
if (await mm.isVisible().catch(() => false)) {
  await mm.click();
  await authPg.waitForTimeout(500);
  await ss(authPg, 'P3_mobile_menu_auth');
  await checkOverflow(authPg, 'Mobile menu authed');
  await authPg.keyboard.press('Escape');
}

// Quiz flow
await authPg.goto(`${BASE}/modules`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(900);
const firstTopic = authPg.locator('a[href*="/topic/"]').first();
if (await firstTopic.isVisible().catch(() => false)) {
  const href = await firstTopic.getAttribute('href');
  console.log('Topic href:', href);
  await authPg.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await authPg.waitForTimeout(800);
  await ss(authPg, 'P3_quiz_topic');
  await checkOverflow(authPg, 'Topic detail');
  await checkTouchTargets(authPg, 'Topic detail');

  // Try starting quiz
  const qBtn = authPg.locator('button:has-text("Start"), button:has-text("Practice"), button:has-text("Quiz")').first();
  if (await qBtn.isVisible().catch(() => false)) {
    await qBtn.click();
    await authPg.waitForTimeout(2000);
    await ss(authPg, 'P3_quiz_active');
    await checkOverflow(authPg, 'Quiz active');
    await checkTouchTargets(authPg, 'Quiz active');
    // Try answering
    const choice = authPg.locator('button[data-choice], label:has-text("A)"), div.choice, button.answer-btn').first();
    if (await choice.isVisible().catch(() => false)) {
      await choice.click();
      await authPg.waitForTimeout(600);
      await ss(authPg, 'P3_quiz_answered');
    } else {
      const anyChoice = authPg.locator('button').nth(1);
      if (await anyChoice.isVisible().catch(() => false)) {
        await anyChoice.click();
        await authPg.waitForTimeout(600);
        await ss(authPg, 'P3_quiz_answered_fallback');
      }
    }
  }
}

// Settings overlay
await authPg.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(600);
const settingsIconBtn = authPg.locator('button[aria-label*="settings" i], .md\\:hidden button[aria-label]').first();
if (await settingsIconBtn.isVisible().catch(() => false)) {
  await settingsIconBtn.click();
  await authPg.waitForTimeout(600);
  await ss(authPg, 'P3_settings_overlay');
  await checkOverflow(authPg, 'Settings overlay');
  await authPg.keyboard.press('Escape');
}

// Notifications
await authPg.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(600);
const notifBtn = authPg.locator('[aria-label*="notif" i], button:has-text("notification")').first();
if (await notifBtn.isVisible().catch(() => false)) {
  await notifBtn.click();
  await authPg.waitForTimeout(500);
  await ss(authPg, 'P3_notifications');
}

await authCtx.close();

// === Phase 4: Admin routes – iPhone 15 ===
console.log('\nPhase 4: Admin routes...');
const adminCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const adminPg = await adminCtx.newPage();
await doLogin(adminPg);
await ss(adminPg, 'P4_00_admin_login');

const adminRoutes = ['/admin', '/admin/users', '/admin/questions', '/admin/settings', '/admin/features', '/admin/blog', '/admin/notifications', '/admin/billing', '/admin/activity', '/admin/subjects'];
for (const route of adminRoutes) {
  await adminPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await adminPg.waitForTimeout(700);
  await ss(adminPg, `P4${route.replace(/\//g, '_')}`);
  await checkOverflow(adminPg, `Admin ${route}`);
  await checkTouchTargets(adminPg, `Admin ${route}`);
}
await adminCtx.close();

// === Phase 5: iPhone SE ===
console.log('\nPhase 5: iPhone SE (375×667)...');
const seCtx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sePg = await seCtx.newPage();
await doLogin(sePg);
for (const route of ['/today', '/pricing', '/modules', '/profile', '/mock-exams', '/study-plan', '/schedule', '/analytics']) {
  await sePg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await sePg.waitForTimeout(700);
  await ss(sePg, `P5_se${route.replace(/\//g, '_')}`);
  await checkOverflow(sePg, `SE ${route}`);
  await checkTouchTargets(sePg, `SE ${route}`);
}
await seCtx.close();

// === Phase 6: Android Large (412×915) ===
console.log('\nPhase 6: Android Large (412×915)...');
const alCtx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
const alPg = await alCtx.newPage();
await doLogin(alPg);
for (const route of ['/today', '/modules', '/mock-exams', '/analytics', '/admin', '/study-plan']) {
  await alPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await alPg.waitForTimeout(700);
  await ss(alPg, `P6_al${route.replace(/\//g, '_')}`);
  await checkOverflow(alPg, `AndroidLg ${route}`);
}
await alCtx.close();

// === Phase 7: iPad Portrait (768×1024) ===
console.log('\nPhase 7: iPad Portrait (768×1024)...');
const ipadCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ipadPg = await ipadCtx.newPage();
await doLogin(ipadPg);
for (const route of ['/today', '/modules', '/mock-exams', '/analytics', '/study-plan', '/schedule', '/admin', '/admin/users']) {
  await ipadPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await ipadPg.waitForTimeout(700);
  await ss(ipadPg, `P7_ipad${route.replace(/\//g, '_')}`);
  await checkOverflow(ipadPg, `iPad ${route}`);
  await checkTouchTargets(ipadPg, `iPad ${route}`);
}
await ipadCtx.close();

// === Phase 8: Landscape (844×390) ===
console.log('\nPhase 8: Landscape mode...');
const lsCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const lsPg = await lsCtx.newPage();
await doLogin(lsPg);
for (const route of ['/today', '/modules', '/mock-exams', '/pricing', '/study-plan', '/schedule']) {
  await lsPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await lsPg.waitForTimeout(700);
  await ss(lsPg, `P8_ls${route.replace(/\//g, '_')}`);
  await checkOverflow(lsPg, `Landscape ${route}`);
}
await lsCtx.close();

await browser.close();

fs.writeFileSync('mobile-audit/playwright/issues.json', JSON.stringify(issues, null, 2));
const bySev = {};
issues.forEach(i => { bySev[i.sev] = (bySev[i.sev]||0)+1; });

console.log('\n=== AUDIT COMPLETE ===');
console.log('Screenshots:', shots);
console.log('Issues:', issues.length, JSON.stringify(bySev));
console.log('\nAll issues:');
issues.forEach((i, n) => console.log(`  [${n+1}] [${i.sev}] ${i.label} → ${i.msg}\n       ${i.detail.slice(0,120)}`));
