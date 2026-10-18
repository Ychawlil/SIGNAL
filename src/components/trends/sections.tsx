"use client";

import { AlertTriangle, ExternalLink, FlaskConical, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  EarlySignal,
  EmergingTopic,
  ReleaseSignal,
  ResearcherSignal,
  TrendCoverage,
} from "@/lib/server/trends/types";

export function CoveragePanel({ coverage }: { coverage: TrendCoverage }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
        Data coverage
      </p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        指标采样时间：{new Date(coverage.sampledAt).toLocaleString()}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-5 text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">GitHub</span>：
          <Badge
            variant={coverage.github.collectionEnabled ? "accent" : "warning"}
            className="mx-1 font-mono uppercase tracking-wide"
          >
            {coverage.github.collectionEnabled ? "collecting" : "paused"}
          </Badge>
          跟踪 {coverage.github.reposTracked} 个仓库、{coverage.github.snapshots} 次快照
          {coverage.github.latestSnapshotAt
            ? `，最新采样 ${new Date(coverage.github.latestSnapshotAt).toLocaleString()}`
            : ""}
          {coverage.github.oldestSnapshotAt
            ? `（最早 ${new Date(coverage.github.oldestSnapshotAt).toLocaleString()}）`
            : ""}
          。{coverage.github.note}
        </li>
        <li>
          <span className="font-medium text-foreground">arXiv</span>：
          <Badge
            variant={coverage.arxiv.collectionEnabled ? "accent" : "warning"}
            className="mx-1 font-mono uppercase tracking-wide"
          >
            {coverage.arxiv.collectionEnabled ? "collecting" : "paused"}
          </Badge>
          {coverage.arxiv.articles} 篇已采集论文
          {coverage.arxiv.latestArticleAt
            ? `，最新发布时间 ${new Date(coverage.arxiv.latestArticleAt).toLocaleString()}`
            : ""}
          。
        </li>
      </ul>
    </div>
  );
}

export function ReleaseList({ releases }: { releases: ReleaseSignal[] }) {
  if (releases.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp />}
        title="No releases detected"
        description="模型/工具 Release 会随 GitHub 追踪与模型提取逐步出现。"
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {releases.map((release) => (
        <li key={release.id} className="rounded-md border border-border bg-panel p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono uppercase tracking-wide">
              {release.category}
            </Badge>
            <Badge
              variant={release.claimOrigin === "independent" ? "accent" : "warning"}
              className="font-mono uppercase tracking-wide"
            >
              {release.claimOrigin}
            </Badge>
            {release.license && <Badge variant="muted">{release.license}</Badge>}
            {release.openWeights !== null && (
              <Badge variant="muted">{release.openWeights ? "open weights" : "not open"}</Badge>
            )}
            <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
              relevance {release.relevance} · evidence {release.evidenceQuality}
            </span>
          </div>
          <a
            href={release.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 block text-sm font-semibold leading-6 text-foreground hover:text-accent"
          >
            {release.title}
          </a>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{release.evalNote}</p>
        </li>
      ))}
    </ul>
  );
}

export function ResearcherSignalList({ signals }: { signals: ResearcherSignal[] }) {
  return (
    <div className="flex flex-col gap-3">
      {signals.length === 0 ? (
        <EmptyState icon={<FlaskConical />} title="No researcher signals" />
      ) : (
        <ul className="flex flex-col gap-2">
          {signals.map((signal) => (
            <li key={signal.id} className="rounded-md border border-border bg-panel p-3">
              <a
                href={signal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold leading-6 text-foreground hover:text-accent"
              >
                {signal.title}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                {signal.authors.slice(0, 4).join(", ")}
                {signal.authors.length > 4 ? ` 等 ${signal.authors.length} 位作者` : ""}
                {" · "}
                {signal.publishedAt.slice(0, 10)}
              </p>
              <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {signal.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmergingTopicList({ topics }: { topics: EmergingTopic[] }) {
  if (topics.length === 0) {
    return <EmptyState icon={<TrendingUp />} title="No emerging topics yet" />;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <li key={topic.topic} className="rounded-md border border-border bg-panel p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">
              {topic.topic}
            </span>
            {topic.growth === null ? (
              <Badge variant="warning" className="font-mono">
                new
              </Badge>
            ) : (
              <Badge
                variant={topic.growth >= 0 ? "accent" : "muted"}
                className="font-mono tabular-nums"
              >
                {topic.growth >= 0 ? "+" : ""}
                {topic.growth}%
              </Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            {topic.count} 条 / {topic.windowDays}d
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{topic.note}</p>
        </li>
      ))}
    </ul>
  );
}

export function EarlySignalList({ signals }: { signals: EarlySignal[] }) {
  if (signals.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="暂无待验证的早期信号"
        description="当出现高热度但证据不足，或重要性高但证据仅来自厂商自述的条目时，会列在这里。"
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {signals.map((signal) => (
        <li key={`${signal.kind}-${signal.id}`} className="rounded-md border border-warning/40 bg-panel p-3">
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="font-mono uppercase tracking-wide">
              {signal.kind}
            </Badge>
            {signal.popularity !== null && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                stars {signal.popularity}
              </span>
            )}
          </div>
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 block text-sm font-medium leading-6 text-foreground hover:text-accent"
          >
            {signal.title}
          </a>
          <p className="mt-1 text-xs leading-5 text-warning">{signal.reason}</p>
        </li>
      ))}
    </ul>
  );
}
