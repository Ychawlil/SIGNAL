/* ============================================================
   Storage abstraction
   The UI reads/writes through this interface so a future
   database / API layer can replace localStorage without
   touching component code.
   ============================================================ */

export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

const createLocalStorageAdapter = (): StorageAdapter => ({
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota / privacy-mode failures — state stays in memory.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
});

const createMemoryAdapter = (): StorageAdapter => {
  const store = new Map<string, string>();
  return {
    get<T>(key: string): T | null {
      const raw = store.get(key);
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    set<T>(key: string, value: T): void {
      store.set(key, JSON.stringify(value));
    },
    remove(key: string): void {
      store.delete(key);
    },
  };
};

export const storage: StorageAdapter =
  typeof window === "undefined"
    ? createMemoryAdapter()
    : createLocalStorageAdapter();
