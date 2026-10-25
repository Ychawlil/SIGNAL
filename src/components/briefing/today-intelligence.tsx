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
  /** Items selected for today's briefing; "—" until the first response lands. */
  selectedCount: number | string;
  /** Items published in the last 24h. */
  freshCount: number | string;
  /** Same 24h window, as seen by the analyzed pool. */
  windowCount: number | string;
  /** Total articles stored. */
  totalCount: number | string;
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
    <div className="editorial-stat px-4 py-4 sm:px-5">
      <p className="text-xs font-medium tracking-wide text-muted-accent">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${
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
      <SectionHeading index="A" label="概览" title="今日情报" />
      <Card>
        <CardContent className="p-5 sm:p-7">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-accent">
              今日重点
            </p>
            <ul className="mt-2 space-y-2 text-[15px] leading-7 text-foreground">
              {digest.split(/(?:\n+|；)/).map((line) => line.trim()).filter(Boolean).map((line, index) => <li key={index} className="flex gap-3"><span aria-hidden className="text-accent">•</span><span>{line}</span></li>)}
            </ul>
            {reduced && (
              <p className="mt-2 text-xs leading-5 text-warning">
                高质量情报不足，已按实际数量减少精选。
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-panel-secondary/40 sm:grid-cols-4">
            <Stat label="精选条数" value={selectedCount} suffix="条" accent />
            <Stat label="24h 采集入库" value={freshCount} suffix="条" />
            <Stat label="24h 内发布" value={windowCount} suffix="条" />
            <Stat label="库内总量" value={totalCount} suffix="条" />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-accent">
                重点主题
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
