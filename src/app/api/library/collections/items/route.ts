import { NextRequest, NextResponse } from "next/server";
import {
  addCollectionItem,
  listCollectionItems,
  removeCollectionItem,
} from "@/lib/server/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const collectionId = Number(request.nextUrl.searchParams.get("collectionId") ?? "0");
  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
  }
  return NextResponse.json({ items: listCollectionItems(collectionId) });
}

export async function POST(request: NextRequest) {
  let body: { collectionId?: number; articleId?: number; note?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const collectionId = Number(body.collectionId);
  const articleId = Number(body.articleId);
  if (!Number.isInteger(collectionId) || collectionId <= 0 || !Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "collectionId and articleId are required" }, { status: 400 });
  }
  addCollectionItem(collectionId, articleId, String(body.note ?? "").slice(0, 2000));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  let body: { collectionId?: number; articleId?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const collectionId = Number(body.collectionId);
  const articleId = Number(body.articleId);
  if (!Number.isInteger(collectionId) || collectionId <= 0 || !Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "collectionId and articleId are required" }, { status: 400 });
  }
  removeCollectionItem(collectionId, articleId);
  return NextResponse.json({ ok: true });
}
