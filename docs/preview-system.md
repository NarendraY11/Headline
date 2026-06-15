# Feature Preview System

Admin-side isolated preview workspace for feature flags. Selecting any feature in `/admin/features` opens a sandboxed component or route preview that uses draft flag state without writing to production.

---

## Architecture

### Phase 1 — Feature Registry (`src/views/admin/featureRegistry.ts`)

Single source of truth for every feature flag. Each entry is a `FeatureDefinition`:

| Field | Type | Purpose |
|---|---|---|
| `key` | `FlagKeys` | Matches exactly one `defaultFlags` key |
| `title` | `string` | Human label shown in Feature Control |
| `description` | `string` | One-line description |
| `category` | `FeatureCategory` | Groups features in the admin panel |
| `adminVisible` | `boolean` | Whether the feature appears in Feature Control |
| `previewType` | `"component" \| "route" \| "api-only" \| "none"` | What kind of preview is possible |
| `routes` | `string[]` | App routes affected by this flag |
| `sideEffects` | `FeatureSideEffect[]` | Runtime cost signals (ai, billing, auth, etc.) |
| `requiresAuth` | `boolean` | Whether the feature requires a logged-in user |
| `requiresAdmin` | `boolean` | Whether the feature requires admin role |

Adding a new flag requires entries in **both** `featureRegistry.ts` **and** `useFeatureFlags.tsx` (`FlagKeys` union + `defaultFlags`). The `satisfies` constraint enforces key alignment at compile time.

### Phase 2 — Preview Registry (`src/views/admin/featurePreviewRegistry.ts`)

Derives a `FeaturePreviewDefinition` for every registry key. At module load time:

- Reads `readyComponentPreviews` (lazy component map) and `previewRoutes` (route map)
- Assigns `implementationStatus`: `"ready"` | `"planned"` | `"unsupported"`
- Assigns `riskLevel` from `previewType` (`component` → low, `route` → medium, `api-only` → high)
- Warns in DEV if a key is marked ready but has no component or route

All component lookups use `lazyPreviewComponent(exportName)` — a factory that wraps each named export from `featureComponentPreviews.tsx` in `React.lazy`, keeping every preview out of the initial bundle.

### Phase 3 — Preview UX (`src/preview/`, `src/views/admin/FeaturePreviewPanel.tsx`)

`PreviewModeProvider` holds four split React contexts to minimize re-renders:

| Context | Consumers |
|---|---|
| `PreviewSelectionContext` | `FeatureList`, `PreviewSidebar`, `FeaturePreviewPanel` |
| `PreviewPanelStateContext` | `FeaturePreviewPanel` |
| `PreviewDraftFlagsContext` | `FeaturePreviewRoute`, `PreviewFeatureFlagsProvider` |
| `PreviewModeContext` (root) | Legacy; prefer the granular hooks |

Selection triggers a 140 ms debounce timer that resolves preview status. `PreviewFeatureFlagsProvider` merges draft flags into `FeatureFlagsContext` so preview components see flag state without touching production.

### Phase 4 — Previews

| Sub-phase | File | Contents |
|---|---|---|
| 4A — Component | `featureComponentPreviews.tsx` | 21 named preview exports, one per feature |
| 4B — Route | `FeaturePreviewRoute.tsx`, `PreviewRouteShell.tsx`, `previewRoutes.tsx` | 4 route previews; standalone route at `/admin/features/preview/:featureKey` |
| 4C — Analytics/Data | Part of 4A | Mastery, readiness, and predictive intelligence previews |

### Phase 5 — Preview Service Layer (`src/preview/services/`)

Mock service implementations for previews that would otherwise call Supabase or external APIs:

| File | Service |
|---|---|
| `previewAIService.ts` | Mock AI responses (coach, diagnosis, practice) |
| `previewAnalyticsService.ts` | Mock mastery and performance data |
| `previewNotificationService.ts` | Mock notification payloads |
| `previewWeatherService.ts` | Mock METAR briefing data |
| `previewSchedulerService.ts` | Mock study mission data |
| `previewMockData.ts` | Shared fixtures |
| `previewServiceTypes.ts` | Shared types across services |

### Phase 6 — Performance (`src/preview/previewDiagnostics.ts`)

- `React.memo` on all preview-system components: `FeatureToggleRow`, `FeatureSection`, `FeatureList`, `PreviewSidebar`, `FeaturePreviewPanel`, `FeaturePreviewUnavailable`, `PreviewRouteShell`
- `useCallback` on all event handlers; `useMemo` on all context values and derived props
- `usePreviewRenderDiagnostics(name)` — DEV-only hook that logs render duration and warns when a render exceeds `VITE_PREVIEW_SLOW_THRESHOLD_MS` (default 16 ms)
- `FeaturePreviewRoute` subscribes to `usePreviewDraftFlags()` (granular) not `usePreviewMode()` (root), so selection and panel-state changes don't re-render it

### Phase 7 — Tooling (`scripts/validate-preview-registry.ts`)

