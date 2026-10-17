import { NextRequest, NextResponse } from "next/server";
import {
  createKeyword,
  deleteKeyword,
  listKeywords,
} from "@/lib/server/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ keywords: listKeywords() });
}

export async function POST(request: NextRequest) {
  let body: { keyword?: string; topicId?: number | null } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const keyword = String(body.keyword ?? "").trim().slice(0, 60);
  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }
  const topicId = body.topicId ? Number(body.topicId) : null;
  const created = createKeyword(keyword, topicId);
  return NextResponse.json({ keyword: created });
}

export async function DELETE(request: NextRequest) {
  let body: { id?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  deleteKeyword(id);
  return NextResponse.json({ ok: true });
}
