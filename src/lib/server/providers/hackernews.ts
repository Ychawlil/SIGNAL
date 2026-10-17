import "server-only";
import { fetchWithRetry, RateLimiter } from "../http";
import { getServerConfig } from "../env";
import type { CategoryId } from "@/lib/types";
import type { ProviderResult, RawArticle } from "../types";

const HN_HOST = "hn.algolia.com";

/** Topic-anchored searches against the free Hacker News (Algolia) API. */
const QUERIES = [
  "artificial intelligence",
  "LLM",
  "robotics",
  "theorem proving",
  "AI agent",
];

function categoryFrom(text: string): CategoryId {
  const t = text.toLowerCase();
  if (/(robot|vla|embodied|humanoid)/.test(t)) return "physical-ai";
  if (/(theorem|math|formal|proof)/.test(t)) return "ai-math";
  if (/(compiler|database|kernel|inference|gpu|serving|systems)/.test(t)) return "ai-cs";
  if (/(agent|coding|copilot|programming)/.test(t)) return "agents-coding";
  if (/(open source|github|repository)/.test(t)) return "open-source";
  if (/(llm|gpt|model|transformer|deep learning|artificial intelligence)/.test(t)) {
    return "ai-research";
  }
  return "signals";
}

function validIso(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const hackernewsProvider = {
  id: "hackernews" as const,
  name: "Hacker News",

  async fetch(): Promise<ProviderResult> {
    const config = getServerConfig();
    const limiter = new RateLimiter(config.minRequestIntervalMs);
    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];
    const seen = new Set<string>();
    let itemsSeen = 0;

    for (const query of QUERIES) {
      const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
      url.searchParams.set("query", query);
      url.searchParams.set("tags", "story");
      url.searchParams.set("hitsPerPage", "20");

      const response = await fetchWithRetry(url.toString(), {
        allowHosts: [HN_HOST],
        timeoutMs: config.requestTimeoutMs,
        rateLimiter: limiter,
        retries: 2,
      });
      const payload = (await response.json()) as { hits?: Record<string, unknown>[] };

      for (const hit of payload.hits ?? []) {
        itemsSeen += 1;
        const objectId = String(hit.objectID ?? "");
        if (!objectId || seen.has(objectId)) continue;
        const title = String(hit.title ?? "").trim();
        if (!title) continue;

        const published = validIso(String(hit.created_at ?? ""));
        // Never substitute the fetch time for a missing content time.
        if (!published) continue;

        seen.add(objectId);
        const storyText = String(hit.story_text ?? "").trim();
        const rawUrl = String(hit.url ?? "");
        const url = /^https?:\/\//i.test(rawUrl)
          ? rawUrl
          : `https://news.ycombinator.com/item?id=${objectId}`;

        articles.push({
          provider: "hackernews",
          externalId: `hn:${objectId}`,
          title,
          summary: storyText || title,
          url,
          sourceName: "Hacker News",
          category: categoryFrom(`${title} ${storyText}`),
          publishedAt: published,
          fetchedAt,
          authors: [String(hit.author ?? "anonymous")],
          tags: ["hacker-news", query],
          metrics: {
            points: Number(hit.points ?? 0),
            comments: Number(hit.num_comments ?? 0),
          },
          raw: hit,
        });
      }
    }

    return { articles, itemsSeen, truncated: false };
  },

  healthCheck() {
    return {
      health: "ok" as const,
      message: "Hacker News search API (Algolia) — free, no key required.",
    };
  },
};
