import "server-only";
import { getServerConfig } from "../env";
import {
  GithubApiError,
  describeToken,
  githubGetJson,
} from "../github-api";
import { insertSnapshot, upsertRepo, type GithubRepoRow } from "./store";

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

/**
 * `owner/repo` must keep its slash — encoding it as `%2F` makes the API
 * answer 404. Validate the shape instead of escaping it.
 */
const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

function repoPath(fullName: string): string {
  if (!REPO_PATTERN.test(fullName)) {
    throw new GithubApiError(
      `Unexpected repository name: ${fullName.slice(0, 100)}`,
      "forbidden",
      null,
      null,
    );
  }
  return `/repos/${fullName}`;
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
  const fetchedAt = new Date().toISOString();
  const since = sinceDate(days);

  const seen = new Map<string, GithubRepoRow>();
  const warnings: string[] = [];
  let searched = 0;
  let rateLimited = false;

  for (const entry of TOPIC_QUERIES) {
    if (rateLimited) break;
    const path =
      `/search/repositories?q=${encodeURIComponent(`${entry.query} pushed:>${since}`)}` +
      `&sort=stars&order=desc&per_page=10`;

    let payload: { items?: Record<string, unknown>[] };
    try {
      payload = await githubGetJson<{ items?: Record<string, unknown>[] }>(path, {
        timeoutMs: config.requestTimeoutMs,
      });
      searched += 1;
    } catch (error) {
      if (error instanceof GithubApiError) {
        warnings.push(`${entry.topic}: ${error.message}`);
        if (
          error.kind === "primary-rate-limit" ||
          error.kind === "secondary-rate-limit" ||
          error.kind === "auth-failed"
        ) {
          rateLimited = true;
        }
        continue;
      }
      throw error;
    }

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
  if (repos.length === 0 && warnings.length > 0) {
    throw new GithubApiError(
      `GitHub trend collection failed: ${warnings[0]}`,
      "network",
      null,
      null,
    );
  }

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
      await githubGetJson(`${repoPath(repo.fullName)}/readme`, {
        timeoutMs: config.requestTimeoutMs,
      });
      hasReadme = true;
    } catch (error) {
      if (error instanceof GithubApiError && error.kind === "not-found") hasReadme = false;
      else if (error instanceof GithubApiError) warnings.push(`${repo.fullName} readme: ${error.message}`);
      else throw error;
    }

    try {
      const releases = await githubGetJson<unknown[]>(
        `${repoPath(repo.fullName)}/releases?per_page=1`,
        { timeoutMs: config.requestTimeoutMs },
      );
      hasReleases = Array.isArray(releases) && releases.length > 0;
    } catch (error) {
      if (error instanceof GithubApiError && error.kind === "not-found") hasReleases = false;
      else if (error instanceof GithubApiError) warnings.push(`${repo.fullName} releases: ${error.message}`);
      else throw error;
    }

    upsertRepo({ ...repo, hasReadme, hasReleases });
    detailedRepos += 1;
  }

  const auth = describeToken(config.githubToken);
  return {
    searched,
    reposDiscovered: repos.length,
    snapshotsTaken: repos.length,
    detailedRepos,
    note: [
      auth.configured
        ? `GitHub API（已认证，${auth.format}）`
        : "GitHub API 未认证：search 10 次/分钟、core 60 次/小时",
      warnings.length > 0 ? `；${warnings.length} 个请求未成功：${warnings[0]}` : "",
    ].join(""),
  };
}
