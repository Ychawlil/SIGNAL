"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Tag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { libraryApi } from "./api";
import type {
  CollectionItem,
  CustomKeyword,
  CustomTopic,
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
            New research collection
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="专题标题，例如：VLA 与机器人操作"
                className="sm:flex-1"
                aria-label="Collection title"
              />
              <Button variant="primary" size="sm" onClick={create} disabled={!title.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Create
              </Button>
            </div>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="专题说明（可选）"
              aria-label="Collection description"
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
                  aria-label="Delete collection"
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
                      暂无条目。在收藏条目卡片的「Add to collection」中把情报加入此专题。
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
                            aria-label="Remove from collection"
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
   Topics & keywords
   ============================================================ */

export function TopicsTab({
  refreshToken,
  onMutate,
}: {
  refreshToken: number;
  onMutate: () => void;
}) {
  const [topics, setTopics] = useState<CustomTopic[] | null>(null);
  const [keywords, setKeywords] = useState<CustomKeyword[] | null>(null);
  const [topicName, setTopicName] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [keyword, setKeyword] = useState("");
  const [keywordTopic, setKeywordTopic] = useState("");

  const reload = () => {
    libraryApi.topics().then((d) => setTopics(d.topics)).catch(() => {});
    libraryApi.keywords().then((d) => setKeywords(d.keywords)).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    Promise.all([libraryApi.topics(), libraryApi.keywords()])
      .then(([t, k]) => {
        if (active) {
          setTopics(t.topics);
          setKeywords(k.keywords);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshToken]);

  const createTopic = () => {
    if (!topicName.trim()) return;
    libraryApi
      .createTopic(topicName.trim(), topicDescription.trim())
      .then(() => {
        setTopicName("");
        setTopicDescription("");
        reload();
        onMutate();
      })
      .catch(() => {});
  };

  const createKeyword = () => {
    if (!keyword.trim()) return;
    libraryApi
      .createKeyword(keyword.trim(), keywordTopic ? Number(keywordTopic) : null)
      .then(() => {
        setKeyword("");
        reload();
        onMutate();
      })
      .catch(() => {});
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            Custom topics
          </p>
          <div className="flex flex-col gap-2">
            <Input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="主题名称，例如：人形机器人数据" aria-label="Topic name" />
            <Input value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)} placeholder="简短介绍（可选）" aria-label="Topic description" />
            <Button variant="primary" size="sm" onClick={createTopic} disabled={!topicName.trim()} className="self-start">
              <Plus className="h-3.5 w-3.5" /> Add topic
            </Button>
          </div>
          {topics === null ? (
            <p className="mt-3 text-sm text-muted-foreground">加载中…</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {topics.map((topic) => (
                <li key={topic.id} className="flex items-center gap-2 text-sm">
                  <Tag className="h-3.5 w-3.5 text-muted-accent" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{topic.name}</span>
                  {topic.description && <span className="hidden text-xs text-muted-foreground sm:inline">{topic.description}</span>}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete topic"
                    onClick={() => libraryApi.deleteTopic(topic.id).then(reload).catch(() => {})}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            Custom keywords
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createKeyword()} placeholder="关键词，例如：world model" aria-label="Keyword" className="flex-1" />
              <Select value={keywordTopic} onChange={(e) => setKeywordTopic(e.target.value)} aria-label="Keyword topic" className="w-40">
                <option value="">无主题</option>
                {(topics ?? []).map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" size="sm" onClick={createKeyword} disabled={!keyword.trim()} className="self-start">
              <Plus className="h-3.5 w-3.5" /> Add keyword
            </Button>
          </div>
          {keywords === null ? (
            <p className="mt-3 text-sm text-muted-foreground">加载中…</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <Badge key={kw.id} variant="default" className="gap-1">
                  {kw.keyword}
                  <button
                    aria-label="Delete keyword"
                    onClick={() => libraryApi.deleteKeyword(kw.id).then(reload).catch(() => {})}
                    className="text-muted-foreground hover:text-danger"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
            Weekly research review · {review.weekStart}
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
            Learning suggestions
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
