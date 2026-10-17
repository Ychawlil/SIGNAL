"use client";

import { ArrowUpRight } from "lucide-react";
import { DAILY_BRIEFING, INTELLIGENCE_ITEMS } from "@/lib/mock-data";
import type { IntelligenceItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceBadge, ImportanceMeter } from "@/components/items/meta";
import { SectionHeading } from "./section-heading";

interface SignalOfDayProps {
  onOpen: (item: IntelligenceItem) => void;
}

export function SignalOfDay({ onOpen }: SignalOfDayProps) {
  const item = INTELLIGENCE_ITEMS.find(
    (i) => i.id === DAILY_BRIEFING.signalOfTheDayId,
  );

  if (!item) return null;

  return (
    <section>
      <SectionHeading
        index="B"
        label="Highlight"
        title="Signal of the Day"
        description="今日最值得深入理解的一项技术进展。"
      />
      <Card className="border-border-strong">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="accent" className="font-mono uppercase tracking-wide">
              Signal of the Day
            </Badge>
            <ConfidenceBadge level={item.confidenceLevel} withLabel />
          </div>

          <h3 className="mt-3 text-xl font-semibold leading-8 text-foreground">
            {item.title}
          </h3>
          <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
            {item.summary}
          </p>

          <dl className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            <div className="bg-panel p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                Core change
              </dt>
              <dd className="mt-1.5 text-sm leading-6 text-foreground">
                {item.keyChange}
              </dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                Why it matters
              </dt>
              <dd className="mt-1.5 text-sm leading-6 text-foreground">
                {item.whyItMatters}
              </dd>
            </div>
            <div className="bg-panel p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                Evidence status
              </dt>
              <dd className="mt-1.5 text-sm leading-6 text-foreground">
                {item.confidenceLevel === "high"
                  ? "多来源交叉验证，证据充分。"
                  : item.confidenceLevel === "medium"
                    ? "单一可靠来源，部分验证。"
                    : "早期信号，待验证。"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <ImportanceMeter score={item.importanceScore} />
              <span className="text-xs text-muted-foreground">
                {item.sourceName}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
              Read the briefing
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
