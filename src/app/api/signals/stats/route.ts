import { NextResponse } from "next/server";
import { signalStats } from "@/lib/server/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(signalStats());
}
