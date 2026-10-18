import "server-only";
import { isProviderEnabled } from "../env";
import { runSync } from "../ingest";
import { analyzeBriefingWindow, ensureAnalysis, getDailyBriefing } from "../analysis/service";
import { collectGithubTrends } from "../trends/github";
import { runTask, type TaskName, type TaskTrigger } from "./runner";

export const syncJob = () => runSync();

/**
 * Select the briefing first, then analyze only its items.
 *
 * The explicit "analyze the whole archive" action lives on the Analysis page
 * and uses `ensureAnalysis`; a routine refresh must not pay for every new
 * article the sources return.
 */
export const makeAnalyzeJob = (maxItems?: number) => async () =>
  analyzeBriefingWindow({ maxItems });

export const analyzeJob = makeAnalyzeJob();

/**
 * Explicit full-archive analysis (Analysis page → "运行分析").
 *
 * Deliberately separate from the refresh pipeline: this one does pay for
 * every unanalyzed article, so it stays an opt-in action.
 */
export const fullAnalysisJob = () => ensureAnalysis();

export const briefingJob = () => getDailyBriefing({ force: true });

export const trendsJob = async () => {
  // Paused collection: report a no-op instead of failing on every tick.
  if (!isProviderEnabled("github")) {
    return {
      searched: 0,
      reposDiscovered: 0,
      snapshotsTaken: 0,
      detailedRepos: 0,
      note: "GitHub 采集已暂停（SIGNAL_DISABLED_PROVIDERS），已跳过；历史快照保留。",
    };
  }
  return collectGithubTrends(30);
};

/** Sequential, lock-per-step pipeline for the scheduler and manual "run all". */
export async function runPipeline(trigger: TaskTrigger): Promise<{
  steps: { task: TaskName; status: string; error: string | null }[];
}> {
  const steps: { task: TaskName; status: string; error: string | null }[] = [];
  const order: TaskName[] = ["sync", "analyze", "briefing", "trends"];

  for (const task of order) {
    const fn =
      task === "sync"
        ? syncJob
        : task === "analyze"
          ? analyzeJob
          : task === "briefing"
            ? briefingJob
            : trendsJob;
    const result = await runTask<unknown>(
      task,
      trigger,
      fn as () => Promise<unknown>,
      { retries: 1 },
    );
    steps.push({ task, status: result.status, error: result.error });
  }

  return { steps };
}
