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

  for (const provider of targets) {
    const health = provider.healthCheck();
    const run = startRun(provider.id);

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

      const syncTime = new Date().toISOString();
      saveProviderState(provider.id, {
        etag: result.etag,
        cursor: result.cursor,
        since: syncTime,
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

  return { startedAt, finishedAt: new Date().toISOString(), runs, totalNew };
}

export function getProviderStatuses(): ProviderStatus[] {
  return PROVIDERS.map((provider) => {
    const health = provider.healthCheck();
    const last = latestRun(provider.id);
    const lastSuccess = latestSuccessRun(provider.id);
    const error = latestError(provider.id);

    // A provider that just failed shows "error"; otherwise use health.
    const effectiveHealth =
      last?.status === "error" ? "error" : health.health;

    return {
      id: provider.id,
      name: provider.name,
      health: effectiveHealth,
      message:
        effectiveHealth === "error" && error
          ? error
          : health.message,
      lastRunAt: last?.startedAt ?? null,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      lastItemsSeen: lastSuccess?.itemsSeen ?? null,
      lastItemsNew: lastSuccess?.itemsNew ?? null,
      lastError: error,
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
