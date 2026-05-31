import { supabase } from "./supabase";

export type TableName = 'exams' | 'subjects' | 'subcategories' | 'chapters' | 'questions';

export interface BaseItem {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export async function fetchItems<T extends BaseItem>(table: TableName, parentIdField?: string, parentId?: string): Promise<T[]> {
  let query = supabase.from(table).select('*').order('sort_order', { ascending: true });
  
  if (parentIdField && parentId) {
    query = query.eq(parentIdField, parentId);
  }
  
  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching from ${table}:`, error);
    throw error;
  }
  return data as T[];
}

export async function createItem<T extends BaseItem>(table: TableName, payload: any): Promise<T> {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) {
    console.error(`Error creating in ${table}:`, error);
    throw error;
  }
  return data as T;
}

export async function updateItem<T extends BaseItem>(table: TableName, id: string, payload: any): Promise<T> {
  const { data, error } = await supabase.from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) {
    console.error(`Error updating in ${table}:`, error);
    throw error;
  }
  return data as T;
}

export async function deleteItem(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.error(`Error deleting from ${table}:`, error);
    throw error;
  }
}

export async function toggleItemActive(table: TableName, id: string, currentState: boolean): Promise<boolean> {
  const { error } = await supabase.from(table).update({ is_active: !currentState }).eq('id', id);
  if (error) {
    console.error(`Error toggling active in ${table}:`, error);
    throw error;
  }
  return !currentState;
}

export async function reorderItems(table: TableName, items: { id: string; sort_order: number }[]): Promise<void> {
  // Supabase doesn't have bulk update via standard JS client easily except via upsert
  // Upserting with ID preserves other fields if we do it carefully, but it's safer to do individual updates
  // For small lists, Promise.all is fine.
  const updates = items.map(item => 
    supabase.from(table).update({ sort_order: item.sort_order }).eq('id', item.id)
  );
  
  const results = await Promise.all(updates);
  const err = results.find(r => r.error);
  if (err) {
    console.error(`Error reordering in ${table}:`, err.error);
    throw err.error;
  }
}
