import { NextRequest, NextResponse } from "next/server";
import { getDailyBriefing, type AnalysisRunSummary } from "@/lib/server/analysis/service";
import { guard } from "@/lib/server/auth";
import { analyzeJob, syncJob } from "@/lib/server/tasks/jobs";
import { runTask } from "@/lib/server/tasks/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeJobResult = AnalysisRunSummary & { briefingCount: number };

/**
 * Manual "update now" from the Daily Briefing page: pull new articles,
 * analyze the unseen ones, then rebuild the briefing from stored data.
 *
 * Steps are locked and idempotent, and every insert is guarded by unique
 * constraints, so repeated clicks cannot duplicate articles or briefing
 * items. The briefing is regenerated even when a source fails so the page
 * never keeps serving a stale payload.
 */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const syncRun = await runTask("sync", "manual", syncJob, { retries: 1 });
  const analyzeRun = await runTask<AnalyzeJobResult>("analyze", "manual", analyzeJob, {
    retries: 1,
  });

  // analyzeJob already rebuilds the briefing; only force a rebuild when that
  // step could not run (failed or locked by another task).
  const briefing =
    analyzeRun.status === "success" ? getDailyBriefing() : getDailyBriefing({ force: true });
  const syncResult = syncRun.status === "success" ? syncRun.result : null;
  const analyzeResult = analyzeRun.status === "success" ? analyzeRun.result : null;

  return NextResponse.json({
    sync: {
      status: syncRun.status,
      totalNew: syncResult?.totalNew ?? 0,
      totalSkipped: syncResult?.totalSkipped ?? 0,
      error: syncRun.error ?? syncRun.skippedReason,
    },
    analyze: {
      status: analyzeRun.status,
      analyzed: analyzeResult?.analyzed ?? 0,
      error: analyzeRun.error ?? analyzeRun.skippedReason,
    },
    briefing: {
      date: briefing.date,
      generatedAt: briefing.generatedAt,
      count: briefing.count,
    },
  });
}
