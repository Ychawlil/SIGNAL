"use client";

import { useState, type ReactNode } from "react";
import { ArticleContext } from "./article-context";
import { downloadMarkdown, exportMarkdown } from "@/lib/markdown-export";
import { Bookmark, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { useLibrary } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TOPIC_NAMES } from "@/lib/constants";
import type { IntelligenceItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { TimeAgo } from "@/components/live-time";
import {
  CategoryBadge,
  ImportanceMeter,
} from "./meta";

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-border px-5 py-4 first:border-t-0">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
        {label}
      </p>
      <div className="text-sm leading-6 text-foreground">{children}</div>
    </div>
  );
}

interface ItemDetailProps {
  item: IntelligenceItem;
}

export function ItemDetail({ item }: ItemDetailProps) {
  const { isFavorite, toggleFavorite, isRead, toggleRead, getNote, setNote, addToQueue } =
    useLibrary();

  const [notice, setNotice] = useState("");
  const favorite = isFavorite(item.id);
  const read = isRead(item.id);
  const note = getNote(item.id);

  return (
    <div>
      <div className="px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={item.category} />
        </div>
        <h2 className="mt-3 text-lg font-semibold leading-7 text-foreground">
          {item.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {item.sourceName} · {formatDateTime(item.publishedAt)}（
          <TimeAgo iso={item.publishedAt} />）· {item.readingTimeMinutes} 分钟阅读
        </p>

        <div className="mt-4 flex items-center gap-4">
          <ImportanceMeter articleId={item.id} score={item.importanceScore} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={favorite ? "primary" : "secondary"}
            onClick={() => toggleFavorite(item.id)}
          >
            <Bookmark className={favorite ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
            {favorite ? "已收藏" : "收藏"}
          </Button>
          <Button
            size="sm"
            variant={read ? "primary" : "secondary"}
            onClick={() => toggleRead(item.id)}
          >
            {read ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            {read ? "已读" : "标记已读"}
          </Button>
          <Button size="sm" onClick={() => { void addToQueue(item.id).then(() => setNotice("已加入稍后阅读")).catch(() => setNotice("加入失败，请重试")); }}>稍后阅读</Button>
          <Button size="sm" variant="outline" onClick={() => downloadMarkdown(exportMarkdown([{ title: item.title, url: item.sourceUrl, summary: item.summary, keyChange: item.keyChange, sourceName: item.sourceName, publishedAt: item.publishedAt, notes: note }]), `signal-${item.id}.md`)}>导出 Markdown</Button>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            查看原文
          </a>
        </div>
      </div>

      {notice && <p role="status" className="px-5 pb-3 text-xs text-accent">{notice}</p>}
      <Section label="摘要">{item.summary}</Section>
      <Section label="关键变化">{item.keyChange}</Section>
      <Section label="为何重要">{item.whyItMatters}</Section>
      <Section label="局限性">{item.limitations}</Section>
      <Section label="与我的关联">{item.personalRelevance}</Section>

      <div className="border-t border-border px-5 py-4">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
          主题
        </p>
        <div className="flex flex-wrap gap-1.5">
          {item.topics.map((t) => (
            <Badge key={t} variant="accent">
              {TOPIC_NAMES[t]}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <Badge key={tag} variant="muted">
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      <ArticleContext key={item.id} id={item.id} />
      <div className="border-t border-border px-5 py-4">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
          个人笔记
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(item.id, e.target.value)}
          placeholder="记录你的想法、复现计划或待验证的问题…"
          className="min-h-[92px] w-full resize-y rounded-md border border-border bg-panel-secondary px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>
    </div>
  );
}
