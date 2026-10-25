"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { RepoCard } from "@/components/trends/repo-card";
import {
  CoveragePanel,
  EarlySignalList,
  EmergingTopicList,
  ReleaseList,
  ResearcherSignalList,
} from "@/components/trends/sections";
import type {
  TrendRange,
  TrendSource,
  TrendTopic,
  TrendsReport,
} from "@/lib/server/trends/types";

interface CollectSummary {
  searched: number;
  reposDiscovered: number;
  snapshotsTaken: number;
  detailedRepos: number;
  note: string;
}

function fetchTrends(params: {
  range: TrendRange;
  topic: TrendTopic;
  source: TrendSource;
}): Promise<TrendsReport> {
  const q = new URLSearchParams({
    range: params.range,
    topic: params.topic,
    source: params.source,
  });
  return fetch(`/api/trends?${q.toString()}`, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`Trends request failed (${r.status})`);
    return r.json();
  });
}

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
        <span className="text-accent">{index}</span>
        {title}
      </p>
    </div>
  );
}

export default function TrendsPage() {
  const [range, setRange] = useState<TrendRange>("7d");
  const [topic, setTopic] = useState<TrendTopic>("all");
  const [source, setSource] = useState<TrendSource>("all");
  const [report, setReport] = useState<TrendsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collectSummary, setCollectSummary] = useState<CollectSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetchTrends({ range, topic, source })
      .then((data) => {
        if (active) {
          setReport(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [range, topic, source]);

  const onCollect = useCallback(async () => {
    setCollecting(true);
    setError(null);
    try {
      const response = await fetch("/api/trends/collect", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Collect failed (${response.status})`);
      }
      const summary = (await response.json()) as CollectSummary;
      setCollectSummary(summary);
      const data = await fetchTrends({ range, topic, source });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCollecting(false);
    }
  }, [range, topic, source]);

  const githubPaused = report ? !report.coverage.github.collectionEnabled : false;

  return (
    <div className="flex flex-col gap-6">
      <header className="page-header flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            技术动态
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            趋势
          </h1>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onCollect}
          disabled={collecting || githubPaused}
          title={
            githubPaused
              ? "GitHub 采集已暂停（SIGNAL_DISABLED_PROVIDERS）"
              : "采集 GitHub 快照"
          }
        >
          {collecting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          {githubPaused ? "采集已暂停" : collecting ? "正在采集…" : "采集数据"}
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<TrendRange>
          value={range}
          onChange={setRange}
          options={[
            { value: "7d", label: "最近 7 天" },
            { value: "30d", label: "最近 30 天" },
          ]}
        />
        <Select
          value={topic}
          onChange={(e) => setTopic(e.target.value as TrendTopic)}
          aria-label="按主题筛选"
          className="w-full sm:w-52"
        >
          <option value="all">全部主题</option>
          <option value="vla">VLA</option>
          <option value="robot-learning">机器人学习</option>
          <option value="world-model">世界模型</option>
          <option value="llm">LLM</option>
          <option value="ai-agents">AI 智能体</option>
          <option value="ai-coding">AI 编程</option>
          <option value="theorem-proving">定理证明</option>
          <option value="llm-inference">大模型推理服务</option>
        </Select>
        <Segmented<TrendSource>
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "全部来源" },
            { value: "github", label: "GitHub" },
            { value: "arxiv", label: "arXiv" },
          ]}
        />
      </div>

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {collectSummary && (
        <div className="rounded-md border border-border bg-panel-secondary px-4 py-3 font-mono text-xs text-muted-foreground">
          collect: {collectSummary.searched} searches · {collectSummary.reposDiscovered} repos ·
          {collectSummary.snapshotsTaken} snapshots · {collectSummary.detailedRepos} detailed ·{" "}
          {collectSummary.note}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          正在加载趋势…
        </div>
      ) : report ? (
        <>
          <CoveragePanel coverage={report.coverage} />

          <section>
            <SectionHeader index="A" title="上升中的项目" />
            {githubPaused && report.risingRepos.length > 0 && (
              <p className="mb-2.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs leading-5 text-warning">
                GitHub 自动采集已暂停，以下指标来自历史快照
                {report.coverage.github.latestSnapshotAt
                  ? `（最新采样：${new Date(report.coverage.github.latestSnapshotAt).toLocaleString()}）`
                  : ""}
                ，不代表当前状态。
              </p>
            )}
            {report.risingRepos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong bg-panel px-6 py-10 text-center text-sm text-muted-foreground">
                {githubPaused
                  ? "GitHub 采集已暂停，且没有历史仓库快照可展示。"
                  : "暂无仓库数据。点击「Collect data」采集 GitHub 快照。"}
              </p>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {report.risingRepos.map((repo) => (
                  <RepoCard key={repo.fullName} repo={repo} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader index="B" title="模型与工具发布" />
            <ReleaseList releases={report.releases} />
          </section>

          <section>
            <SectionHeader index="C" title="研究者动态" />
            <ResearcherSignalList signals={report.researcherSignals} />
          </section>

          <section>
            <SectionHeader index="D" title="新兴主题" />
            <EmergingTopicList topics={report.emergingTopics} />
          </section>

          <section>
            <SectionHeader index="E" title="早期信号 · 待验证" />
            <EarlySignalList signals={report.earlySignals} />
          </section>
        </>
      ) : null}
    </div>
  );
}
