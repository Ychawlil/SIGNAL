import { NextResponse } from "next/server";
import { getSourceOverview } from "@/lib/server/ingest";
import {
  lastSuccessfulRun,
  listTaskRuns,
  type TaskName,
} from "@/lib/server/tasks/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASKS: TaskName[] = ["sync", "analyze", "briefing", "trends"];

export async function GET() {
  const recentRuns = listTaskRuns("all", 20);

  const tasks = TASKS.map((task) => {
    const runs = recentRuns.filter((r) => r.task === task);
    const lastSuccess = lastSuccessfulRun(task);
    return {
      task,
      lastRunAt: runs[0]?.startedAt ?? null,
      lastStatus: runs[0]?.status ?? null,
      lastError: runs[0]?.error ?? null,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
    };
  });

  return NextResponse.json({
    tasks,
    recentRuns,
    coverage: getSourceOverview(),
  });
}
