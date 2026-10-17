"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { BriefingList, type BriefingSectionView } from "@/components/briefing/briefing-list";
import { SignalOfDay } from "@/components/briefing/signal-of-day";
import { TodayIntelligence } from "@/components/briefing/today-intelligence";
import { TopicDistribution } from "@/components/briefing/topic-distribution";
import { WeeklyDirection } from "@/components/briefing/weekly-direction";
import { WorthFollowing } from "@/components/briefing/worth-following";
import { ItemDetail } from "@/components/items/item-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { CATEGORIES } from "@/lib/constants";
import { toIntelligenceItem, type SignalRecord } from "@/lib/signals";
import { categoryToTopics } from "@/lib/topics";
import type {
  CategoryId,
  IntelligenceItem,
  WeeklyDirectionItem,
  WorthFollowingItem,
} from "@/lib/types";
import type { BriefingItem, DailyBriefing } from "@/lib/server/analysis/types";
import type { TrendsReport } from "@/lib/server/trends/types";
import type { SignalStats } from "@/lib/server/signals";
import { DateLabel } from "@/components/live-time";

function fromBriefingItem(item: BriefingItem): IntelligenceItem {
  return {
    id: String(item.articleId),
    title: item.title,
    summary: item.oneLineSummary || "—",
    category: item.category as CategoryId,
    sourceName: item.sourceName,
    sourceUrl: item.url,
    publishedAt: item.publishedAt,
    importanceScore: item.importanceScore,
    confidenceLevel: item.confidenceLevel,
    keyChange: item.keyChange || "—",
    whyItMatters: "—",
    limitations: "—",
    personalRelevance: "—",
    tags: [],
    topics: categoryToTopics(item.category as CategoryId),
    readingTimeMinutes: 1,
  };
}

function toWorthFollowing(trends: TrendsReport): WorthFollowingItem[] {
  const repos: WorthFollowingItem[] = trends.risingRepos.slice(0, 3).map((repo) => ({
    id: `repo:${repo.fullName}`,
    name: repo.fullName,
    kind: "repo",
    description: repo.description || "—",
    whyFollow: repo.compositeRationale || "复合评分靠前，值得持续跟踪。",
    referenceUrl: repo.url,
  }));
  const models: WorthFollowingItem[] = trends.releases.slice(0, 3).map((release) => ({
    id: `model:${release.id}`,
    name: release.title,
    kind: "model",
    description: release.evalNote || `来源：${release.sourceName}`,
    whyFollow: `声明来源：${release.claimOrigin}；基准 ${release.benchmarks.length} 项。`,
    referenceUrl: release.url,
  }));
  return [...repos, ...models].slice(0, 6);
}

