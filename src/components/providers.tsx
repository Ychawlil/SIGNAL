"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CollectionPicker } from "@/components/library/collection-picker";
import { libraryApi } from "@/components/library/api";
import { getPersistentStore } from "@/lib/persistent-store";
import { mergeLibrary } from "@/lib/backup";
import { STORAGE_KEYS, TOPIC_NAMES } from "@/lib/constants";
import { usePersistentState } from "@/lib/hooks";
import { TOPICS } from "@/lib/topics";
import { DEFAULT_FOCUS_WEIGHTS } from "@/lib/focus-weights";
import type {
  AppSettings,
  LibraryState,
  TopicId,
  TopicsState,
} from "@/lib/types";
import { clamp } from "@/lib/utils";

/* ============================================================
   Theme
   ============================================================ */

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = usePersistentState<Theme>(
    STORAGE_KEYS.theme,
    "dark",
    () => "dark",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback(() => setThemeState("dark"), [setThemeState]);
  const toggleTheme = useCallback(
    () => setThemeState("dark"),
    [setThemeState],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/* ============================================================
   Library (favorites · notes · read status)
   ============================================================ */

interface LibraryContextValue extends LibraryState {
  importLibrary: (library: LibraryState) => Promise<void>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isRead: (id: string) => boolean;
  toggleRead: (id: string) => void;
  markRead: (ids: string[], read?: boolean) => void;
  addToQueue: (id: string) => Promise<void>;
  getNote: (id: string) => string;
  setNote: (id: string, text: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

const DEFAULT_LIBRARY: LibraryState = {
  favoriteIds: [],
  notes: {},
  readIds: [],
};

const reviveLibrary = (raw: LibraryState): LibraryState => ({
  favoriteIds: raw.favoriteIds ?? [],
  notes: raw.notes ?? {},
  readIds: raw.readIds ?? [],
});

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = usePersistentState<LibraryState>(
    STORAGE_KEYS.library,
    DEFAULT_LIBRARY,
    reviveLibrary,
  );

  const isFavorite = useCallback(
    (id: string) => state.favoriteIds.includes(id),
    [state.favoriteIds],
  );

  const [collectionTarget, setCollectionTarget] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const initialized = useRef(false);
  const initialization = useRef<Promise<void> | null>(null);
  const pending = useRef(new Set<string>());
  const refreshVersion = useRef(0);
  const refreshFavorites = useCallback(async () => {
    const version = ++refreshVersion.current;
    const data = await libraryApi.list({ status: "all" });
    if (version !== refreshVersion.current) return;
    setState((current) => {
      const favoriteIds = data.items.map((item) => String(item.article.id));
      const readIds = [...new Set([...current.readIds.filter((id) => !favoriteIds.includes(id)), ...data.items.filter((item) => item.status === "read").map((item) => String(item.article.id))])];
      return { ...current, favoriteIds, readIds };
    });
    setSyncError(null);
  }, [setState]);
  const initialize = useCallback(async () => {
    if (!initialization.current) {
      initialization.current = (async () => {
        const marker = "signal.favorites-migrated.v1";
        if (!window.localStorage.getItem(marker)) {
          const legacy = getPersistentStore(STORAGE_KEYS.library, DEFAULT_LIBRARY, reviveLibrary).getSnapshot();
          if (legacy.favoriteIds.length) await libraryApi.migrate(legacy);
          window.localStorage.setItem(marker, "1");
        }
        await refreshFavorites();
        initialized.current = true;
      })().catch((error: unknown) => { initialization.current = null; throw error; });
    }
    await initialization.current;
  }, [refreshFavorites]);
  useEffect(() => {
    const report = (error: unknown) => setSyncError(`收藏同步失败：${error instanceof Error ? error.message : String(error)}`);
    void initialize().catch(report);
    const refresh = () => { void refreshFavorites().catch(report); };
    window.addEventListener("signal-library-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("signal-library-changed", refresh); window.removeEventListener("focus", refresh); };
  }, [initialize, refreshFavorites]);
  const toggleFavorite = useCallback((id: string) => {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    void (async () => {
      await initialize();
      if (!initialized.current) return;
      const current = getPersistentStore(STORAGE_KEYS.library, DEFAULT_LIBRARY, reviveLibrary).getSnapshot();
      if (current.favoriteIds.includes(id)) await libraryApi.unsave(Number(id));
      else { await libraryApi.save(Number(id)); if (current.readIds.includes(id)) await libraryApi.update(Number(id), { status: "read" }); setCollectionTarget(id); }
      await refreshFavorites();
    })().catch((error: unknown) => setSyncError(`收藏操作失败：${error instanceof Error ? error.message : String(error)}`))
      .finally(() => pending.current.delete(id));
  }, [initialize, refreshFavorites]);

  const isRead = useCallback(
    (id: string) => state.readIds.includes(id),
    [state.readIds],
  );

  const markRead = useCallback((ids: string[], read = true) => {
    const current = getPersistentStore(STORAGE_KEYS.library, DEFAULT_LIBRARY, reviveLibrary).getSnapshot();
    setState((prev) => ({ ...prev, readIds: read ? [...new Set([...prev.readIds, ...ids])] : prev.readIds.filter((id) => !ids.includes(id)) }));
    void Promise.all(ids.filter((id) => current.favoriteIds.includes(id)).map((id) => libraryApi.update(Number(id), { status: read ? "read" : "later" })))
      .catch(() => setSyncError("阅读状态同步失败，请在研究库重试。"));
  }, [setState]);
  const toggleRead = useCallback((id: string) => {
    const current = getPersistentStore(STORAGE_KEYS.library, DEFAULT_LIBRARY, reviveLibrary).getSnapshot();
    markRead([id], !current.readIds.includes(id));
  }, [markRead]);
  const addToQueue = useCallback(async (id: string) => {
    await initialize(); await libraryApi.save(Number(id)); await libraryApi.update(Number(id), { status: "later" });
    setState((current) => ({ ...current, readIds: current.readIds.filter((readId) => readId !== id) }));
    await refreshFavorites();
  }, [initialize, refreshFavorites, setState]);

  const getNote = useCallback((id: string) => state.notes[id] ?? "", [state.notes]);

  const setNote = useCallback(
    (id: string, text: string) =>
      setState((prev) => ({ ...prev, notes: { ...prev.notes, [id]: text } })),
    [setState],
  );

  const importLibrary = useCallback(async (incoming: LibraryState) => {
    await initialize();
    await libraryApi.migrate(incoming);
    setState((current) => mergeLibrary(current, incoming));
    await refreshFavorites();
  }, [initialize, refreshFavorites, setState]);
  const value = useMemo(
    () => ({
      ...state,
      importLibrary,
      isFavorite,
      toggleFavorite,
      isRead,
      toggleRead,
      markRead,
      addToQueue,
      getNote,
      setNote,
    }),
    [state, importLibrary, isFavorite, toggleFavorite, isRead, toggleRead, markRead, addToQueue, getNote, setNote],
  );

  return (
    <LibraryContext.Provider value={value}>
      {syncError && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-xl rounded-md border border-danger bg-panel p-4 text-sm text-danger">{syncError}<button className="ml-3 underline" onClick={() => { void (initialized.current ? refreshFavorites() : initialize()).catch((error: unknown) => setSyncError(String(error))); }}>重试同步</button></div>}
      {children}
      <CollectionPicker key={collectionTarget ?? "closed"} articleId={collectionTarget} onClose={() => setCollectionTarget(null)} />
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

/* ============================================================
   Topics (subscription state)
   ============================================================ */

interface TopicsContextValue extends TopicsState {
  isSubscribed: (id: TopicId) => boolean;
  toggleSubscribed: (id: TopicId) => void;
}

const TopicsContext = createContext<TopicsContextValue | null>(null);

const DEFAULT_TOPICS: TopicsState = {
  subscribedIds: ["llm-reasoning", "ai-coding", "physical-ai"],
};

/** Topic ids that no longer exist, mapped to the topic that absorbed them. */
const LEGACY_TOPIC_IDS: Record<string, TopicId> = {
  vla: "physical-ai",
  "robot-learning": "physical-ai",
  "world-models": "physical-ai",
};

const reviveTopics = (raw: TopicsState): TopicsState => {
  const seen = new Set<TopicId>();
  for (const id of raw.subscribedIds ?? []) {
    const mapped = LEGACY_TOPIC_IDS[id] ?? (id as TopicId);
    seen.add(mapped);
  }
  return { subscribedIds: [...seen] };
};

export function TopicsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = usePersistentState<TopicsState>(
    STORAGE_KEYS.topics,
    DEFAULT_TOPICS,
    reviveTopics,
  );

  const isSubscribed = useCallback(
    (id: TopicId) => state.subscribedIds.includes(id),
    [state.subscribedIds],
  );

  const toggleSubscribed = useCallback(
    (id: TopicId) =>
      setState((prev) => {
        const has = prev.subscribedIds.includes(id);
        return {
          subscribedIds: has
            ? prev.subscribedIds.filter((t) => t !== id)
            : [...prev.subscribedIds, id],
        };
      }),
    [setState],
  );

  const value = useMemo(
    () => ({ ...state, isSubscribed, toggleSubscribed }),
    [state, isSubscribed, toggleSubscribed],
  );

  return (
    <TopicsContext.Provider value={value}>{children}</TopicsContext.Provider>
  );
}

export function useTopics(): TopicsContextValue {
  const ctx = useContext(TopicsContext);
  if (!ctx) throw new Error("useTopics must be used within TopicsProvider");
  return ctx;
}

/* ============================================================
   Settings
   ============================================================ */

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setFocusWeight: (id: TopicId, weight: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT_SETTINGS: AppSettings = {
  dailySignalCount: 10,
  defaultSort: "importance",
  focusAreas: TOPICS.map((t) => ({
    id: t.id,
    label: TOPIC_NAMES[t.id],
    // Shared with the server so scoring and UI agree on the defaults.
    weight: DEFAULT_FOCUS_WEIGHTS[t.id],
  })),
  dataStatus: "never-synced",
  lastSyncedAt: null,
};

/**
 * Always rebuild the focus-area list from the current taxonomy so a stored
 * snapshot cannot resurrect retired topic ids (vla / robot-learning /
 * world-models) in the Settings UI.
 */
const reviveSettings = (raw: AppSettings): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...raw,
  focusAreas: DEFAULT_SETTINGS.focusAreas,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = usePersistentState<AppSettings>(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS,
    reviveSettings,
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  const setFocusWeight = useCallback(
    (id: TopicId, weight: number) =>
      setSettings((prev) => ({
        ...prev,
        focusAreas: prev.focusAreas.map((area) =>
          area.id === id ? { ...area, weight: clamp(weight, 0, 100) } : area,
        ),
      })),
    [setSettings],
  );

  const value = useMemo(
    () => ({ settings, updateSettings, setFocusWeight }),
    [settings, updateSettings, setFocusWeight],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

/* ============================================================
   Root composition
   ============================================================ */

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LibraryProvider>
        <TopicsProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </TopicsProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}