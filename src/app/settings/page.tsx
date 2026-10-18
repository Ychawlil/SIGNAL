"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Database, Moon, Save, ShieldCheck, Sun } from "lucide-react";
import { useSettings, useTheme } from "@/components/providers";
import { SourcePanel } from "@/components/settings/source-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SORT_OPTIONS } from "@/lib/constants";
import type { SortKey, TopicId } from "@/lib/types";
import { cn } from "@/lib/utils";

function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-[15px]">{title}</CardTitle>
          {description && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();

  // Weights live on the server because they drive importance scoring.
  const [weights, setWeights] = useState<Record<TopicId, number> | null>(null);
  const [draftWeights, setDraftWeights] = useState<Record<TopicId, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [rescored, setRescored] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/weights", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { weights: Record<TopicId, number> }) => {
        if (!active) return;
        setWeights(data.weights);
        setDraftWeights(data.weights);
      })
      .catch((err: unknown) => {
        if (active) setWeightError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const weightsDirty =
    weights !== null &&
    draftWeights !== null &&
    settings.focusAreas.some(
      (area) => (draftWeights[area.id] ?? 0) !== (weights[area.id] ?? 0),
    );

  const saveWeights = () => {
    if (!draftWeights) return;
    setSaving(true);
    setWeightError(null);
    setNotice(null);
    fetch("/api/settings/weights", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weights: draftWeights }),
    })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as {
          weights?: Record<TopicId, number>;
          rescored?: number;
          error?: string;
        };
        if (!r.ok) throw new Error(body.error ?? String(r.status));
        const next = body.weights ?? draftWeights;
        setWeights(next);
        setDraftWeights(next);
        setRescored(body.rescored ?? 0);
        setNotice("??????????????????");
      })
      .catch((err: unknown) => {
        setWeightError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
          Preferences
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          主题、关注领域与数据偏好。关注权重保存在服务端并直接参与重要性计算；其余偏好保存在本地浏览器，暂无真实账号系统。
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingSection title="Theme" description="切换工作台的深色 / 浅色主题。">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" />, hint: "Research terminal" },
                { value: "light", label: "Light", icon: <Sun className="h-4 w-4" />, hint: "Editorial paper" },
              ] as const
            ).map((option) => {
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-panel-secondary hover:border-border-strong",
                  )}
                >
                  <span className={cn("flex items-center gap-2 text-sm font-medium", active ? "text-accent" : "text-foreground")}>
                    {option.icon}
                    {option.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </SettingSection>

        <SettingSection
          title="Daily signal count"
          description="每日简报最多展示的情报条数，首页与分析页都会按此数量生成简报。"
        >
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={30}
              step={1}
              value={settings.dailySignalCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) {
                  updateSettings({ dailySignalCount: Math.min(30, Math.max(1, n)) });
                }
              }}
              className="w-28"
              aria-label="Daily signal count"
            />
            <span className="text-sm text-muted-foreground">signals per briefing</span>
          </div>
        </SettingSection>
      </div>

      <SettingSection
        title="Focus areas & weights"
        description="权重直接参与重要性计算：每个类别取该类别下最高的主题权重，换算为 0–30 的相关性因子。保存后会立即重算全部已分析情报的分数。"
      >
        {draftWeights === null ? (
          <p className="text-sm text-muted-foreground">
            {weightError ? `加载失败：${weightError}` : "加载权重…"}
          </p>
        ) : (
          <>
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {settings.focusAreas.map((area) => {
                const value = draftWeights[area.id] ?? 0;
                return (
                  <li key={area.id} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-sm text-foreground">
                      {area.label}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={value}
                      onChange={(e) =>
                        setDraftWeights((prev) =>
                          prev ? { ...prev, [area.id]: Number(e.target.value) } : prev,
                        )
                      }
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-panel-secondary accent-accent"
                      aria-label={`${area.label} weight`}
                    />
                    <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {value}
                      <span className="ml-1 text-muted-accent">
                        →{Math.round((value / 100) * 30)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs leading-5 text-muted-foreground">
                右侧小字是该权重换算出的相关性因子（满分 30）。
                {rescored !== null
                  ? `本次已重算 ${rescored} 条分析。`
                  : weightsDirty
                    ? "有未保存的修改。"
                    : notice ?? ""}
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={saveWeights}
                disabled={!weightsDirty || saving}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "保存中…" : "保存并重算"}
              </Button>
            </div>
          </>
        )}
        {weightError && draftWeights !== null && (
          <p className="mt-3 text-xs leading-5 text-danger">保存失败：{weightError}</p>
        )}
      </SettingSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingSection
          title="Default sorting"
          description="Explore 列表打开时使用的排序方式；在 Explore 内手动切换会覆盖它。"
        >
          <Select
            value={settings.defaultSort}
            onChange={(e) => updateSettings({ defaultSort: e.target.value as SortKey })}
            className="w-full sm:w-56"
            aria-label="Default sorting"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </SettingSection>

        <SettingSection title="Data status" description="本地数据更新状态的占位。">
          <div className="flex flex-col gap-2 rounded-md border border-border bg-panel-secondary p-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Database className="h-4 w-4 text-muted-accent" />
              {settings.dataStatus === "synced" ? "已同步" : "从未同步"}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              真实情报源的采集状态见下方「Sources &amp; sync」面板。
              {settings.lastSyncedAt
                ? ` 上次同步：${settings.lastSyncedAt}`
                : " 尚无同步记录。"}
            </p>
          </div>
        </SettingSection>
      </div>

      <SourcePanel />

      <SettingSection title="Data sources & privacy" description="关于数据来源与隐私的说明。">
        <div className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
          <div className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-accent" />
            <p>
              情报采集仅在你手动触发「Sync now」或调用同步接口时进行，向 arXiv / GitHub
              等公开来源发起只读请求，并把规范化结果保存在本机 SQLite 数据库（.data/signal.db）中。
            </p>
          </div>
          <p>
            收藏、笔记、已读状态、主题与设置仍保存在浏览器 localStorage 中；所有 API 密钥只读取自服务端环境变量，不会进入前端代码或浏览器。
          </p>
        </div>
      </SettingSection>
    </div>
  );
}
