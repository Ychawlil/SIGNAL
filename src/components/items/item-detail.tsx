"use client";

import type { ReactNode } from "react";
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
  ConfidenceBadge,
  ImportanceMeter,
  MockTag,
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
  const { isFavorite, toggleFavorite, isRead, toggleRead, getNote, setNote } =
    useLibrary();

  const favorite = isFavorite(item.id);
  const read = isRead(item.id);
  const note = getNote(item.id);

  return (
    <div>
      <div className="px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={item.category} />
          {item.isMock && <MockTag />}
        </div>
        <h2 className="mt-3 text-lg font-semibold leading-7 text-foreground">
          {item.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {item.sourceName} · {formatDateTime(item.publishedAt)}（
          <TimeAgo iso={item.publishedAt} />）· {item.readingTimeMinutes} min read
        </p>

        <div className="mt-4 flex items-center gap-4">
          <ImportanceMeter score={item.importanceScore} />
          <ConfidenceBadge level={item.confidenceLevel} withLabel />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={favorite ? "primary" : "secondary"}
            onClick={() => toggleFavorite(item.id)}
          >
            <Bookmark className={favorite ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
            {favorite ? "Favorited" : "Favorite"}
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
            {read ? "Marked read" : "Mark as read"}
          </Button>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Source (sample)
          </a>
        </div>
      </div>

      <Section label="Summary">{item.summary}</Section>
      <Section label="Key change">{item.keyChange}</Section>
      <Section label="Why it matters">{item.whyItMatters}</Section>
      <Section label="Limitations">{item.limitations}</Section>
      <Section label="Personal relevance">{item.personalRelevance}</Section>

      <div className="border-t border-border px-5 py-4">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
          Topics
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

      <div className="border-t border-border px-5 py-4">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
          Personal note
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
