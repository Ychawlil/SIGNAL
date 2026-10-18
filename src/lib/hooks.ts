"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getPersistentStore } from "./persistent-store";

/**
 * useState-like hook that transparently persists to the storage adapter.
 * Backed by `useSyncExternalStore` so the persisted value hydrates without
 * calling `setState` inside an effect.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  revive?: (raw: T) => T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const store = getPersistentStore(key, defaultValue, revive);
  const value = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => store.set(next),
    [store],
  );
  return [value, setValue];
}

const noopSubscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards.
 *
 * Persisted client state cannot match the server HTML, so anything that
 * renders it as text should wait one tick to avoid a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}