import { NextRequest, NextResponse } from "next/server";
import {
  createTopic,
  deleteTopic,
  listTopics,
} from "@/lib/server/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ topics: listTopics() });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; description?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const topic = createTopic(name, String(body.description ?? "").slice(0, 300));
  return NextResponse.json({ topic });
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
  deleteTopic(id);
  return NextResponse.json({ ok: true });
}
