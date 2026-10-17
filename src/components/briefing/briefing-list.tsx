"use client";

import { INTELLIGENCE_ITEMS } from "@/lib/mock-data";
import type { IntelligenceItem } from "@/lib/types";
import { ItemRow } from "@/components/items/item-row";
import { SectionHeading } from "./section-heading";

interface BriefingListProps {
  onOpen: (item: IntelligenceItem) => void;
}

export function BriefingList({ onOpen }: BriefingListProps) {
  const ranked = [...INTELLIGENCE_ITEMS]
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 8);

  return (
    <section>
      <SectionHeading
        index="C"
        label="Briefing"
        title="Today's Briefing"
        description="按重要性排列的当日情报列表，共 8 条精选。"
        aside={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {ranked.length} signals
          </span>
        }
      />
      <div className="flex flex-col gap-2.5">
        {ranked.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3">
            <span className="mt-4 w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <ItemRow item={item} onOpen={onOpen} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
