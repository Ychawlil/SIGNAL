"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPlanet } from "@/lib/universe/planets";
import type { CSSProperties } from "react";
import { groupEvents } from "@/lib/event-matching";
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
  ids?: string[];
  excludeIds?: string[];
  planet?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.planet) qs.set("planet", params.planet);
  if (params.excludeIds?.length) qs.set("excludeIds", params.excludeIds.join(","));
  if (params.ids) qs.set("ids", params.ids.join(","));
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
  const { favoriteIds, readIds, markRead } = useLibrary();
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const planet = getPlanet(searchParams.get("planet"));
  const planetId = planet?.id;

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const openId = searchParams.get("open") === dismissedId ? null : searchParams.get("open");
  const [linkedItem, setLinkedItem] = useState<IntelligenceItem | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
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
  const [readingFilter, setReadingFilter] = useState<"all" | "unread" | "read">("all");
  const [groupMode, setGroupMode] = useState(false);
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

  const filterIds = favoritesOnly ? (readingFilter === "read" ? favoriteIds.filter((id) => readIds.includes(id)) : favoriteIds) : readingFilter === "read" ? readIds : undefined;
  const queryIds = filterIds?.join(",");
  const excludedIds = readingFilter === "unread" ? readIds.join(",") : "";
  const generation = useRef(0);
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
    generation.current += 1;
    requestSignals(
      buildQuery({ q: debouncedQuery, planet: planetId, category, topic, source, sort, ids: queryIds === undefined ? undefined : queryIds.split(",").filter(Boolean), excludeIds: excludedIds ? excludedIds.split(",") : undefined, page: 1 }),
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
  }, [debouncedQuery, category, topic, source, sort, refreshToken, queryIds, excludedIds, planetId]);

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

  const visibleItems = items;
  const eventGroups = groupMode ? groupEvents(items.map((item) => ({ id: Number(item.id), title: item.title, url: item.sourceUrl, publishedAt: item.publishedAt, view: item }))).map((entries) => entries.map((entry) => entry.view)) : items.map((item) => [item]);
  const otherSources = (group: IntelligenceItem[]) => group.length > 1 ? <details className="mt-2 rounded-xl border border-border bg-panel p-3"><summary className="cursor-pointer text-xs text-accent">同一事件 · {group.length} 条来源</summary><ul className="mt-2 space-y-2">{group.slice(1).map((entry) => <li key={entry.id}><button className="text-left text-sm text-foreground hover:text-accent" onClick={() => setSelected(entry)}>{entry.title}</button><p className="text-xs text-muted-foreground">{entry.sourceName}</p></li>)}</ul></details> : null;

  useEffect(() => {
    if (!openId) return;
    const controller = new AbortController();
    fetch(`/api/signals/${encodeURIComponent(openId)}`, { signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error(r.status === 404 ? "情报不存在" : "详情加载失败"); return r.json() as Promise<SignalRecord>; })
      .then((record) => { if (!controller.signal.aborted) { setLinkedItem(toIntelligenceItem(record)); setDetailError(null); } })
      .catch((error: unknown) => { if (!controller.signal.aborted) setDetailError(String(error)); });
    return () => controller.abort();
  }, [openId]);
  const detailItem = selected ?? (linkedItem?.id === openId ? linkedItem : null);

  const hasMore = records.length < total;
  const hasActiveFilters =
    debouncedQuery.trim() !== "" ||
    category !== "all" ||
    topic !== "all" ||
    source !== "all" ||
    favoritesOnly || readingFilter !== "all";

  const sources = stats?.sources ?? [];

  const resetFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setCategory("all");
    setTopic("all");
    setSource("all");
    setFavoritesOnly(false);
    setReadingFilter("all");
    setLoading(true);
    setRefreshToken((token) => token + 1);
  };

  const loadMore = () => {
    const requestGeneration = generation.current;
    setLoadingMore(true);
    requestSignals(
      buildQuery({ q: debouncedQuery, planet: planetId, category, topic, source, sort, ids: queryIds === undefined ? undefined : queryIds.split(",").filter(Boolean), excludeIds: excludedIds ? excludedIds.split(",") : undefined, page: page + 1 }),
    )
      .then((data) => {
        if (requestGeneration !== generation.current) return;
        setRecords((prev) => [...prev, ...data.items]);
        setTotal(data.total);
        setPage((prev) => prev + 1);
      })
      .catch((err: unknown) => { if (requestGeneration === generation.current) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="flex flex-col gap-6" style={planet ? { "--accent": planet.color, "--accent-soft": `color-mix(in srgb, ${planet.color} 12%, var(--panel))` } as CSSProperties : undefined}>
      {planet && <Link href="/" className="text-xs text-muted-foreground hover:text-accent">← 返回全景</Link>}
      <header className="page-header flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            情报
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            {planet?.label ?? "探索"}
          </h1>
          {planet && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{planet.description}</p>}
        </div>
        <Segmented<ViewMode>
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "列表", icon: <List className="h-3.5 w-3.5" /> },
            { value: "grid", label: "卡片", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
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
              placeholder="搜索关键词、标签或来源…"
              className="pl-9"
              aria-label="搜索情报"
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
            收藏
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-accent" />
          <Select value={readingFilter} aria-label="阅读状态筛选" onChange={(event) => { setReadingFilter(event.target.value as "all" | "read" | "unread"); setLoading(true); }} className="w-full sm:w-40"><option value="all">全部阅读状态</option><option value="unread">只看未读</option><option value="read">只看已读</option></Select>
          <Button size="sm" variant={groupMode ? "primary" : "outline"} aria-pressed={groupMode} onClick={() => setGroupMode((value) => !value)}>同事件聚合</Button>
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryId | "all");
              setLoading(true);
            }}
            aria-label="按分类筛选"
            className="w-full sm:w-56"
          >
            <option value="all">全部分类</option>
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
            aria-label="按主题筛选"
            className="w-full sm:w-48"
          >
            <option value="all">全部主题</option>
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
            aria-label="按来源筛选"
            className="w-full sm:w-52"
          >
            <option value="all">全部来源</option>
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
            aria-label="排序方式"
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>当前已加载 {items.length} 条，已读 {items.filter((item) => readIds.includes(item.id)).length} 条{groupMode ? ` · 聚合为 ${eventGroups.length} 个事件（仅当前已加载内容）` : ""}</span><Button size="sm" variant="outline" disabled={!items.length || loading} onClick={() => markRead(items.map((item) => item.id))}>已加载结果全部标记已读</Button></div>
      {/* Results */}
      <div>
        <p className="mb-3 font-mono text-xs tabular-nums text-muted-foreground">
          {total} 条情报
          {hasActiveFilters ? " · 已筛选" : ""}
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
              重试
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
            title="没有匹配的情报"
            description="调整关键词或筛选条件后再试，或先在设置中采集数据。"
            action={
              <Button size="sm" variant="outline" onClick={resetFilters}>
                清除筛选
              </Button>
            }
          />
        ) : !error && view === "grid" ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {eventGroups.map((group) => <div key={group[0].id} className="flex flex-col"><ItemCard item={group[0]} onOpen={setSelected} />{otherSources(group)}</div>)}
          </div>
        ) : !error ? (
          <div className="flex flex-col gap-2.5">
            {eventGroups.map((group) => <div key={group[0].id}><ItemRow item={group[0]} onOpen={setSelected} />{otherSources(group)}</div>)}
          </div>
        ) : null}

        {!error && !loading && hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? "加载中…" : `加载更多（剩余 ${total - records.length} 条）`}
            </Button>
          </div>
        )}
      </div>

      <Drawer
        open={detailItem !== null || openId !== null}
        onClose={() => {
          setSelected(null);
          setDismissedId(openId);
        }}
        title="情报详情"
      >
        {detailItem ? <ItemDetail key={detailItem.id} item={detailItem} /> : <p className="p-5" role="status">{detailError ?? "正在加载详情…"}</p>}
      </Drawer>
    </div>
  );
}
