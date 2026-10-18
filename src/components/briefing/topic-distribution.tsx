import { CATEGORY_MAP } from "@/lib/constants";
import type { CategoryId } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

interface TopicDistributionProps {
  counts: { id: CategoryId; count: number }[];
  total: number;
}

export function TopicDistribution({ counts, total }: TopicDistributionProps) {
  const visible = counts.filter((c) => c.count > 0);
  const max = Math.max(...visible.map((c) => c.count), 1);

  return (
    <section>
      <SectionHeading index="D" label="Distribution" title="Topic Distribution" />
      <Card>
        <CardContent className="p-5">
          <ul className="flex flex-col gap-3">
            {visible.map((cat) => (
              <li
                key={cat.id}
                className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[180px_1fr_auto] sm:items-center sm:gap-x-4"
              >
                <div className="flex items-center justify-between gap-3 sm:block">
                  <span className="truncate text-xs font-medium text-foreground">
                    {CATEGORY_MAP[cat.id].label}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground sm:hidden">
                    {cat.count}
                    <span className="text-muted-accent"> / {total}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-panel-secondary">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(cat.count / max) * 100}%` }}
                  />
                </div>
                <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                  {cat.count}
                  <span className="text-muted-accent"> / {total}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
