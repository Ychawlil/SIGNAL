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
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { CATEGORY_MAP } from "@/lib/constants";
import { toIntelligenceItem, type SignalRecord } from "@/lib/signals";
import type { IntelligenceItem } from "@/lib/types";
import { TimeAgo } from "@/components/live-time";
import { ImportanceMeter } from "@/components/items/meta";
import { EmptyState } from "@/components/ui/empty-state";

interface SearchContextValue {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openSearch, closeSearch }),
    [open, openSearch, closeSearch],
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchDialog open={open} onClose={closeSearch} />
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}

function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IntelligenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  // Debounced search against the real intelligence database.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      fetch(`/api/signals?pageSize=8&q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { items: SignalRecord[] }) => {
          setResults(data.items.map(toIntelligenceItem));
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const goToExplore = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/explore?${params.toString()}`);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button
        aria-label="Close search"
        onClick={handleClose}
        className="absolute inset-0 cursor-default bg-overlay/80 backdrop-blur-[1px]"
      />
      <div className="fade-in absolute inset-x-0 top-[10vh] mx-auto w-[calc(100%-2rem)] max-w-xl rounded-lg border border-border bg-panel shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToExplore();
            }}
            placeholder="搜索情报、标签、来源…"
            className="h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() === "" ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">—</p>
          ) : loading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              检索中…
            </p>
          ) : results.length === 0 ? (
            <div className="p-2">
              <EmptyState
                icon={<Search />}
                title="没有匹配的结果"
                description="尝试更短的关键词，或直接前往 Explore 使用完整筛选。"
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      router.push(`/explore?open=${item.id}`);
                      onClose();
                    }}
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-panel-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{CATEGORY_MAP[item.category]?.shortLabel}</span>
                        <TimeAgo iso={item.publishedAt} />
                        <ImportanceMeter score={item.importanceScore} />
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>Enter 前往 Explore 查看全部结果</span>
          <button
            onClick={goToExplore}
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            All results <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
