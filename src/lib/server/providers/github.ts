import { getServerConfig } from "../env";
import type { CategoryId } from "@/lib/types";
import type { FetchContext, ProviderResult, RawArticle } from "../types";
import { stripTags } from "./base";
import { GithubApiError, describeToken, githubGetJson } from "../github-api";

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

function toIso(value: string | null | undefined): string {
  return value ?? new Date().toISOString();
}

export const githubProvider = {
  id: "github" as const,
  name: "GitHub",

  async fetch(ctx: FetchContext): Promise<ProviderResult> {
    const config = getServerConfig();
    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];
    const warnings: string[] = [];
    let itemsSeen = 0;

    const sinceDate = dateString(ctx.since, 14);

    for (const query of REPO_QUERIES) {
      const searchPath =
        `/search/repositories?q=${encodeURIComponent(`${query} created:>${sinceDate}`)}` +
        `&sort=stars&order=desc&per_page=5`;

      let payload: { items?: Record<string, unknown>[] };
      try {
        payload = await githubGetJson<{ items?: Record<string, unknown>[] }>(
          searchPath,
          { timeoutMs: config.requestTimeoutMs },
        );
      } catch (error) {
        if (error instanceof GithubApiError) {
          // A rate limit means the remaining queries will fail too — stop now
          // and keep whatever was already collected.
          if (
            error.kind === "primary-rate-limit" ||
            error.kind === "secondary-rate-limit" ||
            error.kind === "auth-failed"
          ) {
            if (articles.length === 0) throw error;
            warnings.push(`${query}: ${error.message}`);
            break;
          }
          warnings.push(`${query}: ${error.message}`);
          continue;
        }
        throw error;
      }

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
      let payload: Record<string, unknown>[];
      try {
        payload = await githubGetJson<Record<string, unknown>[]>(releasesPath, {
          timeoutMs: config.requestTimeoutMs,
        });
      } catch (error) {
        if (error instanceof GithubApiError) {
          warnings.push(`${tracked.repo}: ${error.message}`);
          if (error.kind === "primary-rate-limit" || error.kind === "auth-failed") {
            break;
          }
          continue;
        }
        throw error;
      }

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

    if (articles.length === 0 && warnings.length > 0) {
      throw new GithubApiError(
        `GitHub collection failed: ${warnings[0]}`,
        "network",
        null,
        null,
      );
    }

    return {
      articles,
      itemsSeen,
      truncated: false,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  healthCheck() {
    const config = getServerConfig();
    const token = describeToken(config.githubToken);
    if (!token.configured) {
      return {
        health: "degraded" as const,
        message:
          "GITHUB_TOKEN 未配置：匿名额度仅 60 次/小时（搜索 10 次/分钟），采集容易触发 403。",
      };
    }
    return {
      health: "ok" as const,
      message: `已加载 GITHUB_TOKEN（${token.format}，${token.length} 字符）；认证后 core 5000 次/小时、search 30 次/分钟。`,
    };
  },
};
