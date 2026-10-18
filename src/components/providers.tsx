"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
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
    (raw) => (raw === "light" ? "light" : "dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), [setThemeState]);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
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
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isRead: (id: string) => boolean;
  toggleRead: (id: string) => void;
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

  const toggleFavorite = useCallback(
    (id: string) =>
      setState((prev) => {
        const has = prev.favoriteIds.includes(id);
        return {
          ...prev,
          favoriteIds: has
            ? prev.favoriteIds.filter((f) => f !== id)
            : [...prev.favoriteIds, id],
        };
      }),
    [setState],
  );

  const isRead = useCallback(
    (id: string) => state.readIds.includes(id),
    [state.readIds],
  );

  const toggleRead = useCallback(
    (id: string) =>
      setState((prev) => {
        const has = prev.readIds.includes(id);
        return {
          ...prev,
          readIds: has
            ? prev.readIds.filter((r) => r !== id)
            : [...prev.readIds, id],
        };
      }),
    [setState],
  );

  const getNote = useCallback((id: string) => state.notes[id] ?? "", [state.notes]);

  const setNote = useCallback(
    (id: string, text: string) =>
      setState((prev) => ({ ...prev, notes: { ...prev.notes, [id]: text } })),
    [setState],
  );

  const value = useMemo(
    () => ({
      ...state,
      isFavorite,
      toggleFavorite,
      isRead,
      toggleRead,
      getNote,
      setNote,
    }),
    [state, isFavorite, toggleFavorite, isRead, toggleRead, getNote, setNote],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
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