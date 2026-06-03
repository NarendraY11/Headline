import { Question } from "../../data/questions";

// Durable offline cache of questions the user has actually fetched from the DB.
//
// The app already degrades to the bundled `staticQuestionBank` when the network
// is down, and the service worker keeps a short NetworkFirst cache of Supabase
// responses. Neither gives reliable offline practice on the user's *real*
// question bank: the static bank is a small generic set, and the SW cache is
// capped (100 entries / 24h) and keyed by request URL, not question id.
//
// This IndexedDB store fills that gap as a read-through fallback layer:
// every successful DB fetch writes through here, and offline reads fall back to
// it before the static bank. It is intentionally best-effort — every operation
// swallows errors and returns a safe default so it can never break a fetch.

const DB_NAME = "heading-offline";
const DB_VERSION = 1;
const STORE = "questions";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("subjectId", "subjectId", { unique: false });
        os.createIndex("subcategoryId", "subcategoryId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // If the connection is blocked (older tab holding an upgrade), don't hang.
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Write questions through to the offline cache. Fire-and-forget; never throws. */
export async function putQuestions(questions: Question[]): Promise<void> {
  if (!questions || questions.length === 0) return;
  try {
    const db = await openDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const os = tx.objectStore(STORE);
      for (const q of questions) {
        if (q && q.id) os.put(q);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* best-effort */
  }
}

/** Read cached questions for the given ids (only those present are returned). */
export async function getCachedQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!ids || ids.length === 0) return [];
  try {
    const db = await openDB();
    if (!db) return [];
    const os = txStore(db, "readonly");
    const results = await Promise.all(
      ids.map(
        (id) =>
          new Promise<Question | undefined>((resolve) => {
            const r = os.get(id);
            r.onsuccess = () => resolve(r.result as Question | undefined);
            r.onerror = () => resolve(undefined);
          })
      )
    );
    return results.filter(Boolean) as Question[];
  } catch {
    return [];
  }
}

/** Read cached questions matching optional filters, with the same limit/offset
 *  semantics as fetchPublishedQuestions. */
export async function getCachedQuestions(options?: {
  subjectId?: string;
  subcategoryId?: string;
  limit?: number;
  offset?: number;
}): Promise<Question[]> {
  try {
    const db = await openDB();
    if (!db) return [];
    const os = txStore(db, "readonly");
    const all = await new Promise<Question[]>((resolve) => {
      const r = os.getAll();
      r.onsuccess = () => resolve((r.result as Question[]) || []);
      r.onerror = () => resolve([]);
    });
    let pool = all;
    if (options?.subjectId) pool = pool.filter((q) => q.subjectId === options.subjectId);
    if (options?.subcategoryId) pool = pool.filter((q) => q.subcategoryId === options.subcategoryId);
    if (options?.limit !== undefined) {
      const start = options.offset || 0;
      return pool.slice(start, start + options.limit);
    }
    return pool;
  } catch {
    return [];
  }
}

/** Number of questions available offline — for "ready for offline" UI. */
export async function cachedQuestionCount(): Promise<number> {
  try {
    const db = await openDB();
    if (!db) return 0;
    const os = txStore(db, "readonly");
    return await new Promise<number>((resolve) => {
      const r = os.count();
      r.onsuccess = () => resolve(r.result || 0);
      r.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
