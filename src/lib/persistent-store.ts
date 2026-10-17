import { storage } from "./storage";

type Listener = () => void;

export interface PersistentStore<T> {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T | ((prev: T) => T)) => void;
}

const storeCache = new Map<string, PersistentStore<unknown>>();

/**
 * A minimal external store backed by the storage adapter. Values are
 * cached in memory and only read from storage once, so snapshots are
 * stable (as required by `useSyncExternalStore`) and there is no
 * `setState` inside effects.
 */
export function getPersistentStore<T>(
  key: string,
  defaultValue: T,
  revive?: (raw: T) => T,
): PersistentStore<T> {
  const existing = storeCache.get(key);
  if (existing) return existing as PersistentStore<T>;

  let value: T = defaultValue;
  let initialized = false;
  const listeners = new Set<Listener>();

  const store: PersistentStore<T> = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      if (!initialized) {
        const stored = storage.get<T>(key);
        value =
          stored !== null ? (revive ? revive(stored) : stored) : defaultValue;
        initialized = true;
      }
      return value;
    },
    getServerSnapshot() {
      return defaultValue;
    },
    set(next) {
      value =
        typeof next === "function"
          ? (next as (prev: T) => T)(value)
          : next;
      storage.set(key, value);
      listeners.forEach((listener) => listener());
    },
  };

  storeCache.set(key, store as PersistentStore<unknown>);
  return store;
}
