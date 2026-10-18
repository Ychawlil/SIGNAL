"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalyzedArticleRow } from "@/lib/server/analysis/store";
import { cn } from "@/lib/utils";

function FactorBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-secondary">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
      <span className="w-6 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function AnalyzedRow({ item }: { item: AnalyzedArticleRow }) {
  const [open, setOpen] = useState(false);
  const a = item.analysis;

  return (
    <article className="rounded-lg border border-border bg-panel">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="font-mono uppercase tracking-wide">
              {item.category}
            </Badge>
            <span className="text-muted-foreground">
              {item.sourceName} · {item.publishedAt.slice(0, 10)}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-6 text-foreground">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {a.oneLineSummary}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5 text-muted-accent" />
              importance
              <span className="font-mono text-sm tabular-nums text-foreground">
                {a.importanceScore}
              </span>
            </span>
            <Badge variant="muted" className="font-mono uppercase tracking-wide">
              {a.evidenceBasis}
            </Badge>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="fade-in border-t border-border px-4 pb-4 pt-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
              Importance factors
            </p>
            <div className="mt-2 flex max-w-md flex-col gap-2">
              <FactorBar label="Relevance" value={a.importanceFactors.relevance} max={30} />
              <FactorBar label="Novelty" value={a.importanceFactors.novelty} max={20} />
              <FactorBar label="Impact" value={a.importanceFactors.impact} max={20} />
              <FactorBar label="Verifiability" value={a.importanceFactors.verifiability} max={15} />
              <FactorBar label="Learning value" value={a.importanceFactors.learning} max={15} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm leading-6">
            <p className="text-foreground">
              <span className="text-muted-accent">Key change · </span>
              {a.keyChange || "—"}
            </p>
            <p className="text-foreground">
              <span className="text-muted-accent">Differences · </span>
              {a.differences}
            </p>
            <p className="text-foreground">
              <span className="text-muted-accent">Evidence · </span>
              {a.evidence}
            </p>
            <p className="text-foreground">
              <span className="text-muted-accent">Limitations · </span>
              {a.limitations}
            </p>
            <p className="text-foreground">
              <span className="text-muted-accent">Impact · </span>
              {a.impact}
            </p>
            <p className="text-foreground">
              <span className="text-muted-accent">For you · </span>
              {a.personalRelevance}
            </p>
          </div>

          {a.furtherReading.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                Further reading
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.furtherReading.map((ref) => (
                  <a
                    key={ref.url}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    {ref.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function ImportanceView({ items }: { items: AnalyzedArticleRow[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm leading-6 text-muted-foreground">
        按重要性排序，展开可看到五项重要性因子。来源自述（vendor）与独立验证（independent）分开标记，作为阅读时的参考，而不是评分。
      </p>
      {items.map((item) => (
        <AnalyzedRow key={item.id} item={item} />
      ))}
    </div>
  );
}
