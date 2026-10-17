import { NextRequest, NextResponse } from "next/server";
import {
  createCollection,
  deleteCollection,
  listCollections,
} from "@/lib/server/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ collections: listCollections() });
}

export async function POST(request: NextRequest) {
  let body: { title?: string; description?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const collection = createCollection(title, String(body.description ?? "").slice(0, 500));
  return NextResponse.json({ collection });
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
  deleteCollection(id);
  return NextResponse.json({ ok: true });
}
