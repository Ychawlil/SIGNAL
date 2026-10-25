import { NextResponse } from "next/server";
import { articleContext } from "@/lib/server/discovery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: "无效编号" }, { status: 400 });
 const context = articleContext(Number(id)); return context ? NextResponse.json(context) : NextResponse.json({ error: "情报不存在" }, { status: 404 });
}
