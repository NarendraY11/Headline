# Feature Preview System — Production Reference

Deployment-focused companion to `docs/preview-system.md`. Covers security, validation, troubleshooting, and the final architecture audit.

---

## Quick Reference

```bash
# Validate registry integrity + coverage
npm run validate:preview

# JSON output for CI
npm run audit:preview

# Fail CI if coverage < 50%
tsx scripts/validate-preview-registry.ts --strict
```

Access the preview workspace at `/admin/features` (admin auth required).
Standalone route preview: `/admin/features/preview/:featureKey`.

---

## Security Model

### Route Protection

All `/admin/*` routes are wrapped by `AdminGuard` in `App.tsx`:

```
Route element={<AdminGuard>} → AdminLayout outlet
  └─ /admin/features              FeatureControl
  └─ /admin/features/preview/:key FeaturePreviewRoute
```

`AdminGuard` checks `useIsAdmin()` (Supabase `is_admin()` RPC). Both unauthenticated and non-admin users are blocked at render time before any preview content loads. There is no separate auth layer needed inside the preview system itself.

### Prototype-Pollution Guard

`FeaturePreviewRoute` validates `:featureKey` against an explicit `Set<string>` built from `Object.keys(featureRegistry)` rather than using `key in featureRegistry`. This blocks crafted URLs using inherited Object property names (`__proto__`, `constructor`, `hasOwnProperty`, etc.) from reaching preview logic.

```ts
const VALID_FEATURE_KEYS = new Set<string>(Object.keys(featureRegistry));
if (!rawKey || !VALID_FEATURE_KEYS.has(rawKey)) {
  return <FeaturePreviewUnavailable message="..." />;
}
```

### Draft Flags Isolation

`PreviewFeatureFlagsProvider` injects draft flags into `FeatureFlagsContext` for the preview subtree only. Production `FeatureFlagsContext` is unaffected. Draft changes are local to `FeatureControl` state and are discarded on page reload or navigation away.

### Feature Visibility

Non-`adminVisible` features (Study Scheduler, Analytics Intelligence, Internal Rollout, Mobile & Offline categories) are excluded from `adminFeatureDefinitions` and never appear in the Feature Control panel. They can still be reached via a direct URL to `/admin/features/preview/:key` if the key is known — but the route requires admin auth, and the preview correctly displays "Preview Unavailable" for features with `implementationStatus: "planned"` or `"unsupported"`.

No internal or hidden feature data is exposed to non-admin users.

---

## Error Handling

### Error Boundary Hierarchy

```
FeaturePreviewPanel
  └─ PreviewErrorBoundary (context="route")
       └─ LazyFeaturePreviewRoute + Suspense
  └─ PreviewErrorBoundary (context="component")
       └─ PreviewFeatureFlagsProvider
            └─ PreviewComponent + Suspense

FeaturePreviewRoute (standalone)
  └─ PreviewFeatureFlagsProvider
       └─ PreviewErrorBoundary (context="route")
            └─ PreviewRouteShell + RouteComponent
```

`PreviewErrorBoundary` catches render errors inside any preview and:
- Shows an inline fallback UI with a "Retry preview" button (resets boundary state)
- Logs the error and component stack to console in DEV (no-op in production)
- Does **not** propagate to the parent `FeatureControl` or the global `ErrorBoundary`

### Lazy Load Failures

`React.lazy` + `Suspense` handles chunk load failures (network error, deploy rollover) via the nearest `PreviewErrorBoundary`. The retry button triggers a fresh `lazy()` resolution attempt.

### Missing Registry Entries

| Scenario | Behavior |
|---|---|
| Unknown `:featureKey` URL param | `FeaturePreviewUnavailable` — "does not map to a known feature flag" |
| Valid key but no route preview registered | `FeaturePreviewUnavailable` — "route preview not implemented" |
| Valid key with no component preview | `FeaturePreviewUnavailable` — "does not have a component preview yet" |
| `implementationStatus: "unsupported"` | Panel status → `"unavailable"` → `FeaturePreviewUnavailable` |
| Runtime render crash inside preview | `PreviewErrorBoundary` fallback with retry |

---

## Accessibility

All preview UI components pass the following:

