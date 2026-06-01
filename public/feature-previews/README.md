# Feature preview assets

Drop a preview clip here for each feature flag shown in the admin
**Feature Control** panel. On hover, the admin sees this asset.

## Naming

`public/feature-previews/<flagKey>.<ext>`

- Images / GIFs: `aiExplain.gif`, `qotd.png`, `blog.jpg` → shown via `<img>`.
- Videos: `aiPractice.mp4` → register the key as `"video"` in
  `src/views/admin/featureMedia.ts` (`explicitType` map), then drop the `.mp4`.

`<flagKey>` is the exact flag key (see `FlagKeys` in
`src/hooks/useFeatureFlags.tsx`), e.g. `aiExplain`, `mockExams`,
`maintenanceMode`, `proGating`, `announcementBanner`, …

## Notes

- Missing assets fall back to a placeholder automatically — no build error.
- Recommended size: 680×380 (16:9-ish). Keep GIFs/MP4s small (< ~2 MB) for snappy hover.
