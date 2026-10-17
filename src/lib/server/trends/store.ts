import "server-only";
import { getDb } from "../db";

export interface GithubRepoRow {
  fullName: string;
  description: string;
  url: string;
  language: string | null;
  license: string | null;
  homepage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  createdAt: string | null;
  pushedAt: string | null;
  archived: boolean;
  isFork: boolean;
  hasReadme: boolean | null;
  hasReleases: boolean | null;
  lastFetchedAt: string;
}

export interface RepoSnapshotRow {
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
  sampledAt: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function upsertRepo(repo: GithubRepoRow): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO github_repos (
         full_name, description, url, language, license, homepage, topics,
         stars, forks, open_issues, watchers, created_at, pushed_at, archived,
         is_fork, has_readme, has_releases, last_fetched_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(full_name) DO UPDATE SET
         description = excluded.description,
         url = excluded.url,
         language = excluded.language,
         license = excluded.license,
         homepage = excluded.homepage,
         topics = excluded.topics,
         stars = excluded.stars,
         forks = excluded.forks,
         open_issues = excluded.open_issues,
         watchers = excluded.watchers,
         created_at = excluded.created_at,
         pushed_at = excluded.pushed_at,
         archived = excluded.archived,
         is_fork = excluded.is_fork,
         has_readme = COALESCE(excluded.has_readme, github_repos.has_readme),
         has_releases = COALESCE(excluded.has_releases, github_repos.has_releases),
         last_fetched_at = excluded.last_fetched_at`,
    )
    .run(
      repo.fullName,
      repo.description,
      repo.url,
      repo.language,
      repo.license,
      repo.homepage,
      JSON.stringify(repo.topics),
      repo.stars,
      repo.forks,
      repo.openIssues,
      repo.watchers,
      repo.createdAt,
      repo.pushedAt,
      repo.archived ? 1 : 0,
      repo.isFork ? 1 : 0,
      repo.hasReadme === null ? null : repo.hasReadme ? 1 : 0,
      repo.hasReleases === null ? null : repo.hasReleases ? 1 : 0,
      repo.lastFetchedAt,
    );
}

export function insertSnapshot(snapshot: RepoSnapshotRow): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO repo_snapshots (repo, stars, forks, open_issues, sampled_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      snapshot.repo,
      snapshot.stars,
      snapshot.forks,
      snapshot.openIssues,
      snapshot.sampledAt,
    );
}

export function listRepos(): GithubRepoRow[] {
  const database = getDb();
  const rows = database
    .prepare(`SELECT * FROM github_repos ORDER BY stars DESC`)
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    fullName: String(row.full_name),
    description: String(row.description),
    url: String(row.url),
    language: row.language ? String(row.language) : null,
    license: row.license ? String(row.license) : null,
    homepage: row.homepage ? String(row.homepage) : null,
    topics: parseJson(String(row.topics ?? "[]"), [] as string[]),
    stars: Number(row.stars),
    forks: Number(row.forks),
    openIssues: Number(row.open_issues),
    watchers: Number(row.watchers),
    createdAt: row.created_at ? String(row.created_at) : null,
    pushedAt: row.pushed_at ? String(row.pushed_at) : null,
    archived: Number(row.archived) === 1,
    isFork: Number(row.is_fork) === 1,
    hasReadme: row.has_readme === null ? null : Number(row.has_readme) === 1,
    hasReleases: row.has_releases === null ? null : Number(row.has_releases) === 1,
    lastFetchedAt: String(row.last_fetched_at),
  }));
}

export function listSnapshots(repo: string, limit = 100): RepoSnapshotRow[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT repo, stars, forks, open_issues, sampled_at
       FROM repo_snapshots WHERE repo = ? ORDER BY sampled_at ASC LIMIT ?`,
    )
    .all(repo, limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    repo: String(row.repo),
    stars: Number(row.stars),
    forks: Number(row.forks),
    openIssues: Number(row.open_issues),
    sampledAt: String(row.sampled_at),
  }));
}

export function repoSnapshotStats(): {
  repos: number;
  snapshots: number;
  oldest: string | null;
  latest: string | null;
} {
  const database = getDb();
  const repos = (database.prepare(`SELECT COUNT(*) AS c FROM github_repos`).get() as { c: number }).c;
  const snapshots = (database.prepare(`SELECT COUNT(*) AS c FROM repo_snapshots`).get() as { c: number }).c;
  const bounds = database
    .prepare(`SELECT MIN(sampled_at) AS oldest, MAX(sampled_at) AS latest FROM repo_snapshots`)
    .get() as { oldest: string | null; latest: string | null };
  return {
    repos: Number(repos),
    snapshots: Number(snapshots),
    oldest: bounds.oldest ? String(bounds.oldest) : null,
    latest: bounds.latest ? String(bounds.latest) : null,
  };
}
