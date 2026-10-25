import { NextRequest, NextResponse } from "next/server";
import {
  getArticleWithAnalysis,
  listSavedItems,
  saveItem,
  unsaveItem,
  updateItem,
} from "@/lib/server/library/store";
import type { SaveStatus } from "@/lib/server/library/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: SaveStatus[] = ["later", "read", "reproduce"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? undefined;
  const statusParam = params.get("status") ?? "all";
  const topicId = Number(params.get("topicId") ?? "0") || undefined;
  const tag = params.get("tag") ?? undefined;

  const status =
    statusParam === "all" || STATUSES.includes(statusParam as SaveStatus)
      ? (statusParam as SaveStatus | "all")
      : "all";

  const items = listSavedItems({ q, status, topicId, tag });
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: NextRequest) {
  let body: { articleId?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const articleId = Number(body.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "请提供有效的情报编号" }, { status: 400 });
  }
  if (!getArticleWithAnalysis(articleId)) return NextResponse.json({ error: "情报不存在，无法收藏" }, { status: 404 });
  saveItem(articleId);
  return NextResponse.json({ ok: true, articleId });
}

export async function DELETE(request: NextRequest) {
  let body: { articleId?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const articleId = Number(body.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "请提供有效的情报编号" }, { status: 400 });
  }
  unsaveItem(articleId);
  return NextResponse.json({ ok: true, articleId });
}

export async function PATCH(request: NextRequest) {
  let body: { articleId?: number; status?: SaveStatus | null; notes?: string; tags?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const articleId = Number(body.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "请提供有效的情报编号" }, { status: 400 });
  }

  const patch: { status?: SaveStatus | null; notes?: string; tags?: string[] } = {};
  if (body.status !== undefined) {
    if (body.status === null || STATUSES.includes(body.status)) {
      patch.status = body.status;
    } else {
      return NextResponse.json({ error: "阅读状态无效" }, { status: 400 });
    }
  }
  if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 20000);
  if (body.tags !== undefined) {
    patch.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20)
      : [];
  }

  updateItem(articleId, patch);
  return NextResponse.json({ ok: true, articleId });
}
