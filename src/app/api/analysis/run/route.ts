import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/server/auth";
import { runTask } from "@/lib/server/tasks/runner";
import { analyzeJob } from "@/lib/server/tasks/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const run = await runTask("analyze", "manual", analyzeJob, { retries: 1 });
  if (run.status === "success") {
    return NextResponse.json(
      run.result ?? { engine: "rule-based", analyzed: 0, models: 0, totalAnalyzed: 0 },
    );
  }
  if (run.status === "skipped") {
    return NextResponse.json({ error: run.skippedReason }, { status: 409 });
  }
  return NextResponse.json({ error: run.error }, { status: 502 });
}