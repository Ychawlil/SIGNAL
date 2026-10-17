"use client";

import { ExternalLink, GitBranch, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RisingRepo } from "@/lib/server/trends/types";

function MetricBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] text-muted-foreground" title={hint}>
        {label}
      </span>
      {value === null ? (
        <span className="flex-1 text-[11px] italic text-muted-foreground">unknown</span>
      ) : (
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-secondary">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
      <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {value === null ? "—" : value}
      </span>
    </div>
  );
}

export function RepoCard({ repo }: { repo: RisingRepo }) {
  return (
    <article className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground hover:text-accent"
          >
            {repo.fullName}
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {repo.description || "（无描述）"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-warning" />
            {repo.stars}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5 text-muted-accent" />
            {repo.forks}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {repo.topics.slice(0, 5).map((t) => (
          <Badge key={t} variant="muted" className="font-mono text-[10px]">
            {t}
          </Badge>
        ))}
        {repo.language && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {repo.language}
          </Badge>
        )}
        {repo.license && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {repo.license}
          </Badge>
        )}
        {repo.hasReadme === false && <Badge variant="warning">no README</Badge>}
      </div>

      <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
        <MetricBar label="Popularity" value={repo.metrics.popularity} />
        <MetricBar
          label="Momentum"
          value={repo.metrics.momentum}
          hint={repo.momentumDetail.note}
        />
        <MetricBar label="Tech merit" value={repo.metrics.technicalMerit} />
        <MetricBar label="Evidence" value={repo.metrics.evidenceQuality} />
        <MetricBar label="Relevance" value={repo.metrics.relevance} />
      </div>

      <div className="mt-3 rounded-md border border-border bg-panel-secondary px-3 py-2 text-xs leading-5 text-muted-foreground">
        <span className="text-muted-accent">momentum · </span>
        {repo.momentumDetail.note}
        {repo.momentumDetail.growthStars !== null && (
          <span className="font-mono tabular-nums">
            {" "}
            (+{repo.momentumDetail.growthStars} stars)
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        <span className="text-muted-accent">composite {repo.compositeScore ?? "—"} · </span>
        {repo.compositeRationale}
      </p>
    </article>
  );
}
