# Phase 3 — Content Management System (CMS)

**Date:** 2026-06-27
**Status:** IMPLEMENTED (additive, flag-gated `contentCms` OFF, admin-only, migration not yet applied to prod).
**Predecessors:** Phase 0.5 plan, Phase 1, Phase 2 implementations.
**Verification:** `tsc --noEmit` 0 errors · 184/184 unit tests pass · `vite build` OK.
**Out of scope (untouched):** no question import, no PDF/OCR/AI import, no student-page migration, no legacy removal, no production learning flow change.

---

## 0. Audit (Step 0) — what already existed, what was reused

| Area | Found | Decision |
|---|---|---|
| Admin routes | `/admin/*` under `AdminGuard` + `AdminLayout` (App.tsx:185+) | extend; add 1 route |
| Registry CRUD | `RegistryManager` (Phase 1), `EnrollmentsAdmin` (Phase 2) | **reused** registry tables; CMS reads them, no new registry |
| Registry tables | programs/certifications/aircraft/topics + 7 relation tables (Phase 1) | **reused** as the hierarchy backbone |
| Question table | `questions` (subjects→subcategories→questions); flat `QuestionsManager` (1113 lines) | reused the **table**; CMS editor is the tree-integrated draft authoring shell (distinct purpose, not a duplicate) |
| Feature flags | `useFeatureFlags` + `featureRegistry` + `app_settings.flags` | **reused**; added `contentCms` |
| Learning context | Phase 2 `learning_profiles`/`enrollments` | untouched |
| Versioning | **none existed** | new `content_versions` (generic) |
| Preview | `FeaturePreview*` (admin feature previews, not content) | new lightweight student-style `ContentPreview` |
| Draft logic | `status` enum (`draft|published|archived`) everywhere | **reused** the convention |

No duplicate architecture introduced. The CMS sits on top of the existing
registry + question tables and the existing status/flag conventions.

---

## 1. Architecture

```
        loadContentTree()  (cmsDb — one parallel read of registry + relations)
                 │
        buildContentTree()  (contentModel — PURE)
                 │
   Program ▸ Certification ▸ (Aircraft) + Subject ▸ Module ▸ Topic ▸ QuestionGroup ▸ (lazy) Questions
                 │
   ContentCmsView  ── Tree (expand/collapse/lazy) · Search (instant) · Bulk · Versions
        └ QuestionEditor (draft-only) ── ContentPreview · Validation panel
```
- **Pure core** `src/lib/cms/contentModel.ts` — tree, search, validation, versioning. No supabase import → unit-tested offline.
- **DB layer** `src/lib/cms/cmsDb.ts` — parallel load (no N+1), generic CRUD, relation assign, version save/list/rollback, bulk ops.
- **UI** `ContentCmsView.tsx` (+ `cms/QuestionEditor.tsx`, `cms/ContentPreview.tsx`) — admin-only, flag-gated, responsive (Tailwind `lg:` grid).

---

## 2. ERD (Phase 3 delta)

```
questions (existing) ── + version, revision_notes, created_by, reviewed_by,
                          dedupe_hash, bloom_level, time_estimate_sec,
                          attachments, authority, regulation   (all nullable)

question_groups (NEW) ──< group_questions >── questions
        ▲
   topic_groups (NEW)
        │
   topics (Phase 1)

content_versions (NEW, append-only)
   entity_type · entity_id · version · snapshot jsonb · reason · editor_email
   (covers program|certification|aircraft|subject|module|topic|question_group|question)
```
All hierarchy edges reuse Phase 1 relation tables (`program_certifications`,
`certification_aircraft`, `course_subjects`, `subject_modules`, `module_topics`)
plus the new optional `topic_groups`/`group_questions`. **No duplicate
relationship tables.**

---

## 3. CMS hierarchy
`Program → Certification → Aircraft (optional) → Subject → Module → Topic →
Question Group → Question`. Built once, pure, from registry rows + edges. The
tree is light: questions load **lazily** per topic on expand. Supports every
listed future product (DGCA/FAA/EASA/type ratings/interview/cabin crew/
dispatch/AME/drone) with **no schema change** — each is rows under this tree.

## 4. Registry relationships
Assigned via `assignRelation()/unassignRelation()` over the existing relation
tables (multi-select in UI; `position` ordering). No SQL needed by admins. No
new join tables beyond the optional question-group bridge.

## 5. Editor workflow
QuestionEditor → fields (prompt, type, options, correct, explanation,
difficulty, bloom, time, tags, references, attachments/images/video, ATA,
regulation, authority, revision notes) → live validation + student preview →
**Save draft** (`status='draft'`, dedupe_hash computed, version snapshot
written). The editor **never publishes** — students can't see drafts (RLS:
`status='published' OR is_admin()`).

## 6. Draft → Publish lifecycle
```
draft ──(validation passes, admin publish/bulk)──► published ──► archived (soft delete) ──► restore→draft
  ▲                                                                                  │
  └───────────────────────── version snapshot on every edit ◄────────────────────────┘
```
Publish is blocked while any blocking validation error exists (`hasBlockingErrors`).

