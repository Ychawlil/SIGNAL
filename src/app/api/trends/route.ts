import { NextRequest, NextResponse } from "next/server";
import { buildTrends } from "@/lib/server/trends/service";
import type { TrendRange, TrendSource, TrendTopic } from "@/lib/server/trends/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: TrendRange[] = ["7d", "30d"];
const SOURCES: TrendSource[] = ["github", "arxiv", "all"];
const TOPICS: TrendTopic[] = [
  "all",
  "vla",
  "robot-learning",
  "world-model",
  "llm",
  "ai-agents",
  "ai-coding",
  "theorem-proving",
  "llm-inference",
];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range") ?? "7d";
  const sourceParam = params.get("source") ?? "all";
  const topicParam = params.get("topic") ?? "all";

  const range = RANGES.includes(rangeParam as TrendRange)
    ? (rangeParam as TrendRange)
    : "7d";
  const source = SOURCES.includes(sourceParam as TrendSource)
    ? (sourceParam as TrendSource)
    : "all";
  const topic = TOPICS.includes(topicParam as TrendTopic)
    ? (topicParam as TrendTopic)
    : "all";

  return NextResponse.json(buildTrends({ range, topic, source }));
}
