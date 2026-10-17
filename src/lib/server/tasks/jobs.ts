import "server-only";
import { runSync } from "../ingest";
import { ensureAnalysis, getDailyBriefing } from "../analysis/service";
import { collectGithubTrends } from "../trends/github";
import { runTask, type TaskName, type TaskTrigger } from "./runner";

export const syncJob = () => runSync();

export const analyzeJob = async () => {
  const summary = await ensureAnalysis();
  const briefing = getDailyBriefing();
  return { ...summary, briefingCount: briefing.count };
};

export const briefingJob = () => getDailyBriefing();

export const trendsJob = () => collectGithubTrends(30);

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
