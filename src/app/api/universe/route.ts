import { NextResponse } from "next/server";
import { getUniverseReport } from "@/lib/server/universe";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(getUniverseReport(), { headers: { "cache-control": "no-store" } }); }
