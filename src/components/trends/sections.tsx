"use client";
import { displayLabel } from "@/lib/display-label";

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
        数据覆盖
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
            {coverage.github.collectionEnabled ? "采集中" : "已暂停"}
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
            {coverage.arxiv.collectionEnabled ? "采集中" : "已暂停"}
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
        title="尚未发现发布动态"
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {releases.map((release) => (
        <li key={release.id} className="rounded-md border border-border bg-panel p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono uppercase tracking-wide">
              {displayLabel(release.category)}
            </Badge>
            <Badge
              variant={release.claimOrigin === "independent" ? "accent" : "warning"}
              className="font-mono uppercase tracking-wide"
            >
              {displayLabel(release.claimOrigin)}
            </Badge>
            {release.license && <Badge variant="muted">{release.license}</Badge>}
            {release.openWeights !== null && (
              <Badge variant="muted">{release.openWeights ? "开放权重" : "未开放权重"}</Badge>
            )}
            <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
              相关性 {release.relevance} · 证据质量 {release.evidenceQuality}
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
        <EmptyState icon={<FlaskConical />} title="暂无研究者动态" />
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
    return <EmptyState icon={<TrendingUp />} title="暂无新兴主题" />;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <li key={topic.label} className="rounded-md border border-border bg-panel p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">
              {topic.label}
            </span>
            {topic.growth === null ? (
              <Badge variant="warning" className="font-mono">
                新增
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
            {topic.count} 条 / {topic.windowDays} 天
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
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {signals.map((signal) => (
        <li key={`${displayLabel(signal.kind)}-${signal.id}`} className="rounded-md border border-warning/40 bg-panel p-3">
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="font-mono uppercase tracking-wide">
              {displayLabel(signal.kind)}
            </Badge>
            {signal.popularity !== null && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                星标数 {signal.popularity}
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
