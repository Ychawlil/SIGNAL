"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, RefreshCw, Search, SlidersHorizontal, Star } from "lucide-react";
import { ItemCard } from "@/components/items/item-card";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRow } from "@/components/items/item-row";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useLibrary, useSettings } from "@/components/providers";
import { CATEGORIES, SORT_OPTIONS, TOPIC_NAMES } from "@/lib/constants";
import { toIntelligenceItem, type SignalRecord } from "@/lib/signals";
import type { CategoryId, IntelligenceItem, SortKey, TopicId } from "@/lib/types";
import type { SignalStats } from "@/lib/server/signals";

type ViewMode = "list" | "grid";
const PAGE_SIZE = 60;

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-panel px-4 py-3">
      <div className="h-3 w-24 rounded bg-panel-secondary" />
      <div className="mt-2.5 h-4 w-3/4 rounded bg-panel-secondary" />
      <div className="mt-2 h-3 w-1/2 rounded bg-panel-secondary" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border bg-panel p-4"
        >
          <div className="h-3 w-16 rounded bg-panel-secondary" />
          <div className="mt-3 h-4 w-full rounded bg-panel-secondary" />
          <div className="mt-2 h-3 w-5/6 rounded bg-panel-secondary" />
          <div className="mt-4 h-3 w-1/3 rounded bg-panel-secondary" />
        </div>
      ))}
    </div>
  );
}

function buildQuery(params: {
  q: string;
  category: CategoryId | "all";
  topic: TopicId | "all";
  source: string;
  sort: SortKey;
  page: number;
}): string {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", String(PAGE_SIZE));
  if (params.q.trim()) qs.set("q", params.q.trim());
  if (params.category !== "all") qs.set("category", params.category);
  if (params.topic !== "all") qs.set("topic", params.topic);
  if (params.source !== "all") qs.set("source", params.source);
  qs.set("sort", params.sort);
  return `/api/signals?${qs.toString()}`;
}

async function requestSignals(
  url: string,
  signal?: AbortSignal,
): Promise<{ items: SignalRecord[]; total: number }> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`请求失败 (${response.status})`);
  return response.json() as Promise<{ items: SignalRecord[]; total: number }>;
}

export function ExploreClient() {
  const { isFavorite } = useLibrary();
  const { settings } = useSettings();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [openId, setOpenId] = useState(() => searchParams.get("open") ?? null);
  const [category, setCategory] = useState<CategoryId | "all">(() => {
    const value = searchParams.get("category");
    return value && CATEGORIES.some((c) => c.id === value)
      ? (value as CategoryId)
      : "all";
  });
  const [topic, setTopic] = useState<TopicId | "all">(() => {
    const value = searchParams.get("topic");
    return value && Object.keys(TOPIC_NAMES).includes(value)
      ? (value as TopicId)
      : "all";
  });
  const [source, setSource] = useState<string>("all");
  // `null` means "follow the default sort saved in Settings"; once the user
  // picks a sort in this view we stop overriding their choice.
  const [explicitSort, setExplicitSort] = useState<SortKey | null>(null);
  const sort = explicitSort ?? settings.defaultSort;
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  const [records, setRecords] = useState<SignalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [selected, setSelected] = useState<IntelligenceItem | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search input before it drives a server request.
  useEffect(() => {
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    requestSignals(
      buildQuery({ q: debouncedQuery, category, topic, source, sort, page: 1 }),
      controller.signal,
    )
      .then((data) => {
        if (active) {
          setRecords(data.items);
          setTotal(data.total);
          setPage(1);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery, category, topic, source, sort, refreshToken]);

  useEffect(() => {
    let active = true;
    fetch("/api/signals/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: SignalStats) => {
        if (active) setStats(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => records.map(toIntelligenceItem), [records]);

  const visibleItems = useMemo(
    () => (favoritesOnly ? items.filter((item) => isFavorite(item.id)) : items),
    [favoritesOnly, items, isFavorite],
  );

  const openItem = useMemo(
    () => (openId ? (items.find((item) => item.id === openId) ?? null) : null),
    [openId, items],
  );

  const detailItem = selected ?? openItem;

  const hasMore = records.length < total;
  const hasActiveFilters =
    debouncedQuery.trim() !== "" ||
    category !== "all" ||
    topic !== "all" ||
    source !== "all" ||
    favoritesOnly;

  const sources = stats?.sources ?? [];

  const resetFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setCategory("all");
    setTopic("all");
    setSource("all");
    setFavoritesOnly(false);
  };

  const loadMore = () => {
    setLoadingMore(true);
    requestSignals(
      buildQuery({ q: debouncedQuery, category, topic, source, sort, page: page + 1 }),
    )
      .then((data) => {
        setRecords((prev) => [...prev, ...data.items]);
        setTotal(data.total);
        setPage((prev) => prev + 1);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            Intelligence
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            Explore
          </h1>
        </div>
        <Segmented<ViewMode>
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List", icon: <List className="h-3.5 w-3.5" /> },
            { value: "grid", label: "Grid", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
          ]}
        />
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLoading(true);
              }}
              placeholder="Search by keyword, tag, or source…"
              className="pl-9"
              aria-label="Search intelligence"
            />
          </div>
          <Button
            variant={favoritesOnly ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setFavoritesOnly((v) => !v);
              setLoading(true);
            }}
          >
            <Star className={favoritesOnly ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
            Favorites
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-accent" />
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryId | "all");
              setLoading(true);
            }}
            aria-label="Filter by category"
            className="w-full sm:w-56"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>

          <Select
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value as TopicId | "all");
              setLoading(true);
            }}
            aria-label="Filter by subject"
            className="w-full sm:w-48"
          >
            <option value="all">All subjects</option>
            {(Object.keys(TOPIC_NAMES) as TopicId[]).map((id) => (
              <option key={id} value={id}>
                {TOPIC_NAMES[id]}
              </option>
            ))}
          </Select>

          <Select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setLoading(true);
            }}
            aria-label="Filter by source"
            className="w-full sm:w-52"
          >
            <option value="all">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Select
            value={sort}
            onChange={(e) => {
              setExplicitSort(e.target.value as SortKey);
              setLoading(true);
            }}
            aria-label="Sort by"
            className="w-full sm:w-44"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Results */}
      <div>
        <p className="mb-3 font-mono text-xs tabular-nums text-muted-foreground">
          {favoritesOnly ? visibleItems.length : total} signal{total === 1 ? "" : "s"}
          {hasActiveFilters ? " · filtered" : ""}
        </p>

        {error && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
            <p className="text-sm text-danger">加载失败：{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setError(null);
                setRefreshToken((t) => t + 1);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!error && loading ? (
          view === "grid" ? (
            <SkeletonGrid />
          ) : (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )
        ) : !error && visibleItems.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No matching signals"
            description="调整关键词或筛选条件后再试，或先在 Settings 中采集数据。"
            action={
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : !error && view === "grid" ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        ) : !error ? (
          <div className="flex flex-col gap-2.5">
            {visibleItems.map((item) => (
              <ItemRow key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        ) : null}

        {!error && !loading && hasMore && !favoritesOnly && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? "Loading…" : `Load more (${total - records.length} remaining)`}
            </Button>
          </div>
        )}
      </div>

      <Drawer
        open={detailItem !== null}
        onClose={() => {
          setSelected(null);
          setOpenId(null);
        }}
        title="Intelligence detail"
      >
        {detailItem ? <ItemDetail item={detailItem} /> : null}
      </Drawer>
    </div>
  );
}
