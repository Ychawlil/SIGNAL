"use client";

import type { IntelligenceItem } from "@/lib/types";
import { TimeAgo } from "@/components/live-time";
import { FavoriteButton } from "./favorite-button";
import { CategoryBadge, ConfidenceBadge, ImportanceMeter, MockTag } from "./meta";
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
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="group cursor-pointer rounded-lg border border-border bg-panel px-4 py-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <CategoryBadge category={item.category} />
            {item.isMock && <MockTag />}
            <span className="text-muted-foreground">
              {item.sourceName} · <TimeAgo iso={item.publishedAt} />
            </span>
          </div>

          <h3
            className={cn(
              "mt-1.5 text-sm font-semibold leading-6 text-foreground",
              read && "text-muted-foreground",
            )}
          >
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-sm leading-6 text-muted-foreground">
            {item.summary}
          </p>

          <div className="mt-2 flex items-center gap-4">
            {showImportance && <ImportanceMeter score={item.importanceScore} />}
            <ConfidenceBadge level={item.confidenceLevel} />
          </div>
        </div>

        <FavoriteButton id={item.id} />
      </div>
    </article>
  );
}
