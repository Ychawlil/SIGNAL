import { NextRequest, NextResponse } from "next/server";
import { libraryUpdates, markUpdatesSeen } from "@/lib/server/discovery";
import { guard } from "@/lib/server/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ updates: libraryUpdates() }); }
export async function POST(request: NextRequest) { const denied = guard(request); if (denied) return denied; const body = await request.json().catch(() => ({})); if (!Number.isSafeInteger(body.articleId) || body.articleId <= 0) return NextResponse.json({ error: "无效编号" }, { status: 400 }); markUpdatesSeen(body.articleId); return NextResponse.json({ ok: true }); }
