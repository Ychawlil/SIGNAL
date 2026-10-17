import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

interface TodayIntelligenceProps {
  intro: string;
  todayCount: number;
  totalCount: number;
  selectedCount: number;
  themes: string[];
}

export function TodayIntelligence({
  intro,
  todayCount,
  totalCount,
  selectedCount,
  themes,
}: TodayIntelligenceProps) {
  return (
    <section>
      <SectionHeading
        index="A"
        label="Overview"
        title="Today's Intelligence"
      />
      <Card>
        <CardContent className="p-5">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            <p className="text-[15px] leading-7 text-foreground">{intro}</p>
            <div className="flex flex-col gap-2 sm:w-52">
              <div className="rounded-md border border-border bg-panel-secondary px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                  Signals last 24h
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {todayCount}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {totalCount}
                  </span>
                </p>
              </div>
              <div className="rounded-md border border-border bg-panel-secondary px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                  Selected for briefing
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-accent">
                  {selectedCount}
                </p>
              </div>
            </div>
          </div>
          {themes.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {themes.map((theme) => (
                <Badge key={theme} variant="accent">
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