See [Validation](#validation) below.

---

## File Map

```
src/
  hooks/useFeatureFlags.tsx          FlagKeys union + FeatureFlagsProvider
  views/admin/
    featureRegistry.ts               Phase 1: canonical feature definitions
    featurePreviewRegistry.ts        Phase 2: lazy preview map + metadata
    FeatureControl.tsx               Main admin panel (integrates preview sidebar)
    FeaturePreviewPanel.tsx          Preview sidebar panel
    FeaturePreviewRoute.tsx          Standalone /admin/features/preview/:key route
    FeaturePreviewUnavailable.tsx    Fallback when preview is not implemented
    PreviewRouteShell.tsx            Chrome for route previews
    featureComponentPreviews.tsx     All 21 component preview implementations
    previewRoutes.tsx                4 route preview definitions
  preview/
    PreviewModeProvider.tsx          Split context provider (4 contexts)
    PreviewFeatureFlagsProvider.tsx  Injects draft flags into FeatureFlagsContext
    usePreviewMode.ts                Granular context hooks
    previewDiagnostics.ts            DEV render-timing diagnostics
    services/
      previewServiceTypes.ts
      previewMockData.ts
      previewAIService.ts
      previewAnalyticsService.ts
      previewNotificationService.ts
      previewWeatherService.ts
      previewSchedulerService.ts
      index.ts

scripts/
  validate-preview-registry.ts      Phase 7: validator + coverage audit

docs/
  preview-system.md                  This file
```

---

## Adding a New Feature Flag

1. **`src/hooks/useFeatureFlags.tsx`** — add the key to `FlagKeys` and `defaultFlags`.

2. **`src/views/admin/featureRegistry.ts`** — add a `FeatureDefinition` entry. The `satisfies` constraint will fail at compile time if the key is missing or mistyped.

3. **Run validation** to confirm integrity:
   ```bash
   npm run validate:preview
   ```

4. Add a preview (optional but recommended for admin-visible features — see below).

---

## Adding a Preview for an Existing Feature

### Component preview

1. Add a named export to `src/views/admin/featureComponentPreviews.tsx`:
   ```tsx
   export function MyFeaturePreview() {
     const enabled = Boolean(useFeature("myFeature"));
     return <PreviewScaffold title="My Feature" subtitle="...">...</PreviewScaffold>;
   }
   ```

2. Register it in `src/views/admin/featurePreviewRegistry.ts`:
   ```ts
   myFeature: lazyPreviewComponent("MyFeaturePreview"),
   ```

3. Set `previewType: "component"` in `featureRegistry.ts` if not already set.

### Route preview

1. Add a route component to `src/views/admin/previewRoutes.tsx`:
   ```tsx
   function MyRoutePreview() { return <div>...</div>; }
   ```

2. Add an entry to `previewRoutes`:
   ```ts
   myFeature: {
     featureKey: "myFeature",
     path: "/my-route",
     title: "My Feature",
     summary: "One-line description.",
     component: MyRoutePreview,
   },
   ```

3. Set `previewType: "route"` in `featureRegistry.ts`.

---

## Validation

### Commands

```bash
# Human-readable integrity report + coverage metrics
npm run validate:preview

# JSON output for CI parsers / scripts
npm run audit:preview

# Fail with exit 2 if admin-visible coverage < 50%
tsx scripts/validate-preview-registry.ts --strict
```

### Checks performed

| Code | Severity | Description |
|---|---|---|
| `REGISTRY_MISSING_FLAGKEY` | error | A `FlagKey` has no `featureRegistry` entry |
| `FLAGKEY_MISSING_FOR_REGISTRY` | error | A `featureRegistry` key is not a `FlagKey` |
| `DUPLICATE_KEY` | error | Duplicate key in `featureRegistry` |
| `ORPHAN_COMPONENT_PREVIEW` | error | `readyComponentPreviews` key not in `featureRegistry` |
| `MISSING_PREVIEW_EXPORT` | error | `lazyPreviewComponent("X")` but `X` not exported from `featureComponentPreviews.tsx` |
| `ORPHAN_ROUTE_PREVIEW` | error | `previewRoutes` key not in `featureRegistry` |
| `MISSING_PREVIEW` | warning | `adminVisible` feature with no preview implementation |
| `COVERAGE_BELOW_THRESHOLD` | error | Coverage < 50% (only emitted with `--strict`) |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | All integrity checks passed |
| `1` | One or more integrity errors |
| `2` | Coverage below threshold (`--strict` only) |

### JSON output schema

```json
{
  "passed": true,
  "errorCount": 0,
  "warningCount": 16,
  "issues": [
    { "severity": "warning", "code": "MISSING_PREVIEW", "message": "..." }
  ],
  "coverage": {
    "totalFeatures": 50,
    "adminVisible": 34,
    "componentPreviews": 21,
    "routePreviews": 4,
    "withAnyPreview": 25,
    "apiOnly": 5,
    "plannedFeatures": 16,
    "adminVisibleCoverageRatio": 0.529,
    "byCategory": {
      "AI Features (cost-bearing)": { "total": 5, "covered": 1, "ratio": 0.2 }
    }
  }
}
```

---

## Coverage Baseline (as of Phase 7)

| Metric | Value |
|---|---|
| Total feature flags | 50 |
| Admin-visible features | 34 |
| Features with component preview | 21 |
| Features with route preview | 4 |
| Features with any preview | 25 |
| API-only features (no preview possible) | 5 |
| Admin-visible planned (no preview yet) | 16 |
| **Admin-visible coverage** | **52.9%** |

The 16 planned admin-visible features (aiExplain, aiCoach, aiDiagnosis, aiPractice, topicPractice, qotd, spacedRepetition, flashcards, cockpitLayouts, adsense, pricingCheckout, freeTrial, proGating, vivaPractice, announcementText, offlineMode) are tracked as `MISSING_PREVIEW` warnings. Each is a candidate for a future component or route preview.

---

## Known Limitations

- All 21 component previews share one lazy chunk (`featureComponentPreviews.tsx`). Any preview selection loads the entire module. Splitting into per-feature files would reduce per-preview load time but requires 21 new files.
- `useFeature(key)` consumers re-render on any flag write (new object ref). A per-key selector or `useSyncExternalStore` approach would isolate re-renders but is out of scope.
- Render diagnostics (`usePreviewRenderDiagnostics`) measure render + commit time together. The metric conflates both phases; separate them with a `useLayoutEffect` if precision is needed.
