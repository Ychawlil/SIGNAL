"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Cpu } from "lucide-react";
import type { ModelFamily, ModelVersion } from "@/lib/server/analysis/types";

function Field({ label, value }: { label: string; value: string | boolean | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-panel-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
      <span className="text-muted-accent">{label}</span>
      {typeof value === "boolean" ? (value ? "yes" : "no") : value}
    </span>
  );
}

function VersionRow({ version }: { version: ModelVersion }) {
  return (
    <li className="rounded-md border border-border bg-panel-secondary p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">
            {version.name}
          </span>
          {version.version && (
            <Badge variant="accent" className="font-mono">
              {version.version}
            </Badge>
          )}
          <Badge
            variant={
              version.claimOrigin === "independent"
                ? "accent"
                : version.claimOrigin === "vendor"
                  ? "warning"
                  : "muted"
            }
            className="font-mono uppercase tracking-wide"
          >
            {version.claimOrigin}
          </Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Field label="params" value={version.params} />
        <Field label="license" value={version.license} />
        <Field label="open weights" value={version.openWeights} />
        <Field label="API" value={version.apiAvailable} />
        {version.benchmarks.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-panel-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
            benchmarks: {version.benchmarks.join(", ")}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">{version.evalNote}</p>
    </li>
  );
}

export function ModelView({ families }: { families: ModelFamily[] }) {
  if (families.length === 0) {
    return (
      <EmptyState
        icon={<Cpu />}
        title="No model versions detected"
        description="分析引擎会从模型发布与仓库 Release 中提取版本信息。先运行一次分析。"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {families.map((family) => (
        <section key={family.family} className="rounded-lg border border-border bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-mono text-sm font-semibold text-foreground">
              {family.family}
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {family.versions.length} version{family.versions.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-warning">
            {family.comparisonNote}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {family.versions.map((version) => (
              <VersionRow
                key={`${version.family}-${version.version ?? version.name}`}
                version={version}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
