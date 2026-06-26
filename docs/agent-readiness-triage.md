# Agent-Readiness Triage — heading380.in

_Date: 2026-06-26_

---

## 1. Repo / Infra Findings

### Architecture

- **SPA, not SSR.** Vite + React 19. vercel.json fallback `/((?!api/).*) → /index.html` confirms client-side routing.
- **Prerendering exists** (`scripts/prerender.ts`), but that's static HTML pre-generation at build time — still hydrates to SPA. Not Next.js / true SSR.
- **API layer:** Vercel Serverless Functions in `/api/`. Consolidated into `/api/system.ts` (multi-handler dispatched via `?fn=`) to stay under Vercel Hobby 12-function cap. Dynamic instructor route at `/api/instructor/[action]`.
- **Supabase Edge Functions:** two (`send-push`, `mission-reminders`). Both server-only (require `X-Internal-Secret`). Not user-callable.
- **Workflow orchestration:** Inngest (job DAGs) + Upstash QStash (scheduled tasks). Both internal.

### vercel.json Summary

- Strict CSP (allowlists Razorpay, Sentry, PostHog, Clarity, Google, Gemini)
- HSTS preload, `X-Frame-Options: DENY`, strict referrer-policy
- Rewrites: `/sitemap.xml` and `/robots.txt` → API handlers; `/api/study/*` and `/api/push/*` → `/api/system?fn=...`
- Fallback SPA rewrite last

### `.well-known/`

**Does not exist** — neither at repo root nor under `public/`.

### `public/robots.txt`

**Static file does not exist.** Served dynamically via `/api/robots.txt.ts` (generates at request time).

### Existing Agent-Facing Artifacts

- `public/llms.txt` — **already exists**. Lists public entry points: `/a320-systems`, `/qotd`, `/pricing`, `/exams/*`, `/blog/*`, `/about`, `/privacy`, `/terms`, `/refund`, `/contact`, `/sitemap.xml`. Describes Heading as EASA/DGCA/FAA/A320 pilot exam prep.
- `.mcp.json` — **developer tooling only** (Supabase + Sentry MCPs for local Claude Code use). Not a public MCP server.

---

## 2. DNS Provider

**Cannot confirm from code.** No Cloudflare config files, no DNS zone files, no registrar references in the repo.

**What is known:**
- Domain `www.heading380.in` is an `.in` TLD (likely an Indian registrar: BigRock, GoDaddy India, etc.)
- Vercel is the hosting platform; domain was migrated to Vercel 2026-06-17
- DNS is almost certainly managed either at Vercel (if nameservers were pointed at Vercel DNS) or at the registrar (with a CNAME/A record pointing to Vercel)

**Scriptability:** DNS changes are **not scriptable from this repo**. All DNS modifications require manual dashboard action — either in the Vercel dashboard (Domains tab) or at the domain registrar. There is no Terraform/Pulumi/infra-as-code in the repo.

