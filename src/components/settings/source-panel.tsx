"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudDownload, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProviderId, ProviderStatus, SyncSummary } from "@/lib/server/types";

interface Overview {
  articles: { total: number; byProvider: Record<string, number> };
  providers: ProviderStatus[];
  recentErrors: { id: number; provider: ProviderId; message: string; createdAt: string }[];
}

interface GithubAuthInfo {
  tokenConfigured: boolean;
  tokenFormat: string;
  tokenLength: number;
  authenticated: boolean;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  searchLimit: number | null;
  searchRemaining: number | null;
  probedAt: string | null;
  error: string | null;
}

function fetchGithubAuth(force = false): Promise<GithubAuthInfo> {
  return fetch(`/api/intelligence/github-auth${force ? "?force=1" : ""}`, {
    cache: "no-store",
  }).then((response) => {
    if (!response.ok) throw new Error(`GitHub 认证检查失败 (${response.status})`);
    return response.json() as Promise<GithubAuthInfo>;
  });
}

function fetchOverview(): Promise<Overview> {
  return fetch("/api/intelligence/status", { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error(`状态请求失败 (${response.status})`);
    }
    return response.json() as Promise<Overview>;
  });
}

const HEALTH_STYLE: Record<ProviderStatus["health"], string> = {
  ok: "bg-accent-soft text-accent",
  degraded: "bg-warning-soft text-warning",
  error: "bg-danger/15 text-danger",
  disabled: "bg-panel-secondary text-muted-foreground",
  unconfigured: "bg-panel-secondary text-muted-foreground",
};

const HEALTH_LABEL: Record<ProviderStatus["health"], string> = {
  ok: "正常",
  degraded: "部分异常",
  error: "失败",
  disabled: "已停用",
  unconfigured: "未配置",
};

function formatTime(iso: string | null): string {
  if (!iso) return "暂无记录";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SourcePanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const [githubAuth, setGithubAuth] = useState<GithubAuthInfo | null>(null);
  const [probingAuth, setProbingAuth] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    fetchGithubAuth()
      .then((info) => {
        if (active) setGithubAuth(info);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const refreshAuth = () => {
    setProbingAuth(true);
    fetchGithubAuth(true)
      .then(setGithubAuth)
      .catch(() => {})
      .finally(() => setProbingAuth(false));
  };

  const onSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/intelligence/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as SyncSummary;
      setLastSync(data);
      const overview = await fetchOverview();
      setOverview(overview);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Sources &amp; sync
            </h3>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onSync}
            disabled={syncing}
          >
            {syncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CloudDownload className="h-3.5 w-3.5" />
            )}
            {syncing ? "正在同步…" : "立即同步"}
          </Button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {lastSync && (
          <div className="mt-4 rounded-md border border-border bg-panel-secondary px-3 py-2 text-xs text-muted-foreground">
            <p className="font-mono">
              Last sync added {lastSync.totalNew} article(s) across{" "}
              {lastSync.runs.filter((run) => run.status === "success").length}/
              {lastSync.runs.length} enabled source(s).
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
              {lastSync.runs.filter((run) => run.provider !== "arxiv" || run.status !== "disabled").map((run) => (
                <li key={run.provider}>
                  <span
                    className={cn(
                      run.status === "success"
                        ? "text-accent"
                        : run.status === "disabled"
                          ? "text-muted-accent"
                          : "text-warning",
                    )}
                  >
                    {run.name}
                  </span>
                  <span className="ml-1">
                    {run.status === "disabled" ? "paused" : `${run.status} +${run.itemsNew}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {overview ? (
          <>
            <div className="mt-4 flex items-center gap-2 text-sm text-foreground">
              <Database className="h-4 w-4 text-muted-accent" />
              {overview.articles.total} 篇 stored
            </div>

            {githubAuth && (
              <div className="mt-3 rounded-md border border-border bg-panel-secondary p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-accent" />
                    <span className="text-sm font-medium text-foreground">
                      GitHub 认证
                    </span>
                    <Badge
                      className={cn(
                        "font-mono uppercase tracking-wide",
                        githubAuth.authenticated
                          ? "bg-accent-soft text-accent"
                          : githubAuth.tokenConfigured
                            ? "bg-danger/15 text-danger"
                            : "bg-warning-soft text-warning",
                      )}
                    >
                      {githubAuth.authenticated
                        ? "verified"
                        : githubAuth.tokenConfigured
                          ? "rejected"
                          : "not configured"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshAuth}
                    disabled={probingAuth}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5", probingAuth && "animate-spin")}
                    />
                    重新检查
                  </Button>
                </div>
                <p className="mt-1 font-mono text-[11px] leading-5 text-muted-foreground">
                  {githubAuth.tokenConfigured
                    ? `令牌类型：${githubAuth.tokenFormat} · ${githubAuth.tokenLength} 个字符（值不在前端展示）`
                    : "服务端未读取到 GITHUB_TOKEN"}
                </p>
                <p className="font-mono text-[11px] leading-5 text-muted-foreground">
                  {githubAuth.limit !== null
                    ? `基础接口剩余 ${githubAuth.remaining ?? "?"}/${githubAuth.limit} · 重置 ${
                        githubAuth.resetAt
                          ? new Date(githubAuth.resetAt).toLocaleString()
                          : "未知"
                      }`
                    : "未取得基础接口配额"}
                  {githubAuth.searchLimit !== null
                    ? ` · 搜索接口剩余 ${githubAuth.searchRemaining ?? "?"}/${githubAuth.searchLimit}`
                    : ""}
                </p>
                {githubAuth.error && (
                  <p className="mt-1 text-[11px] leading-5 text-danger">
                    探测失败：{githubAuth.error}
                  </p>
                )}
              </div>
            )}

            <ul className="mt-3 flex flex-col gap-2">
              {overview.providers.filter((provider) => provider.id !== "arxiv" || provider.enabled).map((provider) => (
                <li
                  key={provider.id}
                  className="rounded-md border border-border bg-panel-secondary p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {provider.name}
                        </span>
                        <Badge className={cn("font-mono uppercase tracking-wide", HEALTH_STYLE[provider.health])}>
                          {HEALTH_LABEL[provider.health]}
                        </Badge>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-accent">
                          {provider.enabled ? "自动采集：启用" : "自动采集：已暂停"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {provider.message}
                      </p>
                      {!provider.enabled && provider.lastError && (
                        <p className="mt-1 text-xs leading-5 text-warning">
                          最后失败原因：{provider.lastError}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      <p>
                        最近成功：{" "}
                        <span className="text-foreground">
                          {formatTime(provider.lastSuccessAt)}
                        </span>
                      </p>
                      <p>
                        上次采集： {provider.lastItemsNew ?? 0} 条新增 /{" "}
                        {provider.lastItemsSeen ?? 0} 条检索
                      </p>
                      <p>
                        已入库：{" "}
                        <span className="text-foreground">{provider.storedArticles}</span> articles
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {overview.recentErrors.length > 0 && (
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                  最近错误
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {overview.recentErrors.map((err) => (
                    <li
                      key={err.id}
                      className="flex gap-2 text-xs leading-5 text-muted-foreground"
                    >
                      <span className="font-mono text-warning">[{err.provider}]</span>
                      <span className="min-w-0 flex-1 truncate">{err.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          !error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              正在加载来源状态…
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
