"use client";

import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, RefreshCw } from "lucide-react";
import { BriefingView } from "@/components/analysis/briefing-view";
import { ImportanceView } from "@/components/analysis/importance-view";
import { ModelView } from "@/components/analysis/model-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import type { AnalyzedArticleRow } from "@/lib/server/analysis/store";
import type { DailyBriefing, ModelFamily } from "@/lib/server/analysis/types";

type Tab = "briefing" | "importance" | "models";

interface RunSummary {
  engine: string;
  engineMessage: string;
  analyzed: number;
  models: number;
  totalAnalyzed: number;
}

function fetchBriefing(): Promise<DailyBriefing> {
  return fetch("/api/briefing", { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`Briefing request failed (${r.status})`);
    return r.json();
  });
}

function fetchModels(): Promise<ModelFamily[]> {
  return fetch("/api/models", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`Models request failed (${r.status})`);
      return r.json();
    })
    .then((d: { families: ModelFamily[] }) => d.families);
}

function fetchAnalyses(): Promise<AnalyzedArticleRow[]> {
  return fetch("/api/analysis?pageSize=40", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`Analysis request failed (${r.status})`);
      return r.json();
    })
    .then((d: { items: AnalyzedArticleRow[] }) => d.items);
}

function fetchAll(): Promise<[DailyBriefing, ModelFamily[], AnalyzedArticleRow[]]> {
  return Promise.all([fetchBriefing(), fetchModels(), fetchAnalyses()]);
}

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>("briefing");
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [families, setFamilies] = useState<ModelFamily[] | null>(null);
  const [analyses, setAnalyses] = useState<AnalyzedArticleRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetchAll()
      .then(([b, m, a]) => {
        if (active) {
          setBriefing(b);
          setFamilies(m);
          setAnalyses(a);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onRun = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const summary = (await response.json()) as RunSummary;
      setRunSummary(summary);
      const [b, m, a] = await fetchAll();
      setBriefing(b);
      setFamilies(m);
      setAnalyses(a);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            AI analysis engine
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            Analysis
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            对已采集的真实情报做结构化分析：一句话摘要、关键变化、证据、局限、影响与个人相关性，并独立评估重要性与可信度。
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onRun} disabled={syncing}>
          {syncing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BrainCircuit className="h-3.5 w-3.5" />
          )}
          {syncing ? "Analyzing…" : "Run analysis"}
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {runSummary && (
        <div className="rounded-md border border-border bg-panel-secondary px-4 py-3 font-mono text-xs text-muted-foreground">
          engine: {runSummary.engine} · newly analyzed: {runSummary.analyzed} ·
          model versions: {runSummary.models} · total analyzed: {runSummary.totalAnalyzed}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          size="md"
          options={[
            { value: "briefing", label: "Daily briefing" },
            { value: "importance", label: "Importance vs confidence" },
            { value: "models", label: "Model tracking" },
          ]}
        />
        {briefing && (
          <Badge variant="accent" className="font-mono">
            {briefing.count} briefing item{briefing.count === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading analysis…
        </div>
      ) : tab === "briefing" ? (
        briefing ? (
          <BriefingView briefing={briefing} />
        ) : (
          <EmptyState
            icon={<BrainCircuit />}
            title="No briefing yet"
            description="点击「Run analysis」生成分析，随后会自动产出今日简报。"
          />
        )
      ) : tab === "importance" ? (
        analyses && analyses.length > 0 ? (
          <ImportanceView items={analyses} />
        ) : (
          <EmptyState
            icon={<BrainCircuit />}
            title="No analyses yet"
            description="点击「Run analysis」为已采集情报生成结构化分析。"
          />
        )
      ) : families && families.length > 0 ? (
        <ModelView families={families} />
      ) : (
        <EmptyState
          icon={<BrainCircuit />}
          title="No model versions detected"
          description="分析引擎会从模型发布与仓库 Release 中提取版本信息。"
        />
      )}
    </div>
  );
}
