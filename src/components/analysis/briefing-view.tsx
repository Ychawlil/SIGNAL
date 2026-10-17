"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DailyBriefing } from "@/lib/server/analysis/types";
import { cn } from "@/lib/utils";

function confidenceClass(level: "high" | "medium" | "low"): string {
  if (level === "high") return "bg-accent-soft text-accent";
  if (level === "medium") return "bg-warning-soft text-warning";
  return "bg-panel-secondary text-muted-foreground";
}

export function BriefingView({ briefing }: { briefing: DailyBriefing }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel-secondary px-4 py-3">
        <p className="text-sm leading-6 text-foreground">{briefing.intro}</p>
        {briefing.reduced && (
          <Badge variant="warning" className="font-mono uppercase">
            Reduced — low-quality content
          </Badge>
        )}
      </div>

      {briefing.sections.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            没有达到质量阈值的精选内容，今日简报不凑数。
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {briefing.sections.map((section) => (
            <section key={section.key} className="rounded-lg border border-border bg-panel p-4">
              <div className="flex items-center gap-2">
                {section.key === "top" && <Sparkles className="h-4 w-4 text-accent" />}
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              </div>
              {section.items.map((item) => (
                <div key={item.articleId} className="mt-3 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono uppercase tracking-wide">
                      {item.category}
                    </Badge>
                    <Badge className={cn("font-mono uppercase tracking-wide", confidenceClass(item.confidenceLevel))}>
                      confidence {item.confidenceLevel}
                    </Badge>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      importance {item.importanceScore} / confidence {item.confidenceScore}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-sm font-semibold leading-6 text-foreground hover:text-accent"
                  >
                    {item.title}
                  </a>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.oneLineSummary}
                  </p>
                  {item.keyChange && (
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      <span className="text-muted-accent">Key change · </span>
                      {item.keyChange}
                    </p>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
