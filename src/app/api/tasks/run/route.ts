import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/server/auth";
import { runTask, type TaskName } from "@/lib/server/tasks/runner";
import {
  analyzeJob,
  briefingJob,
  runPipeline,
  syncJob,
  trendsJob,
} from "@/lib/server/tasks/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASKS: TaskName[] = ["sync", "analyze", "briefing", "trends", "pipeline"];

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { task?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const task = body.task as TaskName;
  if (!TASKS.includes(task)) {
    return NextResponse.json({ error: "invalid task" }, { status: 400 });
  }

  if (task === "pipeline") {
    const result = await runPipeline("manual");
    return NextResponse.json(result);
  }

  const fn =
    task === "sync"
      ? syncJob
      : task === "analyze"
        ? analyzeJob
        : task === "briefing"
          ? briefingJob
          : trendsJob;

  const run = await runTask<unknown>(task, "manual", fn as () => Promise<unknown>, { retries: 1 });
  if (run.status === "skipped") {
    return NextResponse.json({ error: run.skippedReason }, { status: 409 });
  }
  if (run.status === "error") {
    return NextResponse.json({ error: run.error }, { status: 502 });
  }
  return NextResponse.json(run.result ?? { ok: true });
}
