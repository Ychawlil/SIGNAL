import { NextResponse } from "next/server";
import { getSourceOverview } from "@/lib/server/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSourceOverview());
}
