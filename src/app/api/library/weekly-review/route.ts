import { NextResponse } from "next/server";
import { getOrBuildWeeklyReview } from "@/lib/server/library/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getOrBuildWeeklyReview());
}
