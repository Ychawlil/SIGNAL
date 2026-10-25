"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { libraryApi } from "./api";
import type {
  CollectionItem,
  LearningPlan,
  ResearchCollection,
  WeeklyReview,
} from "@/lib/server/library/types";

/* ============================================================
   Collections
   ============================================================ */

export function CollectionsTab({
  refreshToken,
  onMutate,
}: {
  refreshToken: number;
  onMutate: () => void;
}) {
  const [collections, setCollections] = useState<ResearchCollection[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    libraryApi
      .collections()
      .then((data) => setCollections(data.collections))
      .catch(() => {});
  };

  useEffect(() => {
    let active = true;
    libraryApi
      .collections()
      .then((data) => {
        if (active) setCollections(data.collections);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  const openCollection = (id: number) => {
    setOpenId(id);
    libraryApi
      .collectionItems(id)
      .then((data) => setItems(data.items))
      .catch(() => {});
  };

  const create = () => {
    if (!title.trim()) return;
    libraryApi
      .createCollection(title.trim(), description.trim())
      .then(() => {
        setTitle("");
        setDescription("");
        reload();
        onMutate();
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            新建研究合集
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="专题标题，例如：VLA 与机器人操作"
                className="sm:flex-1"
                aria-label="合集名称"
              />
              <Button variant="primary" size="sm" onClick={create} disabled={!title.trim()}>
                <Plus className="h-3.5 w-3.5" />
                创建
              </Button>
            </div>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="专题说明（可选）"
              aria-label="合集说明"
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      {collections === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : collections.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="还没有研究专题"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {collections.map((collection) => (
            <div key={collection.id} className="rounded-lg border border-border bg-panel">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <button
                  onClick={() => openCollection(collection.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {collection.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {collection.itemCount} 条 · {collection.description || "（无说明）"}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="删除合集"
                  onClick={() =>
                    libraryApi
                      .deleteCollection(collection.id)
                      .then(() => {
                        if (openId === collection.id) setOpenId(null);
                        reload();
                        onMutate();
                      })
                      .catch(() => {})
                  }
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {openId === collection.id && (
                <div className="border-t border-border px-4 pb-3 pt-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      暂无条目。在收藏条目卡片的「加入合集」中把情报加入此专题。
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {items.map((item) => (
                        <li key={item.articleId} className="flex items-center gap-2 text-xs leading-5">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-muted-foreground hover:text-accent"
                          >
                            {item.title}
                          </a>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {item.publishedAt.slice(0, 10)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="移出合集"
                            onClick={() =>
                              libraryApi
                                .removeCollectionItem(collection.id, item.articleId)
                                .then(() => openCollection(collection.id))
                                .catch(() => {})
                            }
                            className="text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Weekly review + suggestions
   ============================================================ */

export function WeeklyTab({ refreshToken }: { refreshToken: number }) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([libraryApi.weeklyReview(), libraryApi.suggestions()])
      .then(([r, p]) => {
        if (active) {
          setReview(r);
          setPlan(p);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (review === null || plan === null) return <p className="text-sm text-muted-foreground">加载中…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            每周研究回顾 · {review.weekStart}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{review.note}</p>

          {review.importantChanges.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-foreground">重要变化</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {review.importantChanges.map((item) => (
                  <li key={item.title} className="rounded-md border border-border bg-panel-secondary p-3">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-accent">
                      {item.title}
                    </a>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.keyChange}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review.techRoutes.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-foreground">不同技术路线</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {review.techRoutes.map((route) => (
                  <li key={route.route} className="flex items-start gap-2 text-sm">
                    <Badge variant="accent" className="font-mono">
                      {route.count}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{route.route}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{route.titles.join(" · ")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review.openQuestions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-foreground">尚未解决的问题</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {review.openQuestions.map((item) => (
                  <li key={item.title} className="rounded-md border border-warning/40 bg-panel p-3 text-sm">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-accent">
                      {item.title}
                    </a>
                    <p className="mt-1 text-xs leading-5 text-warning">{item.question}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            学习建议
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{plan.disclaimer}</p>
          {plan.suggestions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">收藏一些情报后，这里会给出学习建议。</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {plan.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-panel-secondary p-3">
                  <Badge variant={suggestion.kind === "read" ? "accent" : "outline"} className="font-mono uppercase">
                    {suggestion.kind}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <a href={suggestion.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-accent">
                      {suggestion.title}
                    </a>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{suggestion.action}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
