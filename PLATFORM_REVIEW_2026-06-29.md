# Heading — Full Platform Review (2026-06-29)

GStack workflow: CEO → Design → Engineering. Evidence gathered by 6 parallel
read-only audits across 22 domains, cross-checked against the live Supabase
project (ref `iwamrscqmedyklafiqvu`) and prior audit docs.

---

## 0. Overall Health Score: **62 / 100**

| Axis | Score | One-line |
|---|---|---|
| Engineering architecture | 80 | Clean separation, pure engines, idempotent ledgers, solid RLS, real PWA. |
| Security | 75 | Strong server foundation; client-trust optimism + rate-limit fallback gaps. |
| Database | 70 | Good schema + RLS; **unversioned function drift**, missing FK indexes, 3 overlapping attempt tables. |
| Performance | 62 | Good bundling/prerender; mobile Lighthouse ~43, heavy un-memoized charts. |
| UX / A11y / Mobile | 60 | Forms fixed; sub-44px targets, <16px text, dead-end "coming soon" flows. |
| Scalability | 58 | Broadcast sync loop + per-instance rate-limit fallback break at scale. |
| Testing | 40 | 21 logic tests; **0% component/view/hook/e2e-flow coverage**. |
| **Content** | **12** | **78 published questions, 0 mock papers, 0 topics.** Pre-MVP. |

The engineering is genuinely strong. The **score is dragged down by content
(unshippable) and testing (unsafe to refactor)**. Fix those two and this is an
80+ platform.

---

## 1. CEO Review — is this solving the right problem?

**Verdict: the engine is built; the fuel tank is empty.** You have spent the
effort budget on adaptive learning, XP, missions, forecasting, push, CMS,
import pipelines — and shipped **78 questions and zero mock papers** for a
platform that advertises DGCA + EASA + FAA coverage. Live DB:

```
questions: 79 (78 published) | exams: 13 | mock_papers: 0 | topics: 0
users: 5 | attempts: 21 | payments: 3
```

A DGCA CPL candidate alone expects thousands of questions across ~10 subjects
and full-length timed mock papers. **No amount of adaptive intelligence
matters with 78 questions** — the adaptive engine has nothing to adapt over.

### Solving the right problems?
- **Right long-term bet:** exam-specific, adaptive, mobile-first prep is the correct wedge.
- **Wrong sequencing:** premium intelligence features (forecast, predictive, adaptive regen) were built before the content that makes them meaningful. This is backwards.

### What to REMOVE / freeze (complexity not earning its keep)
- **Interview/Viva prep** — 3/3 sections hardcoded `coming_soon`. Ship it or hide it; a dead tab erodes trust. (`InterviewPrepView.tsx:20-44`)
- **Predictive Intelligence + Forecast timeline** — extrapolates an 8-week pass-probability band from as few as 2 data points. With 21 total attempts platform-wide, these are confidently-wrong toys. Flag OFF until there is real data density.
- **Plan regeneration UI** — disabled stub (`StudySchedulerView.tsx:111-122`). Remove the visible-but-dead button.
- **Calendar reminders hook** — `useStudyReminders` is a no-op stub wired into the calendar. Dead surface.

### What's MISSING (table stakes)
1. **Content. At least 1,500–2,000 questions + 3–5 full mock papers** for ONE exam (DGCA CPL) before anything else.
2. **Mock papers at all** — `mock_papers` table is empty; the entire "Mock Exams" product is a shell.
3. **Question explanations at scale** — adaptive/coach features are worthless without rich per-question rationale.
4. **A "first 10 minutes" path** — onboarding currently dumps users into a near-empty product.

### What should be PREMIUM (and is monetizable once content exists)
- Full-length **timed mock papers** with scorecards + percentile (currently gated to ONE hardcoded exam id `nav-cpl-01`).
- **Adaptive study plan + mission scheduler** (already built — this is your premium moat *once content backs it*).
- **AI explain-deeper / coach** (built, gated). Good premium hook.
- **Offline question packs** (IndexedDB cache exists). "Study on the plane" is a clean aviation-specific premium angle.

### What makes Heading the best aviation platform
- Authority-specific paths (DGCA/EASA/FAA) done **deeply**, not broadly. Win one exam completely before adding a second.
- The adaptive engine + mission loop is a real differentiator **if** content density makes it sing.
- Mobile-first + offline is the right shape for a studying-on-the-go audience.

