import { getPlanet } from "@/lib/universe/planets";
import { NextRequest, NextResponse } from "next/server";
import { listSignals } from "@/lib/server/signals";
import type { ProviderId } from "@/lib/server/types";
import type { CategoryId, TopicId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ProviderId[] = ["arxiv", "arxiv-rss", "github", "hackernews", "rss"];
const VALID_CATEGORIES: CategoryId[] = [
  "ai-models",
  "ai-research",
  "ai-math",
  "ai-cs",
  "physical-ai",
  "agents-coding",
  "open-source",
  "signals",
  "other-science",
];
const VALID_TOPICS: TopicId[] = [
  "llm-reasoning",
  "ai-coding",
  "ai-agents",
  "physical-ai",
  "ai-math",
  "ai-systems",
];
const VALID_SORTS = ["newest", "importance"] as const;

/** Retired topic ids, mapped to the topic that absorbed them. */
const LEGACY_TOPICS: Record<string, TopicId> = {
  vla: "physical-ai",
  "robot-learning": "physical-ai",
  "world-models": "physical-ai",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  for (const key of ["ids", "excludeIds"]) { if ((params.get(key) ?? "").split(",").length > 10000) return NextResponse.json({ error: "筛选条目过多，请缩小范围" }, { status: 400 }); }
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "20") || 20));
  const q = params.get("q") ?? undefined;
  const categoryParam = params.get("category");
  const topicParam = params.get("topic");
  const normalizedTopic = topicParam
    ? (LEGACY_TOPICS[topicParam] ?? topicParam)
    : null;
  const source = params.get("source") ?? undefined;
  const providerParam = params.get("provider");
  const sortParam = params.get("sort") ?? "newest";

  const category =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as CategoryId)
      ? (categoryParam as CategoryId)
      : undefined;
  const topic =
    normalizedTopic && VALID_TOPICS.includes(normalizedTopic as TopicId)
      ? (normalizedTopic as TopicId)
      : undefined;
  const provider =
    providerParam && VALID_PROVIDERS.includes(providerParam as ProviderId)
      ? (providerParam as ProviderId)
      : undefined;
  const sort = VALID_SORTS.includes(sortParam as (typeof VALID_SORTS)[number])
    ? (sortParam as (typeof VALID_SORTS)[number])
    : "newest";

  const { items, total } = listSignals({
    excludeIds: (params.get("excludeIds") ?? "").split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 10000),
    ids: params.has("ids") ? (params.get("ids") ?? "").split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 10000) : undefined,
    page,
    pageSize,
    q,
    categories: getPlanet(params.get("planet"))?.categories,
    category,
    topic,
    source,
    provider,
    sort,
  });

  return NextResponse.json({ items, total, page, pageSize });
}
