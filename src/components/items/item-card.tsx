"use client";

import type { IntelligenceItem } from "@/lib/types";
import { TimeAgo } from "@/components/live-time";
import { FavoriteButton } from "./favorite-button";
import { CategoryBadge, ImportanceMeter } from "./meta";
import { useLibrary } from "@/components/providers";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: IntelligenceItem;
  onOpen: (item: IntelligenceItem) => void;
}

export function ItemCard({ item, onOpen }: ItemCardProps) {
  const { isRead } = useLibrary();
  const read = isRead(item.id);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="editorial-item-card group flex cursor-pointer flex-col rounded-2xl border border-border bg-panel p-5 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryBadge category={item.category} />
        </div>
        <FavoriteButton id={item.id} />
      </div>

      <h3
        className={cn(
          "text-[15px] font-semibold leading-7 text-foreground",
          read && "text-muted-foreground",
        )}
      >
        {item.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {item.summary}
      </p>

      <div className="mb-4 mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {item.sourceName} · <TimeAgo iso={item.publishedAt} />
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
        <ImportanceMeter articleId={item.id} score={item.importanceScore} />
      </div>
    </article>
  );
}