| Component | ARIA additions (Phase 8) |
|---|---|
| `FeaturePreviewPanel` (idle) | `aria-label="Preview workspace — select a feature to begin"` |
| `FeaturePreviewPanel` (loading) | `role="status"`, `aria-label` on spinner wrapper |
| `FeaturePreviewPanel` (error) | `role="alert"`, `aria-live="assertive"` |
| `FeaturePreviewPanel` (active) | `<section aria-label="Preview: {feature.title}">` |
| `FeaturePreviewUnavailable` | `role="status"`, `aria-label` describing unavailability |
| `PreviewRouteShell` | `<header>`, `<h2>` (was `<h3>`), flag status `aria-label`, route path `aria-label`, disabled state `role="status"` |
| `PreviewErrorBoundary` | `role="alert"`, `aria-live="assertive"`, retry button `aria-label` |
| All decorative icons | `aria-hidden="true"` |

**Keyboard:** `FeatureToggleRow` is `role="button"` with `tabIndex={0}` and `onKeyDown` handling Enter/Space — fully keyboard operable. Toggle inputs are `<input type="checkbox" role="switch">` with `aria-label`.

**Remaining gap:** Preview component content (inside `featureComponentPreviews.tsx`) is mock UI with no a11y annotations — acceptable for admin-only dev tooling, but note for future preview authors.

---

## Performance

### Bundle Impact

| Path | Strategy |
|---|---|
| `FeaturePreviewRoute` | `React.lazy()` — not in initial bundle |
| All 21 component previews | `lazyPreviewComponent()` factory — all share one chunk |
| Preview services (7 files) | Tree-shaken — only imported by preview components, never by main app |
| `PreviewModeProvider` | Loaded only when `FeatureControl` mounts (lazy) |
| `PreviewErrorBoundary` | Loaded with `FeaturePreviewPanel` and `FeaturePreviewRoute` |

### Known Limitations

1. **Single preview chunk**: all 21 component previews in one `featureComponentPreviews.tsx` file. Selecting any preview loads all. Split into per-feature files to fix — requires 21 new files.
2. **`useFeature` consumer re-renders**: any flag write creates a new `flags` object → all `useFeature` subscribers re-render. Mitigated inside the preview system by `memo` on all components; external consumers unaffected because preview draft flags are isolated in `FeatureFlagsContext`.
3. **Diagnostics measure render+commit**: `usePreviewRenderDiagnostics` timestamps include commit phase. Separate with `useLayoutEffect` if render-only precision is required.
4. **Strict Mode double-invoke**: render counts in DEV are inflated (each mount fires twice). Expected React 19 behavior.

---

## Validation Commands

```bash
# Full integrity check + coverage report (human)
npm run validate:preview

# JSON output for CI parsers
npm run audit:preview

# Exit 2 if admin-visible coverage < 50%
tsx scripts/validate-preview-registry.ts --strict

# TypeScript check (no emit)
npm run lint
```

### Integrity checks

| Code | What it catches |
|---|---|
| `REGISTRY_MISSING_FLAGKEY` | FlagKey without registry entry |
| `FLAGKEY_MISSING_FOR_REGISTRY` | Registry key not in FlagKeys union |
| `DUPLICATE_KEY` | Duplicate keys in featureRegistry |
| `ORPHAN_COMPONENT_PREVIEW` | readyComponentPreviews key not in registry |
| `MISSING_PREVIEW_EXPORT` | lazyPreviewComponent("X") but X not exported |
| `ORPHAN_ROUTE_PREVIEW` | previewRoutes key not in registry |
| `MISSING_PREVIEW` | adminVisible feature with no preview (warning) |

---

## Troubleshooting

### Preview panel shows blank / spinner indefinitely

1. Open DevTools console. Look for `[preview:*]` error messages.
2. Check the `Suspense` boundary — the lazy chunk may have failed to load (network/deploy issue). Retry with Ctrl+Shift+R.
3. If the chunk loads but the component crashes, `PreviewErrorBoundary` will show the inline error in DEV mode.

### Route preview shows "Preview Unavailable"

The feature has `previewType: "route"` in `featureRegistry` but no matching entry in `previewRoutes`. Add a `PreviewRouteDefinition` to `previewRoutes.tsx` and the registry will pick it up automatically.

### validate:preview reports errors

