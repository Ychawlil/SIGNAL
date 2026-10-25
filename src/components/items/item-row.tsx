"use client";

import type { IntelligenceItem } from "@/lib/types";
import { TimeAgo } from "@/components/live-time";
import { FavoriteButton } from "./favorite-button";
import { CategoryBadge, ImportanceMeter } from "./meta";
import { useLibrary } from "@/components/providers";
import { cn } from "@/lib/utils";

interface ItemRowProps {
  item: IntelligenceItem;
  onOpen: (item: IntelligenceItem) => void;
  showImportance?: boolean;
}

export function ItemRow({ item, onOpen, showImportance = true }: ItemRowProps) {
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
      className="editorial-row group cursor-pointer rounded-xl border border-border bg-panel px-5 py-4 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <CategoryBadge category={item.category} />
            <span className="text-muted-foreground">
              {item.sourceName} · <TimeAgo iso={item.publishedAt} />
            </span>
          </div>

          <h3
            className={cn(
              "mt-2 text-[15px] font-semibold leading-7 text-foreground",
              read && "text-muted-foreground",
            )}
          >
            {item.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {item.summary}
          </p>

          <div className="mt-2 flex items-center gap-4">
            {showImportance && <ImportanceMeter articleId={item.id} score={item.importanceScore} />}
          </div>
        </div>

        <FavoriteButton id={item.id} />
      </div>
    </article>
  );
}
