import { NextRequest, NextResponse } from "next/server";
import { buildRelated } from "@/lib/server/library/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const articleId = Number(request.nextUrl.searchParams.get("articleId") ?? "0");
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "articleId is required" }, { status: 400 });
  }
  return NextResponse.json(buildRelated(articleId));
}