| Error | Fix |
|---|---|
| `REGISTRY_MISSING_FLAGKEY` | Add entry to `featureRegistry.ts` |
| `FLAGKEY_MISSING_FOR_REGISTRY` | Add key to `FlagKeys` in `useFeatureFlags.tsx` |
| `ORPHAN_COMPONENT_PREVIEW` | Remove stale key from `readyComponentPreviews` |
| `MISSING_PREVIEW_EXPORT` | Add/rename export in `featureComponentPreviews.tsx` |
| `ORPHAN_ROUTE_PREVIEW` | Remove stale key from `previewRoutes.tsx` |

### AdminGuard blocks legitimate admin

`useIsAdmin()` calls `is_admin()` RPC on Supabase. If it returns false for a known admin:
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env (see [Vercel service-role debug](vercel-service-role-debug.md)).
- Check `/api/health` for `db: true`.
- Verify the `profiles` table `role` column is `"admin"` for the user.

---

## Coverage Baseline (Phase 7 — June 2026)

| Category | Covered | Total | % |
|---|---|---|---|
| AI Features (cost-bearing) | 1 | 5 | 20% |
| Learning Features | 4 | 8 | 50% |
| UI/UX & System | 7 | 10 | 70% |
| Monetization & Growth | 5 | 9 | 56% |
| Announcement Banner | 1 | 2 | 50% |
| **Total (admin-visible)** | **25** | **34** | **52.9%** |

16 admin-visible features are `"planned"` — they have a `previewType` but no preview implementation. Run `npm run validate:preview` to see the full list.

---

## Final Architecture Audit

### Strengths

- **Complete admin gate**: `AdminGuard` runs before any preview content; no preview data reaches non-admin users.
- **Prototype-pollution guard**: explicit `Set`-based key validation in `FeaturePreviewRoute` eliminates the inherited-property attack surface.
- **Layered error containment**: `PreviewErrorBoundary` → `Suspense` → panel-level status states → global `ErrorBoundary`. A preview crash cannot cascade to `FeatureControl` or the broader admin shell.
- **Draft-flag isolation**: `PreviewFeatureFlagsProvider` sandboxes flag overrides inside the preview subtree. Production context is never mutated.
- **Context splitting**: 4 separate contexts prevent cross-concern re-renders. Components subscribe to only what they need.
- **CI-ready tooling**: `validate-preview-registry.ts` runs without React or Vite; suitable for any Node CI step.
- **Full TypeScript coverage**: `satisfies` constraint on `featureRegistry` enforces key alignment at compile time. All preview types are typed end-to-end.

### Weaknesses

- **Single lazy chunk**: all 21 component previews share one JS chunk. First preview load fetches all of them.
- **No automated render tests**: preview components are tested only manually. A visual regression or snapshot suite would catch regressions.
- **Mock services are static**: `previewMockData.ts` fixtures do not reflect real production data shapes. A stale mock can misrepresent a feature.
- **`useFeature` selector gap**: all `useFeature(key)` consumers re-render on any flag write (new `flags` object reference), even if their specific key didn't change.

### Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `featureComponentPreviews.tsx` growing unbounded | Medium | Split into per-feature files when chunk > ~200KB |
| Preview mock data diverging from production schemas | Low | Document expected shape in `previewServiceTypes.ts`; update on schema change |
| New feature added without registry entry | Low | `validate:preview` catches it; add to CI |
| `AdminGuard` RPC latency on slow connections | Low | Spinner shown during check; no data exposed while pending |

### Future Improvements

1. **Per-feature lazy chunks** — split `featureComponentPreviews.tsx` into `previews/[featureKey].tsx`. `lazyPreviewComponent` becomes `lazy(() => import(\`./previews/${key}\`))`.
2. **Preview test suite** — Playwright `--preview` fixture that mounts `FeatureControl` in a test browser and asserts each registered preview renders without crashing.
3. **Coverage enforcement in CI** — add `tsx scripts/validate-preview-registry.ts --strict` to the GitHub Actions workflow once coverage target is raised above 50%.
4. **`useSyncExternalStore` for flags** — replace `FeatureFlagsContext` with a store to enable per-key subscription and eliminate unrelated re-renders.
5. **Preview search/filter** — as the feature list grows beyond 50 flags, a search input in `FeatureControl` would reduce scroll time.
