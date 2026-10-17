import { NextRequest, NextResponse } from "next/server";
import { listAnalyses } from "@/lib/server/analysis/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "20") || 20));
  const minImportanceParam = params.get("minImportance");
  const minImportance = minImportanceParam
    ? Number(minImportanceParam) || undefined
    : undefined;

  const { items, total } = listAnalyses({ page, pageSize, minImportance });
  return NextResponse.json({ items, total, page, pageSize });
}
