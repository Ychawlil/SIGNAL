"use client";

import { useEffect, useState } from "react";
import { ImportanceMeter } from "@/components/items/meta";
import { downloadMarkdown, exportMarkdown } from "@/lib/markdown-export";
import { useLibrary } from "@/components/providers";
import { CATEGORY_MAP } from "@/lib/constants";
import { ChevronDown, History, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { libraryApi } from "./api";
import type {
  RelatedGroup,
  ResearchCollection,
  SaveStatus,
  SavedItemView,
} from "@/lib/server/library/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | SaveStatus;

function SavedItemCard({
  item,
  collections,
  onMutate,
}: {
  item: SavedItemView;
  collections: ResearchCollection[];
  onMutate: () => void;
}) {
  const [notes, setNotes] = useState(item.notes);
  const [tagInput, setTagInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [related, setRelated] = useState<{ article: { title: string }; groups: RelatedGroup[] } | null>(null);
  const [collectionId, setCollectionId] = useState("");

  const openHistory = () => {
    setHistoryOpen((v) => !v);
    if (!related) {
      libraryApi.related(item.article.id).then(setRelated).catch(() => {});
    }
  };

  const patch = (data: Partial<{ status: SaveStatus | null; notes: string; tags: string[] }>) => {
    libraryApi.update(item.article.id, data).then(onMutate).catch(() => {});
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (item.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    patch({ tags: [...item.tags, tag] });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    patch({ tags: item.tags.filter((t) => t !== tag) });
  };

  const addToCollection = () => {
    const id = Number(collectionId);
    if (!id) return;
    libraryApi.addCollectionItem(id, item.article.id, "").then(() => setCollectionId("")).catch(() => {});
  };

  return (
    <article className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="font-mono uppercase tracking-wide">
              {CATEGORY_MAP[item.article.category]?.label ?? item.article.category}
            </Badge>
            <span className="text-muted-foreground">
              {item.article.sourceName} · {item.article.publishedAt.slice(0, 10)}
            </span>
            {item.importanceScore !== null && (
              <span className="font-mono tabular-nums text-muted-foreground">
                <ImportanceMeter articleId={String(item.article.id)} score={item.importanceScore} />
              </span>
            )}
          </div>
          <a
            href={item.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 block text-sm font-semibold leading-6 text-foreground hover:text-accent"
          >
            {item.article.title}
          </a>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="取消研究库收藏"
          title="取消研究库收藏"
          onClick={() => libraryApi.unsave(item.article.id).then(onMutate).catch(() => {})}
          className="text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          value={item.status ?? "saved"}
          onChange={(e) => {
            const value = e.target.value;
            patch({ status: value === "saved" ? null : (value as SaveStatus) });
          }}
          aria-label="阅读状态"
          className="w-44"
        >
          <option value="saved">已收藏</option>
          <option value="later">稍后阅读</option>
          <option value="read">已读</option>
          <option value="reproduce">值得复现</option>
        </Select>

        <Button variant="outline" size="sm" onClick={openHistory}>
          <History className="h-3.5 w-3.5" />
          相关记录
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", historyOpen && "rotate-180")} />
        </Button>

        <div className="flex items-center gap-1.5">
          <Select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} aria-label="加入合集" className="w-40">
            <option value="">加入合集…</option>
            {collections.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.title}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={addToCollection} disabled={!collectionId}>
            添加
          </Button>
        </div>
      </div>

      {historyOpen && (
        <div className="fade-in mt-3 border-t border-border pt-3">
          {related === null ? (
            <p className="text-xs text-muted-foreground">加载历史记录…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {related.groups.map((group) => (
                <div key={group.key}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                    {group.label}
                  </p>
                  {group.items.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">暂无同一维度的历史记录。</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {group.items.map((rel) => (
                        <li key={rel.articleId} className="flex items-center gap-2 text-xs leading-5">
                          <a href={rel.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-muted-foreground hover:text-accent">
                            {rel.title}
                          </a>
                          <span className="font-mono tabular-nums text-muted-foreground">{rel.publishedAt.slice(0, 10)}</span>
                          {rel.saved && <Badge variant="accent">已收藏</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            笔记
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== item.notes) patch({ notes });
            }}
            placeholder="个人笔记、复现计划或待验证问题…"
            className="min-h-[72px] w-full resize-y rounded-md border border-border bg-panel-secondary px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        </div>
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
            标签
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => removeTag(tag)}
                title="移除标签"
                className="group inline-flex items-center gap-1 rounded-sm border border-border bg-panel-secondary px-1.5 py-0.5 text-xs text-foreground transition-colors hover:border-danger/50 hover:text-danger"
              >
                #{tag}
                <span className="text-muted-foreground group-hover:text-danger">×</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="添加标签…"
              className="h-8 text-sm"
            />
            <Button variant="secondary" size="sm" onClick={addTag}>
              添加
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SavedTab({
  initialStatus,
  refreshToken,
  onMutate,
}: {
  initialStatus?: StatusFilter;
  refreshToken: number;
  onMutate: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { favoriteIds } = useLibrary();
  const [status, setStatus] = useState<StatusFilter>(initialStatus ?? "all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SavedItemView[] | null>(null);
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    libraryApi
      .list({ status, q })
      .then((data) => {
        if (active) {
          setItems(data.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [status, q, refreshToken, favoriteIds]);

  useEffect(() => {
    let active = true;
    libraryApi
      .collections()
      .then((data) => {
        if (active) setCollections(data.collections);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshToken]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!initialStatus && <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "全部" },
            { value: "later", label: "稍后阅读" },
            { value: "read", label: "已读" },
            { value: "reproduce", label: "待复现" },
          ]}
        />}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题、笔记、标签…"
          className="w-full sm:w-64"
          aria-label="搜索研究库"
        />
      </div>

      {items && items.length > 0 && <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><label className="flex items-center gap-2"><input type="checkbox" checked={items.every((item) => selectedIds.includes(item.article.id))} onChange={(event) => setSelectedIds(event.target.checked ? items.map((item) => item.article.id) : [])} />选择当前结果</label><Button size="sm" variant="outline" onClick={() => { const chosen = items.filter((item) => selectedIds.includes(item.article.id)); const exportItems = chosen.length ? chosen : items; downloadMarkdown(exportMarkdown(exportItems.map((item) => ({ ...item.article, notes: item.notes, keyChange: item.keyChange }))), "signal-library.md"); }}>导出{items.some((item) => selectedIds.includes(item.article.id)) ? "所选" : "当前结果"}为 Markdown</Button></div>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {items === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History />}
          title={q || status !== "all" ? "没有匹配的收藏" : "知识库为空"}
          description={
            q || status !== "all"
              ? "调整搜索或状态筛选后再试。"
              : "在每日简报、探索或研究页面点击收藏，即可加入研究库。"
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <div key={item.article.id} className="space-y-1"><label className="inline-flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={selectedIds.includes(item.article.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.article.id] : current.filter((id) => id !== item.article.id))} />选择此条目</label><SavedItemCard item={item} collections={collections} onMutate={onMutate} /></div>
          ))}
        </div>
      )}
    </div>
  );
}