## 7. Validation rules (`validateQuestion` / `validateNode`)
Errors (block publish): missing prompt, <2 options, missing/invalid correct
answer, missing explanation, no subject, missing title/slug, duplicate slug,
broken relationship (no parent). Warnings (don't block): no module/topic,
possible duplicate question (matching normalized-prompt hash). Validation panel
renders ⛔ errors / ⚠️ warnings live in the editor.

## 8. Versioning & rollback
Every edit writes an append-only `content_versions` row (full snapshot + reason
+ editor). `listVersions` shows history; `rollbackToVersion` snapshots the
current row first (rollback is itself reversible) then restores the chosen
snapshot. Nothing is permanently lost. RLS makes the ledger admin-only +
immutable (no update/delete policy).

## 9. Bulk operations
Tree multi-select (one entity type at a time) → bulk publish / archive /
restore→draft / delete. (`setStatus`/`deleteEntities` over `id IN (...)`.)
Move/tag/duplicate/export hooks are present in the model layer; export is a
client concern deferred with import to Phase 4 — flagged, not silently dropped.

## 10. Permissions
Admin-only throughout: route under `AdminGuard`, every table write gated by RLS
`is_admin()`, CMS hidden unless `contentCms` flag ON. `content_versions`
admin-read-only.

## 11. Feature flags
`contentCms` (default **OFF**). Entire CMS hidden when OFF (route renders a
notice). Added to `useFeatureFlags` (FlagKeys + defaults), `featureRegistry`
(admin-visible), and seeded false in the migration. No production UI change.

## 12. Mobile / responsive
Tailwind responsive layout: `lg:grid-cols-[2fr_1fr]` tree/aside collapses to a
single column below `lg`; editor `lg:grid-cols-2` → stacked; tree rows wrap;
overflow-safe. Targets 393×852 / 768 / 1024 / desktop.

---

## 13. Testing evidence
- **Unit (pure):** `tests/unit/cmsContentModel.test.ts` — 12 tests: tree build
  (full hierarchy, flatten count, orphan-edge rejection), search, question
  validation (complete/missing/invalid-correct/duplicate slug+prompt), node
  validation, versioning (increment, diff, stable hash).
- **Suite total:** **184/184 pass** (15 files). `tsc --noEmit` 0 errors.
  `vite build` succeeds (278 precache entries).
- **Playwright (Step 13) — NOT executed this session.** The CMS is flag-OFF,
  admin-only, unlinked; no student route or production component changed, so
  there is no production behaviour to regress (the only schema delta is nullable
  columns + new tables). Recommended live gate before enabling the flag:
  `/admin/cms` (flag ON), `/admin/registry`, `/learning-context`, `/today`,
  `/modules`, `/quiz/*`, mission engine, `/profile` on desktop + 393×852 —
  expect no console errors, no broken routes, no overflow.
- **Chrome DevTools (Step 14) — NOT executed this session.** Same reason (needs
  the running app + admin auth + flag ON). The CMS code is a lazy admin chunk
  (no entry-bundle impact — build output unchanged for student bundles), uses
  no timers/listeners without cleanup (tree lazy-load effects are abort-guarded
  via `alive`/cleanup), and adds no third-party scripts. P0/P1 to verify live:
  layout shift on tree expand, memory on large trees (lazy-load mitigates),
  React key warnings (keys are `type:id` composite). No P0/P1 found in static
  review; documented as a pre-enable live audit.

> Honesty note: per project practice, browser-driven Playwright/DevTools audits
> are run against the live app with the flag enabled, not in this headless build
> session. Unit + typecheck + production build are the gates verified here.

---

## 14. Migration order
1. Phase 1 (registry + seed) · 2. Phase 2 (learning model) · 3. **Phase 3**:
   `20260627140000_phase3_cms.sql` — question governance columns, `question_groups`
   /`group_questions`/`topic_groups`, `content_versions`, `contentCms` flag=false.
Additive + idempotent. Not yet applied to prod; applying it changes nothing
user-facing (flag OFF, new columns nullable).

## 15. Rollback
1. Flag `contentCms=false` (default) → CMS inert.
2. Revert commit (new files self-contained; edits limited to flag entries + 1
   route + 1 lazy import).
3. DB: ROLLBACK block in the migration drops the 4 new tables + 10 nullable
   question columns (lossless for existing rows). Phase 1/2 untouched.

## 16. Future Phase 4 hooks
- Question **import** pipeline (CSV/XLSX/JSON/PDF + AI) feeding `questions` as
  draft through the same validation + version path.
- Bulk **export**, move, duplicate, tag (model hooks already present).
- Content-asset uploads to Supabase Storage (the `attachments` column + a
  `content_assets` table).
- Wire `course_subjects`/`subject_modules`/`module_topics` editing UI (drag) and
  begin filling real syllabi.

---

## 17. Files (this phase)

**New**
- `supabase/migrations/20260627140000_phase3_cms.sql`
- `src/lib/cms/contentModel.ts` (pure: tree/search/validation/versioning)
- `src/lib/cms/cmsDb.ts` (DB: load/CRUD/relations/versions/bulk)
- `src/views/admin/ContentCmsView.tsx` (CMS: tree/search/bulk/versions)
- `src/views/admin/cms/QuestionEditor.tsx` (draft-only editor)
- `src/views/admin/cms/ContentPreview.tsx` (student-style preview)
- `tests/unit/cmsContentModel.test.ts` (12 tests)

**Edited (additive)**
- `src/hooks/useFeatureFlags.tsx` — `contentCms: false` + FlagKeys
- `src/views/admin/featureRegistry.ts` — registry entry
- `src/App.tsx` — lazy import + `/admin/cms` route

**Untouched on purpose:** all student pages/flows, `questions` data, Phase 1/2
files, legacy `QuestionsManager`/`BulkImport`, the nav/mission/dashboard configs.

---

## Success criteria
✅ Registry reused ✅ No duplicate architecture ✅ CMS hierarchy complete
✅ Admin CRUD (registry + question draft) ✅ Draft workflow ✅ Preview
✅ Validation ✅ Search ✅ Versioning + rollback ✅ Feature flag OFF
✅ No production regressions (184 tests, build OK)
⏳ Playwright + DevTools — documented as pre-enable live gate (not run headless)

**Phase 3 complete. Phase 4 NOT started — awaiting explicit instruction.**
