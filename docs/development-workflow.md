# Development Workflow

## Branching strategy

```
main          ← production; must always be green
  └── feat/<scope>-<description>   ← feature work
  └── fix/<scope>-<description>    ← bug fixes
  └── chore/<description>          ← tooling, deps, config
```

**Rules:**
- Never commit directly to `main` for feature work
- Branch from `main`; PR back to `main`
- Branch names: lowercase kebab, scope prefix matches Conventional Commits scope

## Commit conventions

Format: `<type>(<scope>): <description>`

| Type | When |
|---|---|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `chore` | Tooling, config, dependency update |
| `refactor` | Code restructure, no behaviour change |
| `test` | Test additions or fixes |
| `docs` | Documentation only |
| `perf` | Performance improvement |

**Rules:**
- Subject ≤ 72 chars, imperative mood ("add" not "added")
- Body only when the "why" isn't obvious from the diff
- `Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>` when AI-assisted

## PR checklist

Before opening a PR, verify:

- [ ] `npx tsc --noEmit` — TypeScript clean
- [ ] `npx vite build` — production build passes
- [ ] `npx vitest run` — all unit tests pass (453/453 baseline)
- [ ] `BASE_URL=http://localhost:5173 npx playwright test` — Playwright passes (requires `vite preview` running)
- [ ] No `console.log` / `debugger` / `TODO` introduced
- [ ] No unintended file changes in diff
- [ ] Desktop layout unchanged (check `/today`, `/practice`, `/review` at 1440px)
- [ ] Mobile layout verified (360, 375, 390, 430 portrait + landscape)

## Testing checklist

### Unit tests
```bash
node node_modules/vitest/vitest.mjs run
```
Baseline: **453/453**. Any regression blocks merge.

### Playwright (mobile audit)
```bash
# Requires a running server. Use vite preview for prod build:
node node_modules/vite/bin/vite.js preview --port 5173
BASE_URL=http://localhost:5173 node node_modules/@playwright/test/cli.js test tests/e2e/mobile-audit.spec.ts

# Or set APP_URL in .env.test and just run:
node node_modules/@playwright/test/cli.js test tests/e2e/mobile-audit.spec.ts
```

Screenshots land in `tests/screenshots/mobile-audit/`.

### TypeScript
```bash
node node_modules/typescript/bin/tsc --noEmit
```

### Build
```bash
node node_modules/vite/bin/vite.js build
```

## Merge policy

1. PR requires passing CI (TypeScript + build + unit tests)
2. Playwright mobile audit run locally and screenshots reviewed
3. One approval (self-review acceptable for solo project)
4. Squash merge preferred for feature branches to keep `main` log clean
5. Delete branch after merge

## Environment setup

Copy `.env.test.example` → `.env.test` and fill credentials.
Set `APP_URL=http://localhost:5173` in `.env.test` so Playwright targets local by default.

## CI notes

- `BASE_URL` env var overrides all local config for CI runs
- Retries: 2 on CI, 0 locally
- Playwright HTML report: `playwright-report/index.html`
