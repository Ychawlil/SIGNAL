"use client";

import { useState } from "react";
import { BriefingList } from "@/components/briefing/briefing-list";
import { SignalOfDay } from "@/components/briefing/signal-of-day";
import { TodayIntelligence } from "@/components/briefing/today-intelligence";
import { TopicDistribution } from "@/components/briefing/topic-distribution";
import { WeeklyDirection } from "@/components/briefing/weekly-direction";
import { WorthFollowing } from "@/components/briefing/worth-following";
import { ItemDetail } from "@/components/items/item-detail";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { DAILY_BRIEFING } from "@/lib/mock-data";
import type { IntelligenceItem } from "@/lib/types";
import { DateLabel } from "@/components/live-time";

export default function Home() {
  const [selected, setSelected] = useState<IntelligenceItem | null>(null);

  return (
    <div className="flex flex-col gap-12">
      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
              <DateLabel />
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
              Daily Briefing
            </h1>
          </div>
          <Badge variant="accent" className="gap-1.5 px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground/80" />
            Briefing generated
          </Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          当前为本地示例数据（{DAILY_BRIEFING.signalCount} 条示例情报），用于验证产品骨架与交互；尚未接入真实新闻与研究 API。
        </p>
      </header>

      <TodayIntelligence />
      <SignalOfDay onOpen={setSelected} />
      <BriefingList onOpen={setSelected} />
      <TopicDistribution />
      <WorthFollowing />
      <WeeklyDirection />

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Intelligence detail"
      >
        {selected && <ItemDetail item={selected} />}
      </Drawer>
    </div>
  );
}