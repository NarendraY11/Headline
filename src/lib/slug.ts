// Normalize an id/slug for loose comparison: strip everything but [a-z0-9]
// and lowercase. Used to match topic/subject/subcategory ids that may differ
// in casing, separators, or punctuation across the DB, static bank, and cache.
export const normalizeSlug = (s: string | undefined | null): string =>
  (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
