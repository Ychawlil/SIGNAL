import { NextResponse } from "next/server";
import { listSignals } from "@/lib/server/signals";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: "无效的情报编号" }, { status: 400 });
  const item = listSignals({ ids: [Number(id)], page: 1, pageSize: 1 }).items[0];
  return item ? NextResponse.json(item) : NextResponse.json({ error: "情报不存在" }, { status: 404 });
}
