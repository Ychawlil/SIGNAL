import { NextRequest, NextResponse } from "next/server";
import { clampBriefingItems } from "@/lib/server/analysis/briefing";
import type { BriefingAnalysisSummary } from "@/lib/server/analysis/service";
import { guard } from "@/lib/server/auth";
import { makeAnalyzeJob, syncJob } from "@/lib/server/tasks/jobs";
import { runTask } from "@/lib/server/tasks/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual "update now" from the Daily Briefing page.
 *
 * Order is deliberate: collect new articles, give them a cheap deterministic
 * baseline, *select* today's briefing, and only then call the analysis engine
 * for the selected items that do not already have a real analysis. A refresh
 * therefore costs at most `count` model calls.
 *
 * Steps are locked and idempotent, and every insert is guarded by unique
 * constraints, so repeated clicks cannot duplicate articles or briefing
 * items. The briefing is regenerated even when a source fails so the page
 * never keeps serving a stale payload.
 */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  // The "daily signal count" preference lives in the browser, so the client
  // tells us how many items today's briefing should contain.
  const body = (await request.json().catch(() => ({}))) as { count?: unknown };
  const maxItems =
    body.count === undefined ? undefined : clampBriefingItems(body.count);

  const syncRun = await runTask("sync", "manual", syncJob, { retries: 1 });
  const analyzeRun = await runTask<BriefingAnalysisSummary>(
    "analyze",
    "manual",
    makeAnalyzeJob(maxItems),
    { retries: 1 },
  );

  const analyzeResult = analyzeRun.status === "success" ? analyzeRun.result : null;
  const syncResult = syncRun.status === "success" ? syncRun.result : null;

  return NextResponse.json({
    sync: {
      status: syncRun.status,
      totalNew: syncResult?.totalNew ?? 0,
      totalSkipped: syncResult?.totalSkipped ?? 0,
      error: syncRun.error ?? syncRun.skippedReason,
    },
    analyze: {
      status: analyzeRun.status,
      selected: analyzeResult?.selected ?? 0,
      baseline: analyzeResult?.baseline ?? 0,
      analyzed: analyzeResult?.analyzed ?? 0,
      skipped: analyzeResult?.skipped ?? 0,
      failed: analyzeResult?.failed ?? 0,
      failedSample: analyzeResult?.failedSample ?? null,
      engine: analyzeResult?.engine ?? null,
      error: analyzeRun.error ?? analyzeRun.skippedReason,
    },
    briefing: {
      count: analyzeResult?.briefingCount ?? null,
    },
  });
}
