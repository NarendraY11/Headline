// Phase 1 — DB-backed registry reads for admin CRUD. Split from the pure
// resolver (contentRegistry.ts) so the resolver imports no supabase client
// and stays offline/test-friendly. Cached once per entity per session
// (Step 9: load once); writes call clearRegistryCache() to invalidate.

import { supabase } from "./supabase";

export type RegistryEntity = "programs" | "certifications" | "aircraft" | "topics";

export interface RegistryRow {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: "draft" | "published" | "archived";
  sort_order: number;
  metadata: Record<string, unknown>;
  [k: string]: unknown;
}

const registryCache = new Map<RegistryEntity, RegistryRow[]>();

/** Load a registry table once; subsequent calls return the cache. */
export async function fetchRegistry(entity: RegistryEntity, force = false): Promise<RegistryRow[]> {
  if (!force && registryCache.has(entity)) return registryCache.get(entity)!;
  const { data, error } = await supabase
    .from(entity)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as RegistryRow[];
  registryCache.set(entity, rows);
  return rows;
}

/** Invalidate the cache after a write so the next read is fresh. */
export function clearRegistryCache(entity?: RegistryEntity): void {
  if (entity) registryCache.delete(entity);
  else registryCache.clear();
}
