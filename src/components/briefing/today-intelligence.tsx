import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

export interface KeyThemeChip {
  label: string;
  topic: string | null;
  category: string | null;
  count: number;
}

interface TodayIntelligenceProps {
  /** Short editorial digest generated from the selected items. */
  digest: string;
  /** Items selected for today's briefing. */
  selectedCount: number;
  /** Items published in the last 24h. */
  freshCount: number;
  /** Same 24h window, as seen by the analyzed pool. */
  windowCount: number;
  /** Total articles stored. */
  totalCount: number;
  themes: KeyThemeChip[];
  sourceMix: { sourceName: string; count: number }[];
  reduced: boolean;
}

function Stat({
  label,
  value,
  suffix,
  accent = false,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-panel-secondary px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

export function TodayIntelligence({
  digest,
  selectedCount,
  freshCount,
  windowCount,
  totalCount,
  themes,
  sourceMix,
  reduced,
}: TodayIntelligenceProps) {
  return (
    <section>
      <SectionHeading index="A" label="Overview" title="Today's Intelligence" />
      <Card>
        <CardContent className="p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
              Digest
            </p>
            <p className="mt-1.5 text-[15px] leading-7 text-foreground">{digest}</p>
            {reduced && (
              <p className="mt-2 text-xs leading-5 text-warning">
                高质量情报不足，已按实际数量减少精选。
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="精选条数" value={selectedCount} suffix="signals" accent />
            <Stat label="24h 新增" value={freshCount} suffix="signals" />
            <Stat label="24h 窗口" value={windowCount} suffix="stored" />
            <Stat label="库内总量" value={totalCount} suffix="stored" />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                Key themes
              </p>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {sourceMix.length === 0
                  ? "—"
                  : sourceMix
                      .map((entry) => `${entry.sourceName} ${entry.count}`)
                      .join(" · ")}
              </span>
            </div>
            {themes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="mt-2 flex flex-wrap items-center gap-1.5">
                {themes.map((theme) => {
                  const href = theme.topic
                    ? `/explore?topic=${theme.topic}`
                    : theme.category
                      ? `/explore?category=${theme.category}`
                      : "/explore";
                  return (
                    <li key={`${theme.topic ?? theme.category ?? theme.label}`}>
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:border-accent"
                      >
                        {theme.label}
                        <span className="font-mono text-[10px] tabular-nums opacity-80">
                          {theme.count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
