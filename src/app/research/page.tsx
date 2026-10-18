"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileText,
  FlaskConical,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { CATEGORIES, TOPIC_NAMES } from "@/lib/constants";
import { categoryToTopics } from "@/lib/topics";
import type { CategoryId, TopicId } from "@/lib/types";
import type { AnalyzedArticleRow } from "@/lib/server/analysis/store";
import { cn } from "@/lib/utils";

type KindFilter = "paper" | "report" | "open-source" | "all";

const KIND_META: Record<Exclude<KindFilter, "all">, { label: string; icon: ReactNode }> = {
  paper: { label: "Paper", icon: <FileText className="h-3.5 w-3.5" /> },
  report: { label: "Report", icon: <BookOpen className="h-3.5 w-3.5" /> },
  "open-source": { label: "Open Source", icon: <GitBranch className="h-3.5 w-3.5" /> },
};

function kindOf(item: AnalyzedArticleRow): Exclude<KindFilter, "all"> {
  if (item.provider === "arxiv" || item.provider === "arxiv-rss") return "paper";
  if (item.provider === "github") return "open-source";
  return "report";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
        {label}
      </p>
      <div className="mt-1 text-sm leading-6 text-foreground">{children}</div>
    </div>
  );
}

function ResearchCard({ item }: { item: AnalyzedArticleRow }) {
  const [open, setOpen] = useState(false);
  const kind = kindOf(item);
  const meta = KIND_META[kind];
  const { analysis } = item;

  return (
    <article className="rounded-lg border border-border bg-panel">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1">
              {meta.icon}
              {meta.label}
            </Badge>
            <Badge variant="muted">
              {CATEGORIES.find((c) => c.id === item.category)?.label}
            </Badge>
          </div>
          <h2 className="mt-2 text-sm font-semibold leading-6 text-foreground">
            {item.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.sourceName} · 重要性 {analysis.importanceScore}/100
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="fade-in border-t border-border px-4 pb-5 pt-4">
          <div className="grid gap-4">
            <Field label="One-line summary">{analysis.oneLineSummary || item.summary || "—"}</Field>
            <Field label="Key change">{analysis.keyChange || "—"}</Field>
            <Field label="Differences vs prior work">{analysis.differences || "—"}</Field>
            <Field label="Experiments & evidence">{analysis.evidence || "—"}</Field>
            <Field label="Limitations & open problems">{analysis.limitations || "—"}</Field>
            <Field label="Potential impact">{analysis.impact || "—"}</Field>
            <Field label="Personal relevance">{analysis.personalRelevance || "—"}</Field>

            {analysis.furtherReading.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                  Recommended reading
                </p>
                <ol className="mt-1.5 flex flex-col gap-1">
                  {analysis.furtherReading.map((ref, i) => (
                    <li key={ref.url} className="flex gap-2 text-sm leading-6">
                      <span className="font-mono text-xs tabular-nums text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-accent"
                      >
                        {ref.label || ref.url}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
              {categoryToTopics(item.category).map((t: TopicId) => (
                <Badge key={t} variant="accent">
                  {TOPIC_NAMES[t]}
                </Badge>
              ))}
              {item.tags.map((tag) => (
                <Badge key={tag} variant="muted">
                  #{tag}
                </Badge>
              ))}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ResearchPage() {
  const [kind, setKind] = useState<KindFilter>("all");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [items, setItems] = useState<AnalyzedArticleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/analysis?pageSize=100", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Analysis request failed (${r.status})`);
        return r.json();
      })
      .then((data: { items: AnalyzedArticleRow[] }) => {
        if (active) {
          setItems(data.items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(
    () =>
      (items ?? []).filter((item) => {
        if (kind !== "all" && kindOf(item) !== kind) return false;
        if (category !== "all" && item.category !== category) return false;
        return true;
      }),
    [items, kind, category],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
          Deep dives
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
          Research
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          基于真实论文、报告与开源项目生成的结构化研究材料：摘要、关键变化、差异、证据、局限与推荐阅读。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<KindFilter>
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All" },
            { value: "paper", label: "Papers" },
            { value: "report", label: "Reports" },
            { value: "open-source", label: "Open Source" },
          ]}
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryId | "all")}
          aria-label="Filter research by category"
          className="w-full sm:w-56"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-sm text-danger">加载失败：{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {!error && items === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading research materials…
        </div>
      ) : !error && results.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="No research entries"
          description="先到 Analysis 页面运行分析，或调整筛选条件后再试。"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {results.map((item) => (
            <ResearchCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
