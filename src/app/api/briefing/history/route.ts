import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { getBriefing } from "@/lib/server/analysis/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
 const date = request.nextUrl.searchParams.get("date");
 const dates = (getDb().prepare(`SELECT date FROM briefings ORDER BY date DESC`).all() as { date: string }[]).map((row) => row.date);
 if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) return NextResponse.json({ error: "日期格式无效" }, { status: 400 });
 const briefing = date ? getBriefing(date) : null;
 return NextResponse.json({ dates, briefing });
}
