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

const DEVICES = [
  { name: 'iPhoneSE',     w: 375, h: 667,  dpr: 2,   mobile: true },
  { name: 'iPhone15',     w: 390, h: 844,  dpr: 3,   mobile: true },
  { name: 'AndroidSm',    w: 360, h: 780,  dpr: 3,   mobile: true },
  { name: 'AndroidLg',    w: 412, h: 915,  dpr: 3.5, mobile: true },
  { name: 'iPadPortrait', w: 768, h: 1024, dpr: 2,   mobile: true },
  { name: 'Landscape',    w: 844, h: 390,  dpr: 3,   mobile: true },
];

const issues = [];
let shots = 0;

async function ss(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  shots++;
  return file;
}

async function checkOverflow(page, label) {
  const result = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const bad = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > cw + 4 && r.width > 0) {
        bad.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 50), right: Math.round(r.right), cw });
      }
    });
    return { hScroll: sw > cw, bad: bad.slice(0, 5) };
  }).catch(() => ({ hScroll: false, bad: [] }));
  if (result.hScroll || result.bad.length) {
    issues.push({ sev: 'High', label, msg: 'Horizontal overflow / scroll', detail: JSON.stringify(result.bad) });
  }
  return result.hScroll;
}

async function checkTouchTargets(page, label) {
  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
        out.push({ tag: el.tagName, text: String(el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    return out.slice(0, 8);
  }).catch(() => []);
  if (small.length) {
    issues.push({ sev: 'Medium', label, msg: `${small.length} touch targets < 40px`, detail: JSON.stringify(small) });
  }
}

async function loginContext(ctx) {
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/modules`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(600);
  const ef = await pg.locator('input[type="email"]').first();
  if (await ef.isVisible().catch(() => false)) {
    await ef.fill(EMAIL);
    await pg.locator('input[type="password"]').first().fill(PASS);
    const sb = pg.locator('button[type="submit"]').first();
    await sb.click();
    await pg.waitForTimeout(4000);
  }
  return pg;
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// === Phase 1: Public pages across all devices ===
console.log('Phase 1: public pages...');
const publicRoutes = ['/', '/pricing', '/blog', '/contact', '/qotd', '/about', '/a320-systems'];
for (const dev of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: dev.dpr,
    isMobile: dev.mobile,
    hasTouch: dev.mobile,
  });
  const pg = await ctx.newPage();
  for (const route of publicRoutes) {
    await pg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await pg.evaluate(() => { document.querySelectorAll('button').forEach(b => { if (String(b.textContent).includes('Decline')) b.click(); }); });
    await pg.waitForTimeout(500);
    await ss(pg, `${dev.name}${route.replace(/\//g, '_') || '_home'}`);
    await checkOverflow(pg, `${dev.name} ${route}`);
    if (dev.w <= 375) await checkTouchTargets(pg, `${dev.name} ${route}`);
  }
  await ctx.close();
}

// === Phase 2: Login flow ===
console.log('Phase 2: login flow...');
const loginCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const loginPg = await loginCtx.newPage();
await loginPg.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await loginPg.evaluate(() => { document.querySelectorAll('button').forEach(b => { if (String(b.textContent).includes('Decline')) b.click(); }); });
await loginPg.waitForTimeout(400);

// Open mobile menu
const menuBtn = loginPg.locator('#mobile-menu-toggle');
if (await menuBtn.isVisible().catch(() => false)) {
  await menuBtn.tap();
  await loginPg.waitForTimeout(500);
  await ss(loginPg, 'login_01_menu_open');
}

// Tap Sign in / Start studying
const startBtn = loginPg.locator('button:has-text("Start studying"), button:has-text("Sign in")').first();
if (await startBtn.isVisible().catch(() => false)) {
  await startBtn.tap();
  await loginPg.waitForTimeout(700);
  await ss(loginPg, 'login_02_auth_modal');
}

const ef = loginPg.locator('input[type="email"]').first();
if (await ef.isVisible().catch(() => false)) {
  await ef.fill(EMAIL);
  await loginPg.locator('input[type="password"]').first().fill(PASS);
  await ss(loginPg, 'login_03_filled');
  const sb = loginPg.locator('button[type="submit"]').first();
  await sb.tap();
  await loginPg.waitForTimeout(4000);
  await ss(loginPg, 'login_04_after_submit');
  console.log('Login URL:', loginPg.url());
}

// Password reset flow
await loginPg.goto(BASE, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
const menuBtn2 = loginPg.locator('#mobile-menu-toggle');
if (await menuBtn2.isVisible().catch(() => false)) { await menuBtn2.tap(); await loginPg.waitForTimeout(400); }
const startBtn2 = loginPg.locator('button:has-text("Start studying"), button:has-text("Sign in")').first();
if (await startBtn2.isVisible().catch(() => false)) { await startBtn2.tap(); await loginPg.waitForTimeout(500); }
const forgotLink = loginPg.locator('text=Forgot password, a:has-text("Forgot")').first();
if (await forgotLink.isVisible().catch(() => false)) {
  await forgotLink.tap();
  await loginPg.waitForTimeout(500);
  await ss(loginPg, 'login_05_forgot_password');
}
await loginCtx.close();

// === Phase 3: Authenticated routes – iPhone 15 ===
console.log('Phase 3: authenticated routes (iPhone 15)...');
const authCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const authPg = await loginContext(authCtx);
console.log('Authed URL:', authPg.url());
await ss(authPg, 'authed_session_established');

const authRoutes = [
  '/today', '/modules', '/analytics', '/bookmarks', '/profile',
  '/study-plan', '/schedule', '/exam-centre', '/mock-exams', '/referral',
];
for (const route of authRoutes) {
  await authPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await authPg.waitForTimeout(900);
  await ss(authPg, `authed${route.replace(/\//g, '_')}`);
  await checkOverflow(authPg, `Authed ${route}`);
  await checkTouchTargets(authPg, `Authed ${route}`);
  const len = await authPg.evaluate(() => document.body.innerText.length).catch(() => 0);
  if (len < 80) issues.push({ sev: 'High', label: route, msg: 'Page blank or near-empty', detail: `innerText length: ${len}` });
}

// Bottom nav test
await authPg.goto(`${BASE}/today`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(600);
const bottomNav = await authPg.locator('nav[aria-label="Bottom navigation"]').first();
const bnVisible = await bottomNav.isVisible().catch(() => false);
if (!bnVisible) issues.push({ sev: 'High', label: 'Bottom nav', msg: 'Bottom navigation not visible on mobile', detail: '' });
await ss(authPg, 'authed_bottom_nav_check');

// Mobile drawer nav
const mobileMenu = authPg.locator('#mobile-menu-toggle');
if (await mobileMenu.isVisible().catch(() => false)) {
  await mobileMenu.tap();
  await authPg.waitForTimeout(500);
  await ss(authPg, 'authed_mobile_drawer_open');
  const overflow = await checkOverflow(authPg, 'Mobile nav drawer');
  // Close drawer
  await authPg.keyboard.press('Escape');
  await authPg.waitForTimeout(300);
}

// Quiz flow
await authPg.goto(`${BASE}/modules`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(800);
const firstTopic = authPg.locator('a[href*="/topic/"]').first();
if (await firstTopic.isVisible().catch(() => false)) {
  const href = await firstTopic.getAttribute('href');
  await authPg.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await authPg.waitForTimeout(700);
  await ss(authPg, 'quiz_01_topic_page');
  await checkOverflow(authPg, 'Topic page');
  await checkTouchTargets(authPg, 'Topic page');

  const startQuiz = authPg.locator('button:has-text("Start"), button:has-text("Practice"), a:has-text("Quiz")').first();
  if (await startQuiz.isVisible().catch(() => false)) {
    await startQuiz.tap();
    await authPg.waitForTimeout(1500);
    await ss(authPg, 'quiz_02_quiz_active');
    await checkOverflow(authPg, 'Quiz view active');
    await checkTouchTargets(authPg, 'Quiz view active');

    // Answer a question
    const choiceA = authPg.locator('[data-choice="a"], button:has-text("A"), .choice-btn').first();
    if (await choiceA.isVisible().catch(() => false)) {
      await choiceA.tap();
      await authPg.waitForTimeout(600);
      await ss(authPg, 'quiz_03_answered');
    }
  }
}

// Profile page deep
await authPg.goto(`${BASE}/profile`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(800);
await ss(authPg, 'profile_full');
await checkOverflow(authPg, 'Profile page');

// Settings overlay
const settingsBtn = authPg.locator('button[aria-label*="settings" i], button:has-text("Settings")').first();
if (await settingsBtn.isVisible().catch(() => false)) {
  await settingsBtn.tap();
  await authPg.waitForTimeout(500);
  await ss(authPg, 'settings_overlay');
  await checkOverflow(authPg, 'Settings overlay');
  await authPg.keyboard.press('Escape');
}

// Mock exam flow
await authPg.goto(`${BASE}/mock-exams`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(800);
await ss(authPg, 'mock_exam_list');
await checkOverflow(authPg, 'Mock exams');

// Study plan
await authPg.goto(`${BASE}/study-plan`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(800);
await ss(authPg, 'study_plan');
await checkOverflow(authPg, 'Study plan');

// Schedule/calendar
await authPg.goto(`${BASE}/schedule`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
await authPg.waitForTimeout(800);
await ss(authPg, 'schedule_calendar');
await checkOverflow(authPg, 'Schedule calendar');

await authCtx.close();

// === Phase 4: Admin routes ===
console.log('Phase 4: admin routes...');
const adminCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const adminPg = await loginContext(adminCtx);
const adminRoutes = [
  '/admin', '/admin/users', '/admin/questions', '/admin/settings',
  '/admin/features', '/admin/blog', '/admin/notifications', '/admin/billing',
  '/admin/activity', '/admin/subjects',
];
for (const route of adminRoutes) {
  await adminPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await adminPg.waitForTimeout(700);
  await ss(adminPg, `admin${route.replace(/\//g, '_')}`);
  await checkOverflow(adminPg, `Admin ${route}`);
  await checkTouchTargets(adminPg, `Admin ${route}`);
}
await adminCtx.close();

// === Phase 5: iPhone SE deep ===
console.log('Phase 5: iPhone SE deep...');
const seCtx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sePg = await loginContext(seCtx);
for (const route of ['/today', '/pricing', '/modules', '/profile', '/mock-exams', '/study-plan', '/schedule']) {
  await sePg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await sePg.waitForTimeout(700);
  await ss(sePg, `se${route.replace(/\//g, '_')}`);
  await checkOverflow(sePg, `SE ${route}`);
  await checkTouchTargets(sePg, `SE ${route}`);
}
await seCtx.close();

// === Phase 6: Android large (412px) ===
console.log('Phase 6: Android large...');
const alCtx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
const alPg = await loginContext(alCtx);
for (const route of ['/today', '/modules', '/mock-exams', '/analytics', '/admin']) {
  await alPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await alPg.waitForTimeout(700);
  await ss(alPg, `andLg${route.replace(/\//g, '_')}`);
  await checkOverflow(alPg, `AndroidLg ${route}`);
}
await alCtx.close();

// === Phase 7: iPad Portrait ===
console.log('Phase 7: iPad portrait...');
const ipadCtx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ipadPg = await loginContext(ipadCtx);
for (const route of ['/today', '/modules', '/mock-exams', '/analytics', '/study-plan', '/schedule', '/admin']) {
  await ipadPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await ipadPg.waitForTimeout(700);
  await ss(ipadPg, `ipad${route.replace(/\//g, '_')}`);
  await checkOverflow(ipadPg, `iPad ${route}`);
}
await ipadCtx.close();

// === Phase 8: Landscape ===
console.log('Phase 8: landscape...');
const lsCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const lsPg = await loginContext(lsCtx);
for (const route of ['/today', '/modules', '/mock-exams', '/pricing', '/study-plan']) {
  await lsPg.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 }).catch(() => {});
  await lsPg.waitForTimeout(700);
  await ss(lsPg, `ls${route.replace(/\//g, '_')}`);
  await checkOverflow(lsPg, `Landscape ${route}`);
}
await lsCtx.close();

await browser.close();

// Write results
fs.writeFileSync('mobile-audit/playwright/issues.json', JSON.stringify(issues, null, 2));
console.log('\n=== AUDIT COMPLETE ===');
console.log('Screenshots taken:', shots);
console.log('Issues detected:', issues.length);
const byS = { High: 0, Medium: 0, Low: 0 };
issues.forEach(i => { byS[i.sev] = (byS[i.sev] || 0) + 1; console.log(`  [${i.sev}] ${i.label}: ${i.msg}`); });
console.log('By severity:', JSON.stringify(byS));