**CEO bottom line: stop building features. Seed content for one exam, turn off
the dead tabs, and the existing engine becomes a genuinely premium product.**

---

## 2. Design Review — UX, flow, retention

### Page-level findings
- **Today / Dashboard** (`TodayView.tsx`) — does too much: 20+ concerns, 8+ `useState`, 9+ `useEffect`, charts re-render on unrelated state. High cognitive load for the user *and* the renderer. Split into sections with clear hierarchy.
- **Mock Exams** (`MockExamsView.tsx`) — "Simulation Refused" empty state when 0 questions, with no guidance to the user. Dead-end. Needs an empty state that points somewhere.
- **Interview Prep** — all three cards say "coming soon." Classic trust-eroder.
- **Study Scheduler** — visible "Regenerate" button is disabled; "Add entire plan to schedule" sticky CTA relies on fragile `pb-32` spacing.
- **Quiz** — strong (4 layouts, resume, swipe nav), but `finishQuiz()` is a 300-line function and resume silently fails if a saved question id was deleted.

### Onboarding
- `OnboardingFlow.tsx` exists but lands users in a content desert. Onboarding should *defer* until there's something to do, or guide straight into the one seeded exam.

### Retention / gamification
- XP, ranks (6 tiers), achievements, streaks, missions — **all built and idempotent.** Good bones.
- **But:** reminders/push pipeline is built and the cron is **disabled**; streak/exam-countdown logic has timezone + rounding bugs (`reminderSelector.ts` — `daysUntil()` uses `Math.ceil`, exam 7d+1h reads as 8d and the final-week nudge never fires; stale-mission uses `startedAt` not last-activity). Retention loop is wired but not firing correctly.

### Accessibility
- Forms, dialogs, reduced-motion, skip-link: **fixed** (per prior audits, verified present).
- **Still open:** ~30 sub-44px touch targets, pervasive <16px text (nav 13px, labels 9–11px → iOS input zoom), no automated a11y scan in CI, focus-trap imported but not verified on all modals.

### Design recommendations
1. Hide/disable every "coming soon" surface behind its feature flag.
2. Add real empty states that route the user to the one place with content.
3. Memoize the dashboard; it visibly janks on mobile (LH ~43).
4. Mobile sweep: 44px min targets, 16px min on inputs. Use the existing `accesslint`/`scan` skills + a Playwright viewport pass.
5. Fix the reminder timezone/rounding bugs before enabling the cron, or the first push users get will be wrong.

---

## 3. Engineering Review — architecture, DB, API, security, scale, tests

### What's genuinely solid (keep doing this)
- **Pure engines + thin hooks** (adaptive, forecast, mission, spaced-repetition, reminder selector) — testable, side-effect-free.
- **Append-only `security_log` / `audit_log`** with reject-on-update/delete triggers; **idempotent XP & achievement ledgers** (unique indexes).
- **RLS** consistently own-row + `is_admin()`; billing columns protected by trigger; notification insert-spoofing closed (`20260619120000`).
- **Payment path**: constant-time signature verify, order-ownership check, `razorpay_payment_id` idempotency key, audit trail.
- **PWA**: complete manifest, sensible Workbox strategies (NetworkOnly analytics, NetworkFirst Supabase, SWR assets), IndexedDB offline question cache, update prompt, chunk-reload recovery.
- **Build gate**: `tsc --noEmit` before `vite build`. CSP is tight and real.

### Technical Debt Report

