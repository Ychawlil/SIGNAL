"use client";

import { useEffect, useState } from "react";
import { Bookmark, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { StoredArticle } from "@/lib/server/types";
import { libraryApi } from "./api";

function fetchArticles(q: string): Promise<{ articles: StoredArticle[]; total: number }> {
  return fetch(`/api/intelligence?pageSize=30&q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  }).then((r) => {
    if (!r.ok) throw new Error(`Article request failed (${r.status})`);
    return r.json();
  });
}

export function DiscoverTab({
  refreshToken,
  onMutate,
}: {
  refreshToken: number;
  onMutate: () => void;
}) {
  const [q, setQ] = useState("");
  const [articles, setArticles] = useState<StoredArticle[] | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchArticles(q)
      .then((data) => {
        if (active) {
          setArticles(data.articles);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [q, refreshToken]);

  useEffect(() => {
    let active = true;
    libraryApi
      .list({ status: "all" })
      .then((data) => {
        if (active) setSavedIds(new Set(data.items.map((i) => i.article.id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshToken]);

  const toggleSave = (articleId: number) => {
    const saved = savedIds.has(articleId);
    const action = saved ? libraryApi.unsave(articleId) : libraryApi.save(articleId);
    action
      .then(() => {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (saved) next.delete(articleId);
          else next.add(articleId);
          return next;
        });
        onMutate();
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索已采集的真实情报（标题 / 摘要 / 标签）…"
          className="pl-9"
          aria-label="Search articles to save"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {articles === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="没有找到情报"
          description="先在 Settings 中 Sync now 采集真实数据，再回来收藏。"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => {
            const saved = savedIds.has(article.id);
            return (
              <li key={article.id} className="flex items-start gap-3 rounded-md border border-border bg-panel p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="font-mono uppercase tracking-wide">
                      {article.category}
                    </Badge>
                    <span className="text-muted-foreground">
                      {article.sourceName} · {article.publishedAt.slice(0, 10)}
                    </span>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm font-semibold leading-6 text-foreground hover:text-accent"
                  >
                    {article.title}
                  </a>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{article.summary}</p>
                </div>
                <Button
                  variant={saved ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => toggleSave(article.id)}
                >
                  <Bookmark className={saved ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
                  {saved ? "Saved" : "Save"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
