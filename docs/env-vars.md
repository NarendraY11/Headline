# Environment Variables Reference

All variables required for local dev and Vercel production. Copy into `.env.local` for dev, add to Vercel dashboard for prod.

## Supabase (required)

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # server-only (api/ functions), never expose to client
SUPABASE_URL=https://xxxx.supabase.co   # server-only alias used in server.ts
SUPABASE_ANON_KEY=eyJ...               # server-only alias used in server.ts
```

## Razorpay (required for payments)

```
VITE_RAZORPAY_KEY_ID=rzp_live_xxx       # client-safe publishable key
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx                 # server-only
RAZORPAY_WEBHOOK_SECRET=xxx             # server-only — must match Razorpay dashboard webhook secret
```

## PostHog analytics (optional — leave empty to disable)

```
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

## Microsoft Clarity (optional — leave empty to disable)

```
VITE_CLARITY_PROJECT_ID=abc123xyz       # get from clarity.microsoft.com after creating project
```

## Sentry error monitoring (optional — build-time upload only)

```
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx   # client-side DSN
SENTRY_AUTH_TOKEN=xxx                        # CI/build only — uploads source maps
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=your-sentry-project-slug
```

## Google AdSense (optional — leave empty to disable ads)

```
VITE_ADSENSE_CLIENT=ca-pub-xxxxxxxxxx
VITE_ADSENSE_SLOT_DEFAULT=
VITE_ADSENSE_SLOT_BANNER=
VITE_ADSENSE_SLOT_SQUARE=
VITE_ADSENSE_SLOT_ARTICLE=
```

## Slack notifications (optional — alerts off until set)

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx       # generic / digest channel
SLACK_WEBHOOK_SECURITY=https://hooks.slack.com/services/xxx
SLACK_WEBHOOK_REVENUE=https://hooks.slack.com/services/xxx
SLACK_WEBHOOK_OPS=https://hooks.slack.com/services/xxx
```

## Upstash / QStash (optional — background job queue)

```
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx
QSTASH_NEXT_SIGNING_KEY=xxx
```

## Inngest (optional — event-driven workflows)

```
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=xxx
```

## Web Push (optional — PWA push notifications)

```
VITE_VAPID_PUBLIC_KEY=xxx     # client-safe VAPID public key
```

## App URL

```
VITE_APP_PUBLIC_URL=https://www.heading380.in
```

## Auto-injected by Vercel (do NOT set manually)

```
VITE_ON_VERCEL         # set to "true" by vite.config.ts when VERCEL=1 env present
VITE_PREVIEW_SLOW_THRESHOLD_MS   # internal feature-preview perf threshold
```

## Notes

- `VITE_*` vars are bundled into the client JS at build time — never put secrets in them
- Server-only vars (`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, etc.) are only available in `api/` serverless functions and `server.ts`
- After adding/changing Vercel env vars, redeploy to pick them up (`vercel --prod` or Vercel dashboard → Redeploy)