**Action before Phase 2:** Confirm in the Vercel dashboard whether nameservers are `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. If yes → Vercel DNS (TXT records addable via Vercel dashboard or CLI). If no → registrar dashboard required for TXT records.

---

## 3. Third-Party / Agent-Facing API — YES or NO

**NO.**

Every `/api/*` endpoint requires one of:
- Supabase user JWT (`Authorization: Bearer <token>`)
- Admin JWT + `is_admin()` DB check
- `X-Internal-Secret` header (server-to-server only)
- Razorpay webhook signature (payment endpoints)

There is no unauthenticated public API, no API-key-issued endpoint, no endpoint intended for third-party consumers or autonomous agents. Supabase auto-REST excluded per scope.

**Implication:** OAuth discovery, Protected Resource metadata, API Catalog, and Auth.md are all premature — there is nothing external agents can or should call today.

---

## 4. Page Types

| # | Type | Example Routes | Notes |
|---|------|---------------|-------|
| 1 | Landing / Home | `/` | LCP-optimized, prerendered |
| 2 | Auth modal | `/login`, `/reset-password` | Overlay on home, not distinct shell |
| 3 | Marketing / About | `/about`, `/contact` | Static content |
| 4 | Pricing | `/pricing` | Plan comparison; Razorpay integration |
| 5 | Legal | `/privacy`, `/terms`, `/refund` | Static content |
| 6 | Exam SEO landing | `/exams/:examId` | Per-exam landing (DGCA, EASA, FAA, etc.) |
| 7 | Blog list | `/blog` | Paginated post listing |
| 8 | Blog post | `/blog/:slug` | Long-form articles |
| 9 | QOTD | `/qotd` | Public daily question (unauthenticated) |
| 10 | A320 Systems ref | `/a320-systems` | Interactive systems reference |
| 11 | Dashboard (Today) | `/today` | Auth-required; daily mission + XP |
| 12 | Study modules | `/modules` | Subject/topic browser |
| 13 | Topic view | `/topic/:id` | Subject material + practice |
| 14 | Quiz (fullscreen) | `/quiz/:topicId` | Immersive MCQ session; no App Shell |
| 15 | Mock exams | `/mock-exams` | Timed mock test listing/launcher |
| 16 | Analytics | `/analytics` | Personal study performance charts |
| 17 | Bookmarks | `/bookmarks` | Saved questions |
| 18 | Profile | `/profile` | User settings, subscription status |
| 19 | Referral | `/referral` | Referral program |
| 20 | Study schedule | `/schedule` | AI study calendar |
| 21 | Mission flow | `/mission/complete`, `/missions/history` | Post-mission screens |
| 22 | Exam centre | `/exam-centre` | Live test environment |
| 23 | Interview prep | `/interview-prep`, `/interview-prep/:section` | Oral exam prep hub |
| 24 | Admin (18 sub-pages) | `/admin/*` | Internal tools; not public-facing |

**Markdown-for-Agents scope:** Focus on types 1–10 + 23 (Interview Prep). Types 11–22 are auth-gated; type 24 is admin-only. Blog posts and exam SEO pages are highest-value for LLM indexing.

---

## 5. Item Decisions (11 Items)

| Item | Decision | Reason |
|------|----------|--------|
| **Link headers** | **BUILD** | One vercel.json header block; advertise `llms.txt` + future well-known docs. Zero cost, immediate discoverability gain. |
| **DNS-AID** | **BUILD-IF** | Requires manual DNS (not scriptable). Worth doing once we publish a public MCP card or claim an agent identity. Trigger: Phase 3+ if MCP card goes live. |
| **Markdown for Agents** | **BUILD** | `llms.txt` exists but is sparse. Expand with full exam syllabus summaries, blog post index, exam-type descriptions. High value for LLM crawlers; all public content. |
| **Content Signals** | **BUILD** | JSON-LD on landing, `/exams/:examId` (Course schema), `/blog/:slug` (Article schema), `/pricing` (Product schema). Dual win: SEO + agent structured understanding. |
| **API Catalog** | **SKIP** | All endpoints require user/admin auth. No third-party API consumers exist. Publishing an OpenAPI spec of internal endpoints has no benefit and mild security exposure. |
| **OAuth/OIDC discovery** | **SKIP** | We are an OAuth *consumer* (Supabase handles auth). We do not issue tokens to third parties. `.well-known/openid-configuration` is not applicable. |
| **OAuth Protected Resource** | **SKIP** | Same reasoning as above. No OAuth-protected resources exposed to external agents. |
| **Auth.md** | **SKIP** | No public API to authenticate to. Would only document internal endpoints. Revisit if/when a public API ships. |
| **MCP Server Card** | **DEFERRED** | `.well-known/mcp.json` makes sense only after defining what MCP *tools* the server would expose (read exam Q&A, lookup syllabus, check QOTD). Design the tool surface first; card is a 10-line JSON once that exists. **Phase 5 (2026-06-26): Deferred.** A real remote MCP server needs the full OAuth-for-MCP stack to be useful; without it the only safe surface is public metadata that duplicates `llms.txt`. The card is trivial — the server is the work, and it isn't worth it yet. Revisit only if real external agent demand emerges. |
| **Agent Skills index** | **SKIP** | Premature without a defined MCP server or agent-callable API. No skills to index. **Phase 5 (2026-06-26): SKIP confirmed post-Phase 4.** WebMCP tools are session-local (`navigator.modelContext`, registered only in a live browser tab), not statically indexable by a cold crawler. Nothing else to index without duplicating `llms.txt`. |
| **WebMCP** | **BUILD-IF** | An HTTP/SSE MCP server exposing read-only exam content (question lookup, syllabus, QOTD) to AI tutors is a legitimate future direction. Needs product decision + tool surface design before implementation. Flag for Phase 4+. |

---

## Summary

**Build now (no blockers):** Link headers, Markdown for Agents, Content Signals

**Build-if (needs prerequisite):** DNS-AID (after MCP card), MCP Server Card (after tool surface design), WebMCP (after product decision)

**Skip (no public API):** API Catalog, OAuth/OIDC discovery, OAuth Protected Resource, Auth.md, Agent Skills index
