# Required GitHub Secrets

Add these at: Settings → Secrets and variables → Actions → New repository secret

## CI / Build secrets (needed by ci.yml and deploy.yml)

| Secret name             | Where to get it                          | Used in        |
|-------------------------|------------------------------------------|----------------|
| VITE_SUPABASE_URL       | Supabase dashboard → Project Settings → API | build stage |
| VITE_SUPABASE_ANON_KEY  | Supabase dashboard → Project Settings → API | build stage |
| VITE_POSTHOG_KEY        | PostHog → Project Settings → Project API key | build stage |
| VITE_POSTHOG_HOST       | `https://eu.i.posthog.com`               | build stage    |
| VITE_APP_PUBLIC_URL     | `https://www.heading380.in`              | build stage    |
| VITE_SENTRY_DSN         | Sentry → Project Settings → Client Keys  | build stage    |
| VITE_RAZORPAY_KEY_ID    | Razorpay dashboard → API Keys            | build stage    |

## E2E test secrets (needed by ci.yml test stage)

| Secret name        | Value                                         |
|--------------------|-----------------------------------------------|
| TEST_USER_EMAIL    | A real test-account email on heading380.in    |
| TEST_USER_PASSWORD | That account's password                       |
| BASE_URL           | Override test target (default: production URL) |

## Deploy secrets (needed by deploy.yml only)

| Secret name         | Where to get it                                         |
|---------------------|---------------------------------------------------------|
| VERCEL_TOKEN        | vercel.com → Account Settings → Tokens → Create         |
| VERCEL_ORG_ID       | `vercel inspect <project>` or `.vercel/project.json`    |
| VERCEL_PROJECT_ID   | `.vercel/project.json` after `vercel link`              |

## Notification secrets (optional — Slack alerts)

| Secret name       | Value                                             |
|-------------------|---------------------------------------------------|
| SLACK_WEBHOOK_URL | Slack → Your app → Incoming Webhooks → Add webhook |

## Security notes

- VITE_* secrets are baked into the client bundle at build time — never put
  service-role keys or private keys in VITE_* vars.
- Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_WEBHOOK_SECRET,
  UPSTASH_REDIS_REST_TOKEN, etc.) are already in Vercel env and do NOT need
  to be added to GitHub secrets — they are never used during the GitHub build.
