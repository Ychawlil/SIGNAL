"use client";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ScoreExplanation } from "./score-explanation";
import { CATEGORY_MAP } from "@/lib/constants";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function CategoryBadge({ category }: { category: CategoryId }) {
  const meta = CATEGORY_MAP[category];
  return (
    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
      {meta?.shortLabel ?? category}
    </Badge>
  );
}

export function ImportanceMeter({
  score,
  className,
  articleId,
}: {
  score: number;
  articleId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span onClick={(event) => event.stopPropagation()}>
    <button type="button" onClick={() => setOpen(true)} disabled={!articleId} aria-label={`查看重要性 ${score} 分的评分依据`}
      className={cn("inline-flex items-center gap-2 rounded px-1 py-1 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", className)}
      title={`重要性 ${score}/100`}
    >
      <span className="h-1 w-14 overflow-hidden rounded-full bg-panel-secondary">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {score}
      </span>
    </button>
    {articleId && <Drawer open={open} onClose={() => setOpen(false)} title="重要性评分依据"><ScoreExplanation key={articleId} id={articleId} /></Drawer>}
    </span>
  );
}
