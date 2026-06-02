# Auth Hardening — Token Storage & Supabase Config

Audit follow-up. Two parts:
1. Session/token storage migration options (issue #3: tokens in localStorage)
2. Supabase dashboard config checklist (issues #2, #5, A, B + verification)

The app uses **Supabase Auth (GoTrue)**. Auth flows go **client → Supabase
directly**; they never pass through our `api/` backend. The browser Supabase
client (`src/lib/supabase.ts`) reads/writes `profiles`, `attempts`,
`bookmarks`, and Realtime under RLS using the user's access token.

---

## Part 1 — Token storage migration

### Current state
`createClient(url, anonKey)` with defaults → session (access + refresh token)
persisted in **localStorage**. Any JS on the page can read both tokens, so an
XSS bug can exfiltrate the full session.

### Why true httpOnly cookies do NOT fit this app
httpOnly cookies are not readable by JavaScript. But the browser Supabase
client **must** read the access token from JS to attach it to every
PostgREST / Realtime request. Moving tokens to httpOnly cookies therefore
breaks all direct-from-browser data access — every `supabase.from(...)` call
in `AuthContext`, the views, etc. would have to be re-routed through backend
endpoints that hold the cookie. That is a rewrite of the data layer, not a
migration, and it gives up Realtime + RLS-on-client entirely.

### Option comparison

| Option | XSS protection | Effort | Verdict |
|--------|----------------|--------|---------|
| A. Keep localStorage + harden (CSP, deps, short TTL) | Tokens still JS-readable; rely on preventing XSS | Low | **Recommended** for this SPA |
| B. `@supabase/ssr` `createBrowserClient` (cookie storage) | Cookies are `document.cookie` — still JS-readable, **not** httpOnly | Medium | Marginal win, not worth the churn |
| C. Full BFF with httpOnly cookies (all DB through backend) | Real — tokens never in JS | Very high (rewrite) | Only if app moves to server-rendered / API-only data access |

### Recommended path — Option A (harden, don't migrate)
The payoff is preventing XSS in the first place, since that's the only way the
localStorage tokens leak.

1. **Make session options explicit** in `src/lib/supabase.ts` (documents intent;
   defaults already do this, but be explicit):
   ```ts
   export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
     auth: {
       persistSession: true,
       autoRefreshToken: true,
       detectSessionInUrl: true,
       flowType: "pkce", // PKCE for the OAuth/recovery code exchange
     },
   });
   ```
2. **Keep the CSP tight** (`vercel.json`). Every third-party script (PostHog,
   AdSense, Razorpay) is XSS surface — never widen `script-src` to a bare
   `https:` or add `unsafe-eval`.
3. **Short access-token TTL** (Part 2) so a stolen token expires fast.
4. **Dependency hygiene** — `npm audit` in CI; an XSS in any rendering dep is
   the actual threat model here.
5. **Never** put the service-role key or any secret in `VITE_`-prefixed env
   (already verified clean).

> Decision: do **not** attempt httpOnly cookies while the app uses the browser
> Supabase client for data. Re-evaluate only if the data layer moves to an
> API-only / SSR design.

---

## Part 2 — Supabase dashboard config checklist

These are NOT in the codebase — they must be set in the Supabase dashboard.
Verify each.

### Sessions / tokens (issues #2, #4)
- [ ] **Auth → Sessions → Access token (JWT) expiry**: set to **3600s (1h)** or
      less. Confirms #2 and bounds the post-logout JWT window (#4).
- [ ] **Refresh token rotation**: enabled (default). Reuse detection on.
- [ ] Consider **session timebox / inactivity timeout** if available on plan.

### Brute force (issue #5 — login never hits our backend)
- [ ] **Auth → Attack Protection → enable CAPTCHA** (hCaptcha or Cloudflare
      Turnstile) on sign-in / sign-up. This is the main missing brute-force
      control. Requires adding the CAPTCHA token to `signInWithPassword` /
      `signUp` calls in `AuthModal.tsx` (`options: { captchaToken }`).
- [ ] **Auth → Rate Limits**: review per-IP limits on token, signup, recovery,
      OTP. Tighten from defaults if abuse appears.
- [ ] **Leaked password protection**: enable (checks HaveIBeenPwned).

### Password policy (finding A — client check is bypassable via anon key)
- [ ] **Auth → Policies → Minimum password length**: set **≥ 8** server-side so
      it's enforced even when someone calls `supabase.auth.signUp` directly.
- [ ] Set required character classes / strength if available.

### Password reset (issue #6)
- [ ] **Recovery token expiry**: confirm ≤ 1h (default). Single-use is
      automatic.
- [ ] Email templates point to the correct `redirectTo` (`/reset-password`).

### RLS — must verify (finding B + general)
Run for each table and confirm policies scope rows to `auth.uid()`:
- [ ] `active_sessions` — users can only read/write their own row. The
      single-device logic in `sessionTracker.ts` is advisory only; without RLS
      a user could spoof/read others' session rows.
- [ ] `profiles` — own row only (note: `is_admin()` EXECUTE grant must stay —
      RLS policies call it).
- [ ] `leads`, `contact_messages` — INSERT-only for anon; no public SELECT.
- [ ] `attempts`, `bookmarks`, `referrals`, `notifications`, `events`,
      `plan_changes`, `weather_cache` — own-row scoping; admin-only where
      relevant.

### Email enumeration (finding C — optional)
- [ ] Sign-up currently reveals "account already exists". Decide whether to
      accept (common) or enable confirm-email flows that obscure it.

---

## Session-management requirements status

| # | Requirement | Status | Where |
|---|-------------|--------|-------|
| 1 | Access token 15–30 min | **Dashboard** (set JWT expiry; default 1h) | Supabase → Auth → Sessions |
| 2 | Refresh token 7–30 days | **Dashboard** (session timebox / inactivity) | Supabase → Auth → Sessions |
| 3 | httpOnly/secure/sameSite cookies | **Not feasible** in browser-client model — see Part 1 | n/a |
| 4 | Logout invalidates server-side | **Done** — explicit `signOut({ scope: "global" })` | `AuthContext.tsx` |
| 5 | Password change kills all sessions | **Done** — global `signOut` after `updateUser` | `ResetPasswordView.tsx` |

#1 and #2 cannot be set from application code or the Supabase MCP tools — they
are project auth config (dashboard or Management API only).

## What stays as-is (already correct)
- Password hashing: bcrypt, Supabase-managed. ✓
- Backend token validation: `getAuthenticatedUser` calls
  `supabase.auth.getUser(token)` — verifies signature + expiry server-side, not
  a blind decode. ✓
- Logout: `signOut()` revokes the refresh token server-side, then clears local
  state. JWT remains valid until expiry (stateless) — bounded by short TTL. ✓
- Reset tokens: single-use + time-limited, Supabase-managed. ✓
