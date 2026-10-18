"use client";

import { ArrowUpRight } from "lucide-react";
import type { IntelligenceItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImportanceMeter } from "@/components/items/meta";
import { SectionHeading } from "./section-heading";

interface SignalOfDayProps {
  item: IntelligenceItem | null;
  onOpen: (item: IntelligenceItem) => void;
}

export function SignalOfDay({ item, onOpen }: SignalOfDayProps) {
  if (!item) {
    return (
      <section>
        <SectionHeading index="B" label="Highlight" title="Signal of the Day" />
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            —
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading index="B" label="Highlight" title="Signal of the Day" />
      <Card className="border-border-strong">
        <CardContent className="p-5 sm:p-6">
          <h3 className="text-xl font-semibold leading-8 text-foreground">
            {item.title}
          </h3>
          <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
            {item.summary}
          </p>

          <dl className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
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
