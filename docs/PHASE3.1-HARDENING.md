# Phase 3.1 — CMS Hardening (P0/P1 + key P2)

**Date:** 2026-06-27
**Status:** IMPLEMENTED. Additive, reversible, flag stays `contentCms` OFF.
**Scope:** fix the Phase 3 audit's P0/P1 (+ P2 hierarchy/a11y/bulk) only. **No Phase 4** — no import/OCR/PDF/CSV/AI/upload.
**Verification:** `tsc --noEmit` 0 errors · **195/195** unit tests pass · `vite build` OK.

---

## Tasks → outcome

| Task | Status | Evidence |
|---|---|---|
| 1 Migration idempotency | ✅ | `drop policy if exists` added before every `create policy` in Phase 2 + Phase 3 migrations (Phase 1 already looped-guarded). Triggers already `drop … if exists`; tables/indexes `if not exists`; functions `create or replace`. |
| 2 Remove 1000-row limit | ✅ | `cmsDb.fetchAll()` pages `.range(from,from+999)` until exhausted; `loadContentTree` uses it for all 13 reads; `loadQuestionsForTopic` capped + ranged. |
| 3 Server search | ✅ | `searchContentServer()` — parallel `ilike` over 7 registry tables **+ questions (prompt/explanation/id)**, merged + deduped; debounced 250 ms in the view. |
| 4 Remove hard delete | ✅ | `deleteEntities` removed from CMS path; `archiveEntities`/`restoreEntities`/`publishEntities` (versioned). UI bulk = publish/archive/restore (no Delete button). |
| 5 Bulk safety | ✅ | `chunk()` (200/req) in `setStatusBulk` reads + writes; `snapshotEntities` chunked. |
| 6 Hierarchy validation | ✅ | `validateHierarchyAssignment()` — self-ref, duplicate, cycle (DFS); `assignRelation` validates against live edges, throws meaningful error. |
| 7 Accessibility | ✅ | Tree: `role=tree/group/treeitem`, `aria-expanded/selected/label`, checkbox `aria-label`, focusable rows + Enter/Space/Arrow keys, expand/history button labels. |
| 8 Tests | ✅ | `cmsHardening.test.ts` 11 tests (chunk, hierarchy validation incl. cycle + no-false-positive, merge). Suite 195. |
| 9 Playwright | ⏳ NOT RUN | live env required (admin auth + flag ON). Gate documented below. |
| 10 Chrome DevTools | ⏳ NOT RUN | same. Static notes below. |

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260627130000_phase2_learning_profiles_enrollments.sql` | +8 `drop policy if exists` guards |
| `supabase/migrations/20260627140000_phase3_cms.sql` | +10 `drop policy if exists` guards |
| `src/lib/cms/contentModel.ts` | +`chunk`, `RELATION_TYPES`, `validateHierarchyAssignment`, `mergeSearchResults` (pure) |
| `src/lib/cms/cmsDb.ts` | rewrite: `fetchAll` pagination, `searchContentServer`, `setStatusBulk`/archive/restore/publish (versioned+chunked), validated `assignRelation`; **hard delete removed** |
| `src/views/admin/ContentCmsView.tsx` | server search (debounced), bulk→archive/restore/publish, ARIA tree + keyboard, lazy-load abort guard |
| `tests/unit/cmsHardening.test.ts` | new — 11 tests |

No new dependency. No flag change. No production page touched.

---

## Before → after

| Concern | Before (Phase 3) | After (Phase 3.1) |
|---|---|---|
| Migration re-run | `42710 policy already exists` → deploy fails | idempotent, safe re-run |
| Tree load | `.select()` capped at 1000 → silent truncation | paged `.range()` loop → complete |
| Search | client flatten of tree; **questions excluded** | server `ilike`, indexed, **questions included** |
| Delete | hard `.delete()` → unrecoverable | archive only; versioned; recoverable |
| Bulk | one `.in([...10k])` → URL overflow | chunked 200/req + versioned |
| Relations | unvalidated upsert | self/dup/cycle validated, errors surfaced |
| Tree a11y | div/span, unlabeled checkboxes | ARIA tree, labels, keyboard |

---

## Scalability impact (50k Q / 100k rel / 5k topics)

- **Tree load:** correctness fixed — no truncation. Memory still holds the full registry graph client-side; at 5k topics+1k modules+edges this is tens of MB. **Acceptable now; the recommended end-state is lazy subtree fetch (deferred — see debt).** Tasked fix was "no 1000 limit / paginated," delivered.
- **Search:** O(indexed ilike) per table, `limit` per type, single round-trip set — stays fast at 50k questions (vs prior client flatten that never saw questions).
- **Bulk:** linear in chunks of 200; 10k ids = 50 requests, no overflow.
- **Relationship validate:** cycle DFS is O(V+E) over one relation table's edges — cheap (each relation table is small).

---

## Verification evidence
```
tsc --noEmit            → 0 errors
vitest run              → 16 files, 195 tests passed
  cmsHardening.test.ts  → 11 passed (chunk, hierarchy/cycle, merge)
vite build              → built OK (278 precache entries)
grep "create policy" w/o guard → 0 remaining in Phase 2/3 migrations
grep ".select(" in cmsDb w/o .range on full-table reads → 0 (fetchAll paginates)
hard delete in CMS path → removed (no deleteEntities export used)
```

---

## NOT VERIFIED (require live run — open gates before enabling flag)
- **Playwright (Task 9):** create/edit/publish/archive/restore/bulk/search/rollback/responsive/console/network — needs the app running with admin auth + `contentCms` ON. Not executed headless here.
- **Chrome DevTools / Lighthouse (Task 10):** LCP/CLS/INP/memory/unused-JS — needs live page. Static notes: CMS is a lazy admin chunk (student bundles unchanged); effects abort-guarded; ARIA added; no third-party scripts.
- **Full a11y (axe / screen reader / contrast):** roles + labels + keyboard added, but contrast of `text-[10px]` chips and SR walkthrough not measured.

---

## Remaining technical debt
- **P2 — Eager full-graph load.** Pagination removes truncation but still loads the whole registry graph into memory. True end-state = lazy per-node subtree fetch (load children on expand). Deferred; suitable for a Phase 3.2 or alongside Phase 4 import.
- **P3 — `dedupe_hash` is 32-bit FNV** → collision probability rises near ~50–65k questions (warning-only, non-blocking). Upgrade to ≥64-bit/sha when import lands.
- **P3 — `group_questions`/`topic_groups` `select using(true)`** (mapping rows public-readable; content still RLS-gated). Left as-is (matches Phase 1 relation pattern; not in P0/P1 scope).
- **P3 — registry tables have no `version` column**, so `buildVersionRecord` versions them from 0 each time; version numbering is per-`content_versions` not per-row. Acceptable (history intact).
- **Integration tests** for `cmsDb` (RLS, pagination, rollback runtime) still absent — pure logic is covered; DB behaviour needs a Supabase test harness.
- **Keyboard nav** covers expand/collapse + select; full roving-tabindex tree navigation (up/down between items) not implemented.

---

## Constraints honored
No Phase 4. No import/OCR/PDF/CSV/AI/upload. No production content modified. No flags enabled. No commit/push/migrate. Additive + reversible (migration rollback blocks unchanged; new code flag-gated OFF).

**Phase 3.1 complete. Awaiting the live Playwright/DevTools gate before enabling `contentCms`. Phase 4 NOT started.**
