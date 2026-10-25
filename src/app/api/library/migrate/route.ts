import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/server/auth";
import { parsePersonalBackup } from "@/lib/backup";
import { migrateFavorites } from "@/lib/server/library/migrate";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const denied = guard(request); if (denied) return denied;
  let library;
  try { library = parsePersonalBackup({ format: "signal-personal", version: 1, library: await request.json() }).library; }
  catch { return NextResponse.json({ error: "收藏数据格式无效" }, { status: 400 }); }
  return NextResponse.json({ ok: true, migrated: migrateFavorites(library) });
}
