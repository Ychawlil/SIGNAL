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
        label="Briefing"
        title="Today's Briefing"
        description="按重要性排列的当日情报列表，由真实采集与分析结果生成。"
        aside={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {count} signals
          </span>
        }
      />
      {count === 0 ? (
        <p className="rounded-lg border border-border bg-panel p-5 text-sm text-muted-foreground">
          今天没有达到精选阈值的情报，简报不凑数。
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.key} className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-accent">
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