| # | Debt | Location | Severity |
|---|---|---|---|
| D1 | **Unversioned DB function drift** — `rl_hit()` + `broadcast_notification()` exist in remote DB but in **no tracked migration**. Cannot rebuild DB from migrations; DR/staging risk. | remote-only; called at `api/_lib/utils.ts:82`, `api/admin/broadcast.ts:43` | **High** |
| D2 | **Dual API surface** — `server.ts` (dev Express) and `api/*` (prod Vercel) must be hand-synced; no CI check. | `server.ts` vs `api/` | High |
| D3 | **Vercel Hobby 12-function cap reached.** No room for new endpoints without multiplexing into `system.ts`/`instructor`. | `vercel.json`, `api/` | Medium |
| D4 | **Three overlapping attempt tables** — `attempts`, `user_question_attempts`, `question_progress`; no documented source-of-truth; some metrics double-count (`mistakeAnalysis.ts:75-110`). | DB | Medium |
| D5 | **Missing FK indexes** on `learning_profiles.preferred_*`, `enrollments.*` → full scans on registry delete. | Phase-1/2 migrations | Medium |
| D6 | **No memoized context values** — `AuthContext` provider value rebuilt every render; `useAuth` consumed in 77 places → re-render storms. `NotificationContext` re-subscribes realtime on every token refresh (keys on `user` not `user?.uid`). | `contexts/*` | Medium |
| D7 | **Un-memoized charts** — D3/Recharts (`MasterySunburst`, `MasteryRadar`, Analytics) rebuild on unrelated state. | views/today, AnalyticsView | Medium |
| D8 | **`finishQuiz()` 300-line function** with 3 race-guard refs; hard to test/maintain. | `QuizView.tsx:706+` | Medium |
| D9 | **Non-uniform shuffle** — `.sort(() => 0.5 - Math.random())` for question/answer order; biased. | `MockExamsView.tsx:140,225` | Low |
| D10 | **Admin authz N+1** — `requireAdmin` queries `admins` per request, no cache. | `api/_lib/guards.ts:92` | Low |
| D11 | **Admin analytics computes MRR client-side** over all `plan_changes` rows. | `useAdminAnalytics.ts:149` | Low (now) |
| D12 | **SELECT \*** in CMS loads pulls full explanation/media JSON for tree views. | `lib/cms/cmsDb.ts` | Low |
| D13 | **Duplicate push implementations** — `push.ts` vs `pushSubscription.ts` with different `onConflict` keys → duplicate subscription rows. | `lib/push.ts`, `pushSubscription.ts` | Low |
| D14 | **Monthly plan expiry** via `setMonth(+1)` → 28–31 day grants depending on start month. | payment/start-trial paths | Low |

### Security findings (beyond the solid baseline)

| # | Issue | Risk |
|---|---|---|
| S1 | **Client shows "Trial Activated" without confirming server** — `PricingView.tsx:69-94` updates local plan state without awaiting/validating `/api/start-trial`; `ProGate.tsx:68-83` discards the response. UI lies on reload. | Medium (UX/trust; no actual grant bypass — server is authoritative) |
| S2 | **Rate-limit fail-open to per-instance memory** — when `rl_hit` RPC errors, falls back to an in-memory map; under serverless autoscale effective limit = limit × instances. | Medium |
| S3 | **Webhook ledger non-atomic** — if `payments` insert fails after `profiles` update, plan granted with no durable record; idempotency depends on both succeeding; webhook still returns 200 (no Razorpay retry). | Medium |
| S4 | **Trial double-grant race** — `start-trial.ts` reads `trial_used` then updates unconditionally (no `WHERE trial_used=false`); two concurrent calls both 200. | Low |
| S5 | **Referral code via `Math.random()`** + unrate-limited lookup → enumerable. | Low |
| S6 | **No prompt-injection sanitization** on user text into Gemini (`api/instructor/[action].ts`); bounded by length + 20-calls/hr, but raw. | Low–Med |

### Scalability
- **Broadcast** = synchronous fan-out loop; times out well before 100k users. Move to Inngest/pg_cron job (Inngest + QStash are already dependencies).
- **Rate limiting** needs the shared `rl_hit` to be authoritative (fail-closed or Upstash Redis — already a dependency) instead of per-instance fallback.
- **`useMasteryHistory`** fetches all attempts for 8 weeks with no pagination; PostgREST 1000-row cap silently truncates at scale.

### Testing
- 21 unit tests, all **pure logic** (engines, parsers, plan, SEO, slug). Good as far as it goes.
- **0 component/view/hook tests** (186 files). **3 e2e specs**, none covering auth, quiz, or payment flows.
- Commit history shows repeated build breakages from unstaged flag files / JSX errors — exactly what a thin component/e2e smoke layer would catch.

---

## 4. Missing Features (prioritized)

