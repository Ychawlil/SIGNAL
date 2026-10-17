import "server-only";
import { getServerConfig } from "../env";
import { fetchWithRetry, HttpError, RateLimiter } from "../http";
import { insertSnapshot, upsertRepo, type GithubRepoRow } from "./store";

const GITHUB_API = "api.github.com";

/** Focus areas → GitHub topic searches (recently active, by stars). */
const TOPIC_QUERIES: { topic: string; query: string }[] = [
  { topic: "vla", query: "topic:vla" },
  { topic: "robot-learning", query: "topic:robot-learning" },
  { topic: "world-model", query: "topic:world-model" },
  { topic: "llm", query: "topic:llm" },
  { topic: "ai-agents", query: "topic:ai-agents" },
  { topic: "ai-coding", query: "topic:ai-coding" },
  { topic: "theorem-proving", query: "topic:theorem-proving" },
  { topic: "llm-inference", query: "topic:llm-inference" },
];

/** Detail-fetch budget: only the top repos by stars get README/release checks. */
const DETAIL_BUDGET = 8;

function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function buildHeaders(config: { githubToken?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
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

export interface CollectSummary {
  searched: number;
  reposDiscovered: number;
  snapshotsTaken: number;
  detailedRepos: number;
  note: string;
}

export async function collectGithubTrends(days = 30): Promise<CollectSummary> {
  const config = getServerConfig();
  const limiter = new RateLimiter(config.minRequestIntervalMs);
  const headers = buildHeaders(config);
  const fetchedAt = new Date().toISOString();
  const since = sinceDate(days);

  const seen = new Map<string, GithubRepoRow>();
  let searched = 0;

  for (const entry of TOPIC_QUERIES) {
    const path =
      `/search/repositories?q=${encodeURIComponent(`${entry.query} pushed:>${since}`)}` +
      `&sort=stars&order=desc&per_page=10`;
    const payload = (await getJson(path, headers, limiter, config.requestTimeoutMs)) as {
      items?: Record<string, unknown>[];
    };
    searched += 1;

    for (const item of payload.items ?? []) {
      const fullName = String(item.full_name ?? "");
      if (!fullName || seen.has(fullName)) continue;
      seen.set(fullName, {
        fullName,
        description: String(item.description ?? ""),
        url: String(item.html_url ?? `https://github.com/${fullName}`),
        language: item.language ? String(item.language) : null,
        license:
          (item.license as { spdx_id?: string } | null)?.spdx_id ?? null,
        homepage: item.homepage ? String(item.homepage) : null,
        topics: (item.topics ?? []) as string[],
        stars: Number(item.stargazers_count ?? 0),
        forks: Number(item.forks_count ?? 0),
        openIssues: Number(item.open_issues_count ?? 0),
        watchers: Number(item.watchers_count ?? 0),
        createdAt: item.created_at ? String(item.created_at) : null,
        pushedAt: item.pushed_at ? String(item.pushed_at) : null,
        archived: Boolean(item.archived),
        isFork: Boolean(item.fork),
        hasReadme: null,
        hasReleases: null,
        lastFetchedAt: fetchedAt,
      });
    }
  }

  const repos = [...seen.values()];
  for (const repo of repos) {
    upsertRepo(repo);
    insertSnapshot({
      repo: repo.fullName,
      stars: repo.stars,
      forks: repo.forks,
      openIssues: repo.openIssues,
      sampledAt: fetchedAt,
    });
  }

  // Detail-fetch (README / releases) for the top repos by stars.
  const top = [...repos].sort((a, b) => b.stars - a.stars).slice(0, DETAIL_BUDGET);
  let detailedRepos = 0;
  for (const repo of top) {
    let hasReadme: boolean | null = null;
    let hasReleases: boolean | null = null;

    try {
      await getJson(
        `/repos/${encodeURIComponent(repo.fullName)}/readme`,
        headers,
        limiter,
        config.requestTimeoutMs,
      );
      hasReadme = true;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) hasReadme = false;
      else throw error;
    }

    try {
      const releases = (await getJson(
        `/repos/${encodeURIComponent(repo.fullName)}/releases?per_page=1`,
        headers,
        limiter,
        config.requestTimeoutMs,
      )) as unknown[];
      hasReleases = Array.isArray(releases) && releases.length > 0;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) hasReleases = false;
      else throw error;
    }

    upsertRepo({ ...repo, hasReadme, hasReleases });
    detailedRepos += 1;
  }

  return {
    searched,
    reposDiscovered: repos.length,
    snapshotsTaken: repos.length,
    detailedRepos,
    note:
      config.githubToken
        ? "GitHub API (authenticated)."
        : "GitHub API unauthenticated: search 10 req/min, core 60 req/hour.",
  };
}
