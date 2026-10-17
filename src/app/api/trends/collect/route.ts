import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/server/auth";
import { isProviderEnabled } from "@/lib/server/env";
import { runTask } from "@/lib/server/tasks/runner";
import { trendsJob } from "@/lib/server/tasks/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  // GitHub collection is paused: keep the historical snapshots, make no calls.
  if (!isProviderEnabled("github")) {
    return NextResponse.json(
      {
        error:
          "GitHub 采集已暂停（SIGNAL_DISABLED_PROVIDERS）。历史快照仍可查看，但不会生成新的趋势数据。",
        paused: true,
      },
      { status: 409 },
    );
  }

  const run = await runTask("trends", "manual", trendsJob, { retries: 1 });
  if (run.status === "success") {
    return NextResponse.json(run.result ?? { reposDiscovered: 0, snapshotsTaken: 0 });
  }
  if (run.status === "skipped") {
    return NextResponse.json({ error: run.skippedReason }, { status: 409 });
  }
  return NextResponse.json({ error: run.error }, { status: 502 });
}