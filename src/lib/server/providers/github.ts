import { fetchWithRetry, RateLimiter } from "../http";
import { getServerConfig } from "../env";
import type { CategoryId } from "@/lib/types";
import type { FetchContext, ProviderResult, RawArticle } from "../types";
import { stripTags } from "./base";

const GITHUB_API = "api.github.com";

/** Topic-anchored searches for discovering new repositories. */
const REPO_QUERIES = [
  "topic:vla",
  "topic:robot-learning",
  "topic:world-model",
  "topic:llm-reasoning",
  "topic:ai-agents",
  "topic:theorem-proving",
];

/** Curated repositories whose releases we track for content-publish signals. */
const TRACKED_RELEASES: { repo: string; category: CategoryId }[] = [
  { repo: "vllm-project/vllm", category: "ai-cs" },
  { repo: "huggingface/lerobot", category: "physical-ai" },
  { repo: "langchain-ai/langchain", category: "agents-coding" },
];

function categoryFromTopics(topics: string[]): CategoryId {
  const t = topics.map((s) => s.toLowerCase());
  const has = (x: string) => t.some((s) => s.includes(x));
  if (has("robot") || has("vla") || has("embodied") || has("lerobot")) {
    return "physical-ai";
  }
  if (has("theorem") || has("formal") || has("math") || has("lean")) {
    return "ai-math";
  }
  if (has("inference") || has("llm") || has("serving") || has("compiler") || has("database") || has("kernel")) {
    return "ai-cs";
  }
  if (has("agent")) return "agents-coding";
  if (has("reasoning") || has("transformer") || has("deep-learning") || has("machine-learning")) {
    return "ai-research";
  }
  return "open-source";
}

function dateString(iso: string | undefined, fallbackDays: number): string {
  const base = iso ? new Date(iso) : new Date(Date.now() - fallbackDays * 86400000);
  if (Number.isNaN(base.getTime())) {
    return new Date(Date.now() - fallbackDays * 86400000).toISOString().slice(0, 10);
  }
  return base.toISOString().slice(0, 10);
}

function buildHeaders(config: { githubToken?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }
  return headers;
}

async function getJson(
  path: string,
  headers: Record<string, string>,
  limiter: RateLimiter,
  timeoutMs: number,
): Promise<unknown> {
  const response = await fetchWithRetry(`https://${GITHUB_API}${path}`, {
    allowHosts: [GITHUB_API],
    timeoutMs,
    rateLimiter: limiter,
    retries: 3,
    headers,
  });
  return response.json();
}

function toIso(value: string | null | undefined): string {
  return value ?? new Date().toISOString();
}

export const githubProvider = {
  id: "github" as const,
  name: "GitHub",

  async fetch(ctx: FetchContext): Promise<ProviderResult> {
    const config = getServerConfig();
    const limiter = new RateLimiter(config.minRequestIntervalMs);
    const headers = buildHeaders(config);
    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];
    let itemsSeen = 0;

    const sinceDate = dateString(ctx.since, 14);

    for (const query of REPO_QUERIES) {
      const searchPath =
        `/search/repositories?q=${encodeURIComponent(`${query} created:>${sinceDate}`)}` +
        `&sort=stars&order=desc&per_page=5`;
      const payload = (await getJson(
        searchPath,
        headers,
        limiter,
        config.requestTimeoutMs,
      )) as { items?: Record<string, unknown>[] };

      const items = payload.items ?? [];
      itemsSeen += items.length;

      for (const item of items) {
        const fullName = String(item.full_name ?? "");
        const topics = (item.topics ?? []) as string[];
        const created = toIso(item.created_at as string | null);
        articles.push({
          provider: "github",
          externalId: `github-repo:${fullName}`,
          title: fullName,
          summary:
            (item.description as string | undefined)?.trim() ||
            `New repository on GitHub (${fullName}).`,
          url: String(item.html_url ?? `https://github.com/${fullName}`),
          sourceName: "GitHub",
          category: categoryFromTopics(topics),
          publishedAt: created,
          fetchedAt,
          authors: [],
          tags: topics,
          metrics: {
            stars: Number(item.stargazers_count ?? 0),
            forks: Number(item.forks_count ?? 0),
            openIssues: Number(item.open_issues_count ?? 0),
          },
          raw: item,
        });
      }
    }

    for (const tracked of TRACKED_RELEASES) {
      const releasesPath = `/repos/${tracked.repo}/releases?per_page=3`;
      const payload = (await getJson(
        releasesPath,
        headers,
        limiter,
        config.requestTimeoutMs,
      )) as Record<string, unknown>[];

      const releases = Array.isArray(payload) ? payload : [];
      itemsSeen += releases.length;

      for (const release of releases) {
        const tag = String(release.tag_name ?? "");
        const name = String(release.name ?? tag);
        const body = stripTags(String(release.body ?? "")).slice(0, 800);
        articles.push({
          provider: "github",
          externalId: `github-release:${tracked.repo}:${String(release.id)}`,
          title: `${tracked.repo} · ${name || tag}`,
          summary: body || `Release ${tag} for ${tracked.repo}.`,
          url: String(release.html_url ?? `https://github.com/${tracked.repo}/releases`),
          sourceName: "GitHub Release",
          category: tracked.category,
          publishedAt: toIso(release.published_at as string | null),
          fetchedAt,
          authors: [],
          tags: [tracked.repo, tag],
          raw: release,
        });
      }
    }

    return {
      articles,
      itemsSeen,
      truncated: false,
    };
  },

  healthCheck() {
    const config = getServerConfig();
    return config.githubToken
      ? {
          health: "ok" as const,
          message: "GitHub API with authenticated rate limits.",
        }
      : {
          health: "degraded" as const,
          message: "Unauthenticated GitHub API (60 requests/hour). Set GITHUB_TOKEN to raise limits.",
        };
  },
};
