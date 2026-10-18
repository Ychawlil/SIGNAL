import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/server/auth";
import { fullAnalysisJob } from "@/lib/server/tasks/jobs";
import { runTask } from "@/lib/server/tasks/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Explicit "analyze the whole archive" action from the Analysis page.
 *
 * This is the only place that pays for every unanalyzed article; the routine
 * refresh pipeline (`/api/briefing/refresh`) selects the briefing first and
 * analyzes only the items it contains.
 */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const run = await runTask("analyze", "manual", fullAnalysisJob, { retries: 1 });
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
