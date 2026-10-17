import { NextRequest, NextResponse } from "next/server";
import { queryArticles } from "@/lib/server/db";
import type { ProviderId } from "@/lib/server/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ProviderId[] = ["arxiv", "arxiv-rss", "github", "hackernews", "rss"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "20") || 20));
  const providerParam = params.get("provider");
  const category = params.get("category") ?? undefined;
  const q = params.get("q") ?? undefined;

  const provider =
    providerParam && VALID_PROVIDERS.includes(providerParam as ProviderId)
      ? (providerParam as ProviderId)
      : undefined;

  const { articles, total } = queryArticles({
    page,
    pageSize,
    provider,
    category,
    q,
  });

  return NextResponse.json({ articles, total, page, pageSize });
}
