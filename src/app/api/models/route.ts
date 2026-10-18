import { NextResponse } from "next/server";
import { ensureBaselineAnalysis, getModelRegistry } from "@/lib/server/analysis/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Baseline only: the model registry is a read view and must not trigger
  // paid analysis just because the page was opened.
  ensureBaselineAnalysis();
  return NextResponse.json({ families: getModelRegistry() });
}
