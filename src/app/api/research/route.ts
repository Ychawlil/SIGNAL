import { NextRequest, NextResponse } from "next/server";
import { listResearchRecords } from "@/lib/server/analysis/store";
import { ensureScoringCurrent } from "@/lib/server/analysis/rescore";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Existing research cards use the shared article summaries and scoring data. */
export async function GET(request: NextRequest) {
 ensureScoringCurrent();
 const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
 const pageSize = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("pageSize")) || 20));
 return NextResponse.json({ ...listResearchRecords({ page, pageSize }), page, pageSize });
}
