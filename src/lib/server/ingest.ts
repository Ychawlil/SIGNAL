import "server-only";
import {
  articleCounts,
  finishRun,
  getProviderState,
  insertArticles,
  latestError,
  latestRun,
  latestSuccessRun,
  recordError,
  recentErrors,
  saveProviderState,
  startRun,
} from "./db";
import { PROVIDERS } from "./providers";
import { ProviderUnavailableError } from "./providers/base";
import { isProviderEnabled } from "./env";
import type {
  IntelligenceProvider,
  ProviderId,
  ProviderStatus,
  SyncSummary,
} from "./types";

/** Providers whose health check already says they cannot run. */
function isRunnable(provider: IntelligenceProvider): boolean {
  return provider.healthCheck().health !== "unconfigured";
}

export async function runSync(
  providerIds?: ProviderId[],
): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const targets = providerIds
    ? PROVIDERS.filter((p) => providerIds.includes(p.id))
    : PROVIDERS;

  const runs: SyncSummary["runs"] = [];
  let totalNew = 0;
  let totalSkipped = 0;

  for (const provider of targets) {
    const run = startRun(provider.id);

    // Paused sources keep their historical rows but make no outbound request.
    if (!isProviderEnabled(provider.id)) {
      const message =
        "自动采集已暂停（SIGNAL_DISABLED_PROVIDERS）。历史数据保留，不做任何请求。";
      finishRun(run, { status: "disabled", errorMessage: null });
      runs.push({
        provider: provider.id,
        name: provider.name,
        status: "disabled",
        itemsSeen: 0,
        itemsNew: 0,
        message,
      });
      continue;
    }

    const health = provider.healthCheck();

    if (health.health === "unconfigured") {
      finishRun(run, {
        status: "unconfigured",
        errorMessage: health.message,
      });
      runs.push({
        provider: provider.id,
        name: provider.name,
        status: "unconfigured",
        itemsSeen: 0,
        itemsNew: 0,
        message: health.message,
      });
      continue;
    }

    try {
      const state = getProviderState(provider.id);
      const result = await provider.fetch({
        since: state?.lastSince ?? undefined,
        cursor: state?.lastCursor ?? undefined,
        etag: state?.etag ?? undefined,
      });

      const { inserted, skipped } = insertArticles(result.articles);
      totalNew += inserted;
      totalSkipped += skipped;

      // Non-fatal warnings (e.g. a later arXiv page failed) are logged
      // without discarding the pages that did arrive.
      for (const warning of result.warnings ?? []) {
        recordError(provider.id, run.id, warning);
      }

      const syncTime = new Date().toISOString();
      saveProviderState(provider.id, {
        etag: result.etag,
        cursor: result.cursor,
        // Providers may roll the watermark back when they could not finish.
        since: result.nextSince ?? syncTime,
      });

      finishRun(run, {
        status: "success",
        itemsSeen: result.itemsSeen,
        itemsNew: inserted,
        itemsUpdated: 0,
        truncated: result.truncated,
        cursor: result.cursor ?? null,
        etag: result.etag ?? null,
      });

      runs.push({
        provider: provider.id,
        name: provider.name,
        status: "success",
        itemsSeen: result.itemsSeen,
        itemsNew: inserted,
        message: skipped > 0 ? `${skipped} duplicate(s) skipped` : null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const detail =
        error instanceof Error && error.stack ? error.stack : undefined;

      recordError(provider.id, run.id, message, detail);
      // Keep the last successful data — we never delete on failure.
      finishRun(run, { status: "error", errorMessage: message });

      if (error instanceof ProviderUnavailableError) {
        runs.push({
          provider: provider.id,
          name: provider.name,
          status: "unconfigured",
          itemsSeen: 0,
          itemsNew: 0,
          message,
        });
      } else {
        runs.push({
          provider: provider.id,
          name: provider.name,
          status: "error",
          itemsSeen: 0,
          itemsNew: 0,
          message,
        });
      }
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    runs,
    totalNew,
    totalSkipped,
  };
}

export function getProviderStatuses(): ProviderStatus[] {
  const counts = articleCounts().byProvider;

  return PROVIDERS.map((provider) => {
    const enabled = isProviderEnabled(provider.id);
    const health = provider.healthCheck();
    const last = latestRun(provider.id);
    const lastSuccess = latestSuccessRun(provider.id);
    const error = latestError(provider.id);

    // A paused source is reported as disabled regardless of the last run.
    // A provider that just failed shows "error"; otherwise use health.
    const effectiveHealth = !enabled
      ? "disabled"
      : last?.status === "error"
        ? "error"
        : health.health;

    const message = !enabled
      ? "自动采集已暂停；历史数据仍可查看，不做任何请求。"
      : effectiveHealth === "error" && error
        ? error
        : health.message;

    return {
      id: provider.id,
      name: provider.name,
      health: effectiveHealth,
      message,
      enabled,
      lastRunAt: last?.startedAt ?? null,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      lastItemsSeen: lastSuccess?.itemsSeen ?? null,
      lastItemsNew: lastSuccess?.itemsNew ?? null,
      lastError: error,
      storedArticles: counts[provider.id] ?? 0,
    };
  });
}

export function getSourceOverview() {
  return {
    articles: articleCounts(),
    providers: getProviderStatuses(),
    recentErrors: recentErrors(10),
  };
}

export { isRunnable };
