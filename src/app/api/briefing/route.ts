import { NextRequest, NextResponse } from "next/server";
import { ensureBaselineAnalysis, getDailyBriefing } from "@/lib/server/analysis/service";
import { clampBriefingItems } from "@/lib/server/analysis/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Reading the briefing must stay free and fast: only the deterministic
  // baseline is filled in here. Paid analysis happens on manual refresh and
  // only for the items selected into the briefing.
  ensureBaselineAnalysis();

  // The "daily signal count" preference lives in the browser, so the client
  // passes it explicitly instead of the server guessing.
  const countParam = request.nextUrl.searchParams.get("count");
  const briefing = getDailyBriefing({
    maxItems: countParam === null ? undefined : clampBriefingItems(countParam),
  });
  return NextResponse.json(briefing);
}