function toWeeklyDirection(trends: TrendsReport): WeeklyDirectionItem[] {
  const fromEmerging = trends.emergingTopics.slice(0, 3).map((topic, i) => ({
    id: `dir-topic-${i}`,
    title: topic.topic,
    summary: `${topic.note}（窗口 ${topic.windowDays} 天）`,
    openQuestions: [
      "该趋势的可验证证据是否充分？",
      "是否存在独立复现或第三方评测？",
    ],
    relatedSignalIds: [],
  }));
  if (fromEmerging.length > 0) return fromEmerging;

  return trends.earlySignals.slice(0, 3).map((signal, i) => ({
    id: `dir-signal-${i}`,
    title: signal.title,
    summary: signal.reason,
    openQuestions: ["该信号是否已被独立验证？"],
    relatedSignalIds: [],
  }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} failed (${response.status})`);
  return response.json() as Promise<T>;
}

interface HomeData {
  briefing: DailyBriefing;
  signals: IntelligenceItem[];
  stats: SignalStats;
  trends: TrendsReport;
}

interface RefreshResponse {
  sync: {
    status: "running" | "success" | "error" | "skipped";
    totalNew: number;
    totalSkipped: number;
    error: string | null;
  };
  analyze: {
    status: "running" | "success" | "error" | "skipped";
    analyzed: number;
    error: string | null;
  };
  briefing: { date: string; generatedAt: string; count: number };
}

/** Never render the same story twice, even if the payload contains duplicates. */
function dedupeSections(sections: BriefingSectionView[]): BriefingSectionView[] {
  const seen = new Set<string>();
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const key =
          item.title.toLowerCase().replace(/\s+/g, " ").trim() || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

async function fetchHomeData(): Promise<HomeData> {
  const [briefing, signalsData, stats, trends] = await Promise.all([
    fetchJson<DailyBriefing>("/api/briefing"),
    fetchJson<{ items: SignalRecord[] }>("/api/signals?pageSize=100&sort=importance"),
    fetchJson<SignalStats>("/api/signals/stats"),
    fetchJson<TrendsReport>("/api/trends?range=7d"),
  ]);
  return {
    briefing,
    signals: signalsData.items.map(toIntelligenceItem),
    stats,
    trends,
  };
}

export default function Home() {
  const [selected, setSelected] = useState<IntelligenceItem | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [signals, setSignals] = useState<IntelligenceItem[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [trends, setTrends] = useState<TrendsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchHomeData()
      .then((data) => {
        if (!active) return;
        setBriefing(data.briefing);
        setSignals(data.signals);
        setStats(data.stats);
        setTrends(data.trends);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const retry = () => {
    setLoading(true);
    setError(null);
    fetchHomeData()
      .then((data) => {
        setBriefing(data.briefing);
        setSignals(data.signals);
        setStats(data.stats);
        setTrends(data.trends);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  };

  const manualUpdate = useCallback(async () => {
    setUpdating(true);
    setUpdateNotice(null);
    try {
      const response = await fetch("/api/briefing/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const summary = (await response.json().catch(() => ({}))) as Partial<RefreshResponse> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(summary.error ?? `更新失败 (${response.status})`);
      }

      const data = await fetchHomeData();
      setBriefing(data.briefing);
      setSignals(data.signals);
      setStats(data.stats);
      setTrends(data.trends);
      setError(null);

      const problems: string[] = [];
      if (summary.sync?.status === "error") {
        problems.push(`采集失败：${summary.sync.error ?? "未知错误"}`);
      } else if (summary.sync?.status === "skipped") {
        problems.push("另一个更新任务正在运行，本次未重新采集");
      }
      if (summary.analyze?.status === "error") {
        problems.push(`分析失败：${summary.analyze.error ?? "未知错误"}`);
      } else if (summary.analyze?.status === "skipped") {
        problems.push("另一个分析任务正在运行，本次未重新分析");
      }

      if (problems.length > 0) {
        setUpdateNotice({
          tone: "warning",
          message: `简报已刷新，但部分步骤未完成：${problems.join("；")}`,
        });
        return;
      }

      const parts = [`已刷新今日简报（${data.briefing.count} 条精选）`];
      parts.push(
        summary.sync && summary.sync.totalNew > 0
          ? `新增 ${summary.sync.totalNew} 条情报`
          : "没有新的情报",
      );
      if (summary.sync && summary.sync.totalSkipped > 0) {
        parts.push(`跳过 ${summary.sync.totalSkipped} 条重复内容`);
      }
      if (summary.analyze && summary.analyze.analyzed > 0) {
        parts.push(`新分析 ${summary.analyze.analyzed} 条`);
      }
      setUpdateNotice({ tone: "success", message: parts.join(" · ") });
    } catch (err) {
      setUpdateNotice({
        tone: "warning",
        message: `更新失败：${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setUpdating(false);
    }
  }, []);

  const signalById = new Map(signals.map((s) => [Number(s.id), s]));

  const sections: BriefingSectionView[] = dedupeSections(
    (briefing?.sections ?? []).map((section) => ({
      key: section.key,
      title: section.title,
      items: section.items.map((item) => signalById.get(item.articleId) ?? fromBriefingItem(item)),
    })),
  );

  const topSection = sections.find((s) => s.key === "top");
  const signalOfDay = topSection?.items[0] ?? null;

  const distribution = CATEGORIES.map((cat) => ({
    id: cat.id,
    count: stats?.categoryCounts[cat.id] ?? 0,
  }));

  const worthFollowing = trends ? toWorthFollowing(trends) : [];
  const weeklyDirection = trends ? toWeeklyDirection(trends) : [];

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
          <div className="flex flex-wrap items-center gap-2">
            {briefing && (
              <Badge variant="accent" className="gap-1.5 px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground/80" />
                {briefing.count} item{briefing.count === 1 ? "" : "s"}
              </Badge>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={manualUpdate}
              disabled={updating}
              aria-busy={updating}
              title="立即采集新情报，并刷新今日简报与 Today's Intelligence"
            >
              <RefreshCw className={updating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {updating ? "更新中…" : "手动更新"}
            </Button>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {briefing
            ? `基于真实采集情报生成：过去 24 小时 ${stats?.last24h ?? 0} 条新进展，累计 ${stats?.total ?? 0} 条已入库。`
            : "正在从真实数据源加载简报…"}
        </p>
      </header>

      {updateNotice && (
        <div
          className={
            updateNotice.tone === "success"
              ? "rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent"
              : "rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
          }
          role="status"
        >
          {updateNotice.message}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-sm text-danger">
            加载失败：{error}
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <>
          <TodayIntelligence
            digest={
              briefing?.digest ??
              "正在生成今日简报：导读、精选条数与重点主题会在真实数据加载完成后展示。"
            }
            intro={
              briefing?.intro ??
              "正在从真实数据源加载简报…"
            }
            selectedCount={briefing?.count ?? 0}
            freshCount={stats?.last24h ?? 0}
            windowCount={stats?.last7d ?? 0}
            totalCount={stats?.total ?? 0}
            themes={briefing?.keyThemes ?? []}
            evidence={briefing?.evidence ?? { high: 0, medium: 0, low: 0 }}
            reduced={briefing?.reduced ?? false}
          />
          <SignalOfDay item={signalOfDay} onOpen={setSelected} />
          <BriefingList sections={sections} onOpen={setSelected} />
          <TopicDistribution counts={distribution} total={stats?.total ?? 0} />
          <WorthFollowing items={worthFollowing} />
          <WeeklyDirection items={weeklyDirection} />
        </>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading briefing…
        </div>
      )}

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