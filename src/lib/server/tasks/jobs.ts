import "server-only";
import { isProviderEnabled } from "../env";
import { runSync } from "../ingest";
import { ensureAnalysis, getDailyBriefing } from "../analysis/service";
import { collectGithubTrends } from "../trends/github";
import { runTask, type TaskName, type TaskTrigger } from "./runner";

export const syncJob = () => runSync();

export const analyzeJob = async () => {
  const summary = await ensureAnalysis();
  // Regenerate so a sync on the same day is reflected in the briefing.
  const briefing = getDailyBriefing({ force: true });
  return { ...summary, briefingCount: briefing.count };
};

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
