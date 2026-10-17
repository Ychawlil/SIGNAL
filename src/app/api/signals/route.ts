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
  "world-models",
  "vla",
  "robot-learning",
  "ai-math",
  "ai-systems",
];
const VALID_SORTS = ["newest", "importance", "confidence"] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "20") || 20));
  const q = params.get("q") ?? undefined;
  const categoryParam = params.get("category");
  const topicParam = params.get("topic");
  const source = params.get("source") ?? undefined;
  const providerParam = params.get("provider");
  const sortParam = params.get("sort") ?? "newest";

  const category =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as CategoryId)
      ? (categoryParam as CategoryId)
      : undefined;
  const topic =
    topicParam && VALID_TOPICS.includes(topicParam as TopicId)
      ? (topicParam as TopicId)
      : undefined;
  const provider =
    providerParam && VALID_PROVIDERS.includes(providerParam as ProviderId)
      ? (providerParam as ProviderId)
      : undefined;
  const sort = VALID_SORTS.includes(sortParam as (typeof VALID_SORTS)[number])
    ? (sortParam as (typeof VALID_SORTS)[number])
    : "newest";

  const { items, total } = listSignals({
    page,
    pageSize,
    q,
    category,
    topic,
    source,
    provider,
    sort,
  });

  return NextResponse.json({ items, total, page, pageSize });
}
