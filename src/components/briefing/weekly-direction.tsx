import type { WeeklyDirectionItem } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

export function WeeklyDirection({ items }: { items: WeeklyDirectionItem[] }) {
  return (
    <section>
      <SectionHeading index="F" label="Direction" title="Weekly Direction" />
      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-panel p-5 text-sm text-muted-foreground">
          —
        </p>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-3">
          {items.map((item, i) => (
            <Card key={item.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
                  Trend {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-sm font-semibold leading-6 text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {item.summary}
                </p>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                    Open questions
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {item.openQuestions.map((q) => (
                      <li
                        key={q}
                        className="flex gap-2 text-xs leading-5 text-muted-foreground"
                      >
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warning" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
