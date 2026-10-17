"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, FileText, FlaskConical, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { CATEGORIES, TOPIC_NAMES } from "@/lib/constants";
import { RESEARCH_ITEMS } from "@/lib/mock-data";
import type { CategoryId, ResearchItem, ResearchKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type KindFilter = ResearchKind | "all";

const KIND_META: Record<ResearchKind, { label: string; icon: ReactNode }> = {
  paper: { label: "Paper", icon: <FileText className="h-3.5 w-3.5" /> },
  report: { label: "Report", icon: <BookOpen className="h-3.5 w-3.5" /> },
  "open-source": { label: "Open Source", icon: <GitBranch className="h-3.5 w-3.5" /> },
};

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

function ResearchCard({ item }: { item: ResearchItem }) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[item.kind];

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
            {item.sourceName} · {item.importanceScore}/100 importance
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
            <Field label="Research question">{item.researchQuestion}</Field>
            <Field label="Core method">{item.coreMethod}</Field>
            <Field label="Innovation">{item.innovation}</Field>
            <Field label="Experiments & evidence">{item.evidence}</Field>
            <Field label="Limitations & open problems">{item.limitations}</Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                  Related works
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {item.relatedWorks.map((w) => (
                    <li key={w} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted-accent" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                  Recommended reading order
                </p>
                <ol className="mt-1.5 flex flex-col gap-1">
                  {item.readingOrder.map((step, i) => (
                    <li key={step} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                      <span className="font-mono text-xs tabular-nums text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
              {item.topics.map((t) => (
                <Badge key={t} variant="accent">
                  {TOPIC_NAMES[t]}
                </Badge>
              ))}
              {item.tags.map((tag) => (
                <Badge key={tag} variant="muted">
                  #{tag}
                </Badge>
              ))}
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

  const results = useMemo(
    () =>
      RESEARCH_ITEMS.filter((item) => {
        if (kind !== "all" && item.kind !== kind) return false;
        if (category !== "all" && item.category !== category) return false;
        return true;
      }),
    [kind, category],
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
          值得深入研究的论文、技术报告与开源项目。当前为示例阅读材料，未接入真实论文服务。
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

      {results.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="No research entries"
          description="调整筛选条件后再试。"
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
