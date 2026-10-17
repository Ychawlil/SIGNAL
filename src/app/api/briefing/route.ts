import { NextResponse } from "next/server";
import { ensureAnalysis, getDailyBriefing } from "@/lib/server/analysis/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAnalysis();
  const briefing = getDailyBriefing();
  return NextResponse.json(briefing);
}
