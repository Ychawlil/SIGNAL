import { NextResponse } from "next/server";
import { ensureAnalysis, getModelRegistry } from "@/lib/server/analysis/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAnalysis();
  return NextResponse.json({ families: getModelRegistry() });
}