**P0 — blocks launch**
1. Real question bank: ≥1,500 questions for DGCA CPL with explanations.
2. ≥3 full-length timed mock papers (the `mock_papers` table is empty).

**P1 — needed for a credible v1**
3. Per-exam dynamic OG images (shared exam links all use the default image).
4. Working retention loop: fix reminder TZ/rounding bugs, then enable the push cron.
5. Onboarding that routes into the one seeded exam.

**P2 — premium / depth**
6. Mock-paper percentile + cohort scorecard.
7. Offline question packs as an explicit premium feature.
8. Interview/Viva prep — build for real or remove.

---

## 5. Production Readiness Report

| Gate | Status | Note |
|---|---|---|
| Auth / sessions | ✅ Ready | Single-device, PKCE, timeout-bounded lock, realtime evict. |
| Payments | ⚠️ Mostly | Verify path solid; fix webhook ledger atomicity (S3) + monthly expiry (D14). |
| Security baseline | ✅ Ready | RLS, CSP, append-only logs, signature verify. Address S1–S2 before scale. |
| DB integrity | ⚠️ Drift | Capture `rl_hit`/`broadcast_notification` into migrations (D1) before any rebuild/staging. |
| Content | ❌ Not ready | 78 Q / 0 mocks. Hard blocker. |
| Performance | ⚠️ OK | Mobile LH ~43; memoize contexts + charts. |
| A11y / mobile | ⚠️ Partial | Touch targets + text size sweep needed. |
| Scalability | ⚠️ Soft-launch only | Broadcast + rate-limit fixes before 10k+ users. |
| Testing | ❌ Unsafe to refactor | No component/flow coverage. |
| Observability | ⚠️ | Sentry + security_log present; Slack alert webhook still placeholder (alerts OFF). |

**Verdict: soft-launch-able for ONE exam after content seeding + the P0/P1
engineering fixes. Not ready for paid scale until broadcast/rate-limit/testing
are addressed.**

---

## 6. Prioritized Roadmap

### Phase A — Make it real (2–3 weeks) — *content + dead-weight*
- Seed ≥1,500 DGCA CPL questions w/ explanations via the existing import pipeline.
- Author ≥3 full timed mock papers; un-hardcode the timed-mock gate (`QuizView.tsx:1504`, `QuizSetup.tsx:66`).
- Flag-off / hide: Interview Prep, Predictive Intelligence, Forecast, plan-regen stub, no-op reminder hook.
- **Exit:** a new user can complete a full DGCA CPL study→quiz→mock loop end to end.

### Phase B — Make it safe (1 week) — *integrity + tests*
- Capture `rl_hit` + `broadcast_notification` into versioned migrations (D1).
- Add a thin smoke layer: Playwright e2e for auth, quiz-finish, payment; RTL for AuthModal + QuizView. (D-tests)
- Make `rl_hit` authoritative / fail-closed (S2); fix webhook ledger atomicity (S3) + trial double-grant (S4) + monthly expiry (D14).
- Add a CI check (or a shared module) so `server.ts` and `api/*` can't drift (D2).

### Phase C — Make it fast & sound (1 week) — *perf + UX*
- Memoize `AuthContext`/`NotificationContext` values; key notification realtime on `user?.uid` (D6).
- Memoize chart data + wrap chart components in `React.memo` (D7).
- Mobile sweep: 44px targets, 16px inputs; run `scan`/`accesslint` + Playwright viewport pass.
- Fix reminder TZ/rounding (`reminderSelector.ts`), then enable the push cron.

### Phase D — Make it scale (when approaching paid scale)
- Broadcast → Inngest/QStash job (deps already present).
- Paginate `useMasteryHistory`; add the missing FK indexes (D5).
- Decide source-of-truth among the 3 attempt tables; document + migrate (D4).
- Set the real Slack alert webhook (turn observability ON).

---

### Appendix — confidence notes
- Content counts, user/payment counts, and function existence verified directly against the live Supabase project.
- One sub-audit initially flagged `rl_hit`/`broadcast_notification` as "missing in production" — **corrected**: they exist in the remote DB and work; the real issue is they are not in version-controlled migrations (D1).
- Severity reflects current scale (5 users); several "Low" items (N+1, client-side MRR) become "High" at 10k+ users and are slotted into Phase D accordingly.
