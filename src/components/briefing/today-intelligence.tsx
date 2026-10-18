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
  /** Secondary line describing the selection window. */
  intro: string;
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
  hint,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div
      className="rounded-md border border-border bg-panel-secondary px-4 py-3"
      title={hint}
    >
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
      {hint && (
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function TodayIntelligence({
  digest,
  intro,
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
      <SectionHeading
        index="A"
        label="Overview"
        title="Today's Intelligence"
        description="当日情报总览：精选条数、重点主题与简短导读。"
      />
      <Card>
        <CardContent className="p-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* 简短导读 */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                导读 · Digest
              </p>
              <p className="mt-1.5 text-[15px] leading-7 text-foreground">
                {digest}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {intro}
              </p>
              {reduced && (
                <p className="mt-2 text-xs leading-5 text-warning">
                  今日高质量情报不足，已按实际数量减少精选，不凑数。
                </p>
              )}
            </div>

            {/* 精选条数 */}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Stat
                label="精选条数"
                value={selectedCount}
                suffix="signals"
                accent
                hint="今日简报实际入选的情报条数"
              />
              <Stat
                label="24h 新增"
                value={freshCount}
                suffix="signals"
                hint="最近 24 小时内发布、已入库的情报"
              />
              <Stat
                label="24h 窗口"
                value={windowCount}
                suffix="stored"
                hint="过去 24 小时内发布、已入库的情报（简报选取范围）"
              />
              <Stat
                label="库内总量"
                value={totalCount}
                suffix="stored"
                hint="本地 SQLite 中已采集的情报总数"
              />
            </div>
          </div>

          {/* 重点主题 */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                重点主题 · Key themes
              </p>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                来源 ·{" "}
                {sourceMix.length === 0
                  ? "—"
                  : sourceMix
                      .map((entry) => `${entry.sourceName} ${entry.count}`)
                      .join(" · ")}
              </span>
            </div>
            {themes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                今日没有入选题材，因此没有主题统计。
              </p>
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
                        title={`在 Explore 中查看该主题的 ${theme.count} 条入选情报`}
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
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              主题按入选情报的实际分布排序，点击可在 Explore 中查看对应条目。一条情报可归入多个主题，因此主题计数之和可能大于精选条数。
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
