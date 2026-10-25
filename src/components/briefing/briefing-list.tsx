"use client";

import type { IntelligenceItem } from "@/lib/types";
import { ItemRow } from "@/components/items/item-row";
import { SectionHeading } from "./section-heading";

export interface BriefingSectionView {
  key: string;
  title: string;
  items: IntelligenceItem[];
}

interface BriefingListProps {
  sections: BriefingSectionView[];
  onOpen: (item: IntelligenceItem) => void;
}

export function BriefingList({ sections, onOpen }: BriefingListProps) {
  const count = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <section>
      <SectionHeading
        index="C"
        label="简报"
        title="今日简报"
        aside={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {count} 条情报
          </span>
        }
      />
      {count === 0 ? (
        <p className="rounded-lg border border-border bg-panel p-5 text-sm text-muted-foreground">
          过去 24 小时内没有达到重要性阈值的情报，简报不凑数。
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.key} className="flex flex-col gap-2.5">
              <h3 className="mb-1 mt-2 border-l-2 border-accent/40 pl-3 text-xs font-medium tracking-wide text-muted-accent">
                {section.title}
              </h3>
              {section.items.map((item) => (
                <ItemRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
