# Security Observability — Logging, Audit, Alerts, Monitoring

This document describes the logging / monitoring / alerting / audit system added
to Heading, what it captures, where it lives, and the **operator steps you must
complete** to turn external notifications on.

Stack context: React SPA + Vercel serverless (`api/`) + Supabase Postgres.
Auth is Supabase GoTrue (runs client-side). Alerting runs in-database via
`pg_cron` + `pg_net` (no Vercel-cron plan dependency).

---

## 1. What gets logged and where

Two append-only Postgres tables, both **admin-read-only** and **impossible to
UPDATE/DELETE** through normal paths (a `BEFORE UPDATE OR DELETE` trigger raises
even for the service role; deletes are allowed only inside `purge_old_logs()`,
which flips a transaction-local GUC). An attacker holding the anon key — the
only key shipped to browsers — has **no** insert/select/update/delete access.

### `public.security_log` — security events
Columns: `occurred_at, event_type, severity(info|warn|error|critical),
user_id, actor_email, ip, user_agent, route, http_method, status_code, metadata`.

| event_type | severity | source |
|---|---|---|
| `auth.login_success` / `auth.login_failed` | info / warn | client breadcrumb → `/api/auth-event` (server stamps IP/UA) |
| `auth.signup`, `auth.password_reset_requested`, `auth.logout` | info | same |
| `auth.failed` (missing/invalid bearer token) | warn | `getAuthenticatedUser` |
| `authz.denied` (accessing resource you don't own / not admin) | warn / critical | broadcast, init-owner, instructor pro-gate |
| `admin.bootstrap` | critical | init-owner |
| `payment.signature_invalid`, `payment.order_owner_mismatch`, `payment.webhook_signature_invalid` | critical | payment verify / webhook |
| `payment.verified`, `payment.webhook_upgrade/downgrade`, `trial.granted` | info | payment / trial |
| `session.ip_changed`, `session.superseded` | warn / info | session/check |
| `ratelimit.exceeded` | warn | instructor |
| `abuse.blocked` (honeypot / form rate-limit / attack pattern) | warn | `screenSubmission` |
| `data.bulk_access` (>100 records server-side) | info | admin broadcast |

### `public.audit_log` — who/when/old-new for sensitive data
Columns: `occurred_at, actor_user_id, actor_email, action, table_name,
record_id, old_value, new_value, ip, session_id, source(ui|api|system|trigger)`.

- **DB triggers** (`audit_profiles_change`, `audit_admins_change`) record every
  change to `profiles` (email, plan, plan_status, plan_expires_at) and every
  admin **grant/revoke**, regardless of whether it came from UI or API.
- **API** writes explicit `plan.grant` / `admin.broadcast` entries with IP.

### Log sanitisation
Everything written goes through `redact()` in `api/_lib/securityLog.ts`:
- Keys matching `password|secret|token|authorization|auth|cookie|session|api_key|service_role|signature|ssn|card|cvv|pan` → `[redacted]`.
- Value-shaped secrets masked even inside free text: Stripe/Razorpay keys
  (`sk_live_****1234`), JWTs, `Bearer …`, card numbers (last-4 kept), US SSNs.
- Strings capped at 2000 chars, objects at depth 6.
- Auth-token verification failures **never** log the token.

Runtime logs (Vercel) are access-controlled by the Vercel dashboard; the
`security_log`/`audit_log` tables are RLS admin-only. No log surface is publicly
reachable.

---

## 2. Suspicious-activity alerts

`run_security_sweep()` runs **every 5 minutes** (`pg_cron` job `security-sweep`),
scans `security_log`, dedups via `public.alert_state` (per-key cooldowns), and
posts to Slack via `pg_net`.

| Rule | Threshold | Cooldown |
|---|---|---|
| Failed-login burst (single account) | > 10 / 5 min | 30 min |
| IP fan-out (credential stuffing) | 1 IP → > 50 accounts / 5 min | 60 min |
| Bulk data access | > 100 records / event | 15 min |
| New-IP login for existing user (≈ new country) | first sighting of IP for that account | 24 h |
| Password-reset flood | > 3 / 15 min per account | 60 min |
| 401/403 spike | > 100 / 5 min (tune per traffic) | 30 min |

**Thresholds** live in `run_security_sweep()` — edit and re-run
`supabase/migrations/20260603150000_security_alert_sweep.sql` to change them.

### ⚠️ REQUIRED: set the Slack webhook (alerts are OFF until you do)
The sweep no-ops while the webhook is the placeholder. To enable:

1. Slack → create an **Incoming Webhook** (https://api.slack.com/messaging/webhooks),
   pick the channel (e.g. `#security-alerts`), copy the URL.
2. Store it in Supabase Vault (run in the SQL editor / via MCP):
   ```sql
   update vault.secrets
     set secret = 'https://hooks.slack.com/services/XXX/YYY/ZZZ'
     where name = 'slack_security_webhook';
   ```
3. Smoke-test:
   ```sql
   select public.notify_slack(':white_check_mark: Heading security alerts are live.');
   ```

**Email instead of/alongside Slack:** point the webhook at a Slack→email
workflow, or swap `notify_slack` to `net.http_post` an email API (Resend/SES)
— store that key in Vault the same way.

### Channels & what else gets pushed to Slack
`notify_slack(message, channel)` routes by channel to a per-channel Vault
webhook, **falling back to `slack_security_webhook`** when a channel has none —
so you can run everything in one channel or split them.

| Channel | Vault secret | Vercel env (instant) | Carries |
|---|---|---|---|
| `security` | `slack_security_webhook` | `SLACK_WEBHOOK_SECURITY` | Suspicious-activity sweep (§2) |
| `revenue` | `slack_revenue_webhook` | `SLACK_WEBHOOK_REVENUE` | New Pro, renewals, downgrades |
| `ops` | `slack_ops_webhook` | `SLACK_WEBHOOK_OPS` | Abuse / rate-limit / eviction bursts |
| `digest` | `slack_digest_webhook` | — | Daily 24h business pulse |

Two delivery paths:
- **Instant (serverless)** — `api/_lib/slack.ts` `notifySlack()` posts on the
  request path. Wired into `api/payment/verify.ts` and `api/payment/webhook.ts`:
  every new Pro subscription, webhook renewal, and downgrade pings `#revenue`
  the moment it happens (no sweep lag). Reads the `SLACK_WEBHOOK_*` **Vercel
  env vars** (not Vault). Double-post is avoided: `verify.ts` pings once via its
  idempotency pre-check, the webhook pings only when it was the row's recorder.
- **Batched (in-DB)** — `pg_cron` jobs reuse `notify_slack` (Vault webhooks):
  - `ops-sweep` (every 5 min) → `run_ops_sweep()`: abuse-block burst (>20/5min),
    rate-limit burst (>50/5min), session-eviction spike (>30/5min) → `#ops`.
  - `daily-digest` (03:00 UTC / 08:30 IST) → `run_daily_digest()`: 24h revenue,
    new Pro, downgrades, signups, trials started, active subscribers, critical
    security events, abuse blocked → `#digest`.

Add a per-channel webhook (example for revenue):
```sql
select vault.create_secret(
  'https://hooks.slack.com/services/XXX/YYY/ZZZ',
  'slack_revenue_webhook', 'revenue alerts');
```
Then mirror the same URL into the matching `SLACK_WEBHOOK_*` Vercel env var for
the instant payment pings. Smoke-test a channel:
```sql
select public.notify_slack(':white_check_mark: revenue channel live.', 'revenue');
select public.run_daily_digest();  -- fire the digest on demand
```
Files: `supabase/migrations/20260603180000_slack_notifications_expansion.sql`,
`api/_lib/slack.ts`.

---

## 3. Health monitoring & error tracking

- **`GET /api/health`** — liveness + DB round-trip. `200 {status:"ok"}` healthy,
  `503` when the DB is unreachable. Response time doubles as a slowdown/DDoS
  signal. Leaks nothing.
- **Uptime + status page (free):** point **UptimeRobot** or **Better Stack**
  (both free tiers) at `https://<domain>/api/health` every 1–5 min; both offer a
  hosted status page and Slack/email alerts on downtime or slow response.
- **Error & performance tracking (recommended):** add **Sentry** (free
  developer tier) — `@sentry/react` on the client, `@sentry/node` wrapping the
  `api/` handlers — for error-rate spike alerts, latency (p95) alerts, and
  release tracking. Vercel-native: **Vercel Speed Insights** is already a
  dependency; **Vercel Log Drains** can ship runtime logs to a sink.
- **DB / connections / disk:** Supabase dashboard → Reports has connection
  count, disk, and CPU; set Supabase project alerts there. `pg_stat_statements`
  and `pg_stat_monitor` are installed for slow-query analysis.
- **Severity levels:** `security_log.severity` (info/warn/error/critical) is the
  structured-logging level for security events; the sweep escalates
  critical/warn patterns to Slack.

---

## 4. Retention

`purge-old-logs` (`pg_cron`, monthly) calls `purge_old_logs(365)` — drops
`security_log`/`audit_log` rows older than 365 days. Change the arg to adjust.
Only the cron owner / service role can run it (not callable via the API).

---

## 5. Operator checklist

- [ ] Set the real Slack webhook in Vault (§2) and smoke-test `notify_slack`.
- [ ] (Optional) Add `slack_revenue_webhook` / `slack_ops_webhook` /
      `slack_digest_webhook` in Vault + matching `SLACK_WEBHOOK_*` Vercel env
      vars to split channels (else all fall back to `#security`).
- [ ] Add an UptimeRobot/Better Stack monitor on `/api/health` → Slack.
- [ ] (Recommended) Wire Sentry for error-rate + latency alerts.
- [ ] Tune the 401/403 baseline (default 100/5 min) once you see normal volume.
- [ ] Enable Supabase **Leaked Password Protection** (Auth settings) — flagged
      by the security advisor; tracked in the auth-hardening follow-ups.
- [ ] Confirm Vercel dashboard log access is restricted to trusted team members.

## Files
- `supabase/migrations/20260603140000_security_audit_logging.sql` — tables, triggers, retention fn
- `supabase/migrations/20260603150000_security_alert_sweep.sql` — Slack notifier, sweep, cron
- `supabase/migrations/20260603160000_security_logging_hardening.sql` — advisor fixes, retention cron
- `api/_lib/securityLog.ts` — `logSecurityEvent`, `logAudit`, `redact`, `getReqMeta`
- `api/auth-event.ts` + `src/lib/authEvents.ts` — auth breadcrumb endpoint/client
- `api/health.ts` — health probe
