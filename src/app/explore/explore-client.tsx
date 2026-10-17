"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, SlidersHorizontal, Star } from "lucide-react";
import { ItemCard } from "@/components/items/item-card";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRow } from "@/components/items/item-row";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useLibrary } from "@/components/providers";
import { CATEGORIES, SORT_OPTIONS, TOPIC_NAMES } from "@/lib/constants";
import { INTELLIGENCE_ITEMS } from "@/lib/mock-data";
import type {
  CategoryId,
  IntelligenceItem,
  SortKey,
  TopicId,
} from "@/lib/types";

type ViewMode = "list" | "grid";

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

/** User-action-driven loading skeleton (never setState inside an effect). */
function useSimulatedLoading(delay = 260) {
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const begin = useCallback(() => {
    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLoading(false), delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [loading, begin] as const;
}

export function ExploreClient() {
  const { isFavorite } = useLibrary();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [source, setSource] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [loading, beginLoading] = useSimulatedLoading();
  const [selected, setSelected] = useState<IntelligenceItem | null>(
    () =>
      INTELLIGENCE_ITEMS.find((i) => i.id === searchParams.get("open")) ?? null,
  );

  const sources = useMemo(
    () => Array.from(new Set(INTELLIGENCE_ITEMS.map((i) => i.sourceName))).sort(),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = INTELLIGENCE_ITEMS.filter((item) => {
      if (q) {
        const haystack = [
          item.title,
          item.summary,
          item.keyChange,
          item.sourceName,
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!q.split(/\s+/).every((token) => haystack.includes(token))) {
          return false;
        }
      }
      if (category !== "all" && item.category !== category) return false;
      if (topic !== "all" && !item.topics.includes(topic)) return false;
      if (source !== "all" && item.sourceName !== source) return false;
      if (favoritesOnly && !isFavorite(item.id)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "importance") return b.importanceScore - a.importanceScore;
      if (sort === "confidence") {
        const order = { high: 3, medium: 2, low: 1 } as const;
        return order[b.confidenceLevel] - order[a.confidenceLevel];
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [query, category, topic, source, sort, favoritesOnly, isFavorite]);

  const hasActiveFilters =
    query.trim() !== "" ||
    category !== "all" ||
    topic !== "all" ||
    source !== "all" ||
    favoritesOnly;

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
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            浏览、检索与筛选全部示例情报。收藏入口与详情操作均已可用。
          </p>
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
                beginLoading();
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
              beginLoading();
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
              beginLoading();
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
              beginLoading();
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
              beginLoading();
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
              setSort(e.target.value as SortKey);
              beginLoading();
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
          {results.length} signal{results.length === 1 ? "" : "s"}
          {hasActiveFilters ? " · filtered" : ""}
        </p>

        {loading ? (
          view === "grid" ? (
            <SkeletonGrid />
          ) : (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )
        ) : results.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No matching signals"
            description="调整关键词或筛选条件后再试。"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setTopic("all");
                  setSource("all");
                  setFavoritesOnly(false);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {results.map((item) => (
              <ItemRow key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Intelligence detail"
      >
        {selected && <ItemDetail item={selected} />}
      </Drawer>
    </div>
  );
}
