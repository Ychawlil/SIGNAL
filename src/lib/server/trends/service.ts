import "server-only";
import { getDb } from "../db";
import { isProviderEnabled } from "../env";
import {
  computeRepoMetrics,
  compositeScore,
  evidenceQualityScore,
} from "./scoring";
import { listRepos, listSnapshots, repoSnapshotStats } from "./store";
import type { GithubRepoRow } from "./store";
import type {
  EarlySignal,
  EmergingTopic,
  ReleaseSignal,
  ResearcherSignal,
  RisingRepo,
  TrendCoverage,
  TrendRange,
  TrendSource,
  TrendTopic,
  TrendsReport,
} from "./types";

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface ArticleRow {
  id: number;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  category: string;
  publishedAt: string;
  authors: string[];
  tags: string[];
  importanceScore: number | null;
  evidenceBasis: string | null;
}

function listArticles(where: string, params: (string | number)[], limit: number): ArticleRow[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT a.id, a.title, a.summary, a.url, a.source_name, a.category,
              a.published_at, a.authors, a.tags,
              an.importance_score, an.evidence_basis
       FROM articles a
       LEFT JOIN analyses an ON an.article_id = a.id
       ${where}
       ORDER BY a.published_at DESC
       LIMIT ?`,
    )
    .all(...params, limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    summary: String(row.summary),
    url: String(row.url),
    sourceName: String(row.source_name),
    category: String(row.category),
    publishedAt: String(row.published_at),
    authors: parseJson(String(row.authors ?? "[]"), [] as string[]),
    tags: parseJson(String(row.tags ?? "[]"), [] as string[]),
    importanceScore: row.importance_score === null ? null : Number(row.importance_score),
    evidenceBasis: row.evidence_basis ? String(row.evidence_basis) : null,
  }));
}

function topicMatches(repo: GithubRepoRow, topic: TrendTopic): boolean {
  if (topic === "all") return true;
  const topics = repo.topics.map((t) => t.toLowerCase());
  const text = `${repo.description} ${topics.join(" ")}`.toLowerCase();
  return topics.includes(topic) || text.includes(topic);
}

function releaseRelevance(family: string): number {
  const t = family.toLowerCase();
  if (/(robot|vla|world|embodied)/.test(t)) return 90;
  if (/(llm|agent|coding)/.test(t)) return 85;
  if (/(theorem|formal|math)/.test(t)) return 90;
  if (/inference|serving|vllm|sglang/.test(t)) return 80;
  return 60;
}

function buildRisingRepos(rangeDays: number, topic: TrendTopic): RisingRepo[] {
  const repos = listRepos().filter((repo) => topicMatches(repo, topic));
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString();

  return repos
    .map((repo) => {
      const snapshots = listSnapshots(repo.fullName).filter(
        (s) => s.sampledAt >= since,
      );
      const { metrics, momentum } = computeRepoMetrics(repo, snapshots);
      const composite = compositeScore(metrics, momentum);
      return {
        fullName: repo.fullName,
        url: repo.url,
        description: repo.description,
        language: repo.language,
        license: repo.license,
        homepage: repo.homepage,
        topics: repo.topics,
        stars: repo.stars,
        forks: repo.forks,
        openIssues: repo.openIssues,
        hasReadme: repo.hasReadme,
        hasReleases: repo.hasReleases,
        pushedAt: repo.pushedAt,
        metrics,
        momentumDetail: momentum,
        compositeScore: composite.score,
        compositeRationale: composite.rationale,
      };
    })
    .sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
}

function buildReleases(): ReleaseSignal[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT mv.family, mv.version, mv.license, mv.open_weights, mv.benchmarks,
              mv.eval_note, mv.claim_origin, a.id, a.title, a.url, a.category,
              a.source_name, a.published_at
       FROM model_versions mv
       JOIN articles a ON a.id = mv.source_article_id
       ORDER BY a.published_at DESC
       LIMIT 30`,
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => {
    const benchmarks = parseJson(String(row.benchmarks ?? "[]"), [] as string[]);
    const license = row.license ? String(row.license) : null;
    const openWeights = row.open_weights === null ? null : Number(row.open_weights) === 1;
    const claimOrigin = String(row.claim_origin);

    let evidence = 0;
    if (benchmarks.length > 0) evidence += 40;
    if (license) evidence += 20;
    evidence += claimOrigin === "independent" ? 20 : 10;
    if (String(row.eval_note).length > 0) evidence += 10;

    return {
      id: Number(row.id),
      title: String(row.title),
      url: String(row.url),
      category: String(row.category),
      sourceName: String(row.source_name),
      publishedAt: String(row.published_at),
      license,
      openWeights,
      benchmarks,
      evalNote: String(row.eval_note),
      claimOrigin,
      relevance: releaseRelevance(String(row.family)),
      evidenceQuality: Math.min(100, evidence),
    };
  });
}

function buildResearcherSignals(rangeDays: number): ResearcherSignal[] {
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString();
  return listArticles("WHERE a.provider IN ('arxiv','arxiv-rss') AND a.published_at >= ?", [since], 20).map(
    (article) => ({
      id: article.id,
      title: article.title,
      url: article.url,
      authors: article.authors,
      category: article.category,
      publishedAt: article.publishedAt,
      summary: article.summary.slice(0, 240),
    }),
  );
}

function buildEmergingTopics(rangeDays: number): EmergingTopic[] {
  const now = Date.now();
  const currentStart = new Date(now - rangeDays * 86400000).toISOString();
  const previousStart = new Date(now - 2 * rangeDays * 86400000).toISOString();

  const current = listArticles(
    "WHERE a.published_at >= ? AND a.published_at < ?",
    [currentStart, new Date(now).toISOString()],
    2000,
  );
  const previous = listArticles(
    "WHERE a.published_at >= ? AND a.published_at < ?",
    [previousStart, currentStart],
    2000,
  );

  const countByTopic = (articles: ArticleRow[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      const keys = new Set<string>([article.category, ...article.tags.map((t) => t.toLowerCase())]);
      for (const key of keys) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  };

  const currentCounts = countByTopic(current);
  const previousCounts = countByTopic(previous);

  const all = new Set<string>([...currentCounts.keys(), ...previousCounts.keys()]);
  const emerging: EmergingTopic[] = [];
  for (const topic of all) {
    const count = currentCounts.get(topic) ?? 0;
    const previousCount = previousCounts.get(topic) ?? 0;
    if (count === 0) continue;

    let growth: number | null;
    let note: string;
    if (previousCount === 0) {
      growth = null;
      note = "上一时间窗口无记录，无法计算增长率，仅记录出现次数。";
    } else {
      growth = Math.round(((count - previousCount) / previousCount) * 100);
      note = `较上一窗口 ${growth >= 0 ? "+" : ""}${growth}%。`;
    }

    emerging.push({
      topic,
      count,
      previousCount: previousCount === 0 ? null : previousCount,
      growth,
      windowDays: rangeDays,
      note,
    });
  }

  return emerging
    .sort((a, b) => (b.growth ?? -1) - (a.growth ?? -1) || b.count - a.count)
    .slice(0, 15);
}

function buildEarlySignals(rangeDays: number): EarlySignal[] {
  const signals: EarlySignal[] = [];

  // Repos: high popularity but thin documentation/evidence.
  for (const repo of listRepos()) {
    const evidence = evidenceQualityScore(repo);
    if (repo.stars >= 500 && evidence < 40) {
      signals.push({
        kind: "repo",
        id: repo.fullName,
        title: repo.fullName,
        url: repo.url,
        reason: "高热度（star 多）但 README/许可证/Release 等证据不足，需进一步验证。",
        popularity: repo.stars,
        evidenceQuality: evidence,
      });
    }
  }

  // Articles: high importance but low/unverified evidence.
  const since = new Date(Date.now() - rangeDays * 86400000).toISOString();
  for (const article of listArticles("WHERE a.published_at >= ?", [since], 500)) {
    if (
      article.importanceScore !== null &&
      article.importanceScore >= 70 &&
      (article.evidenceBasis === "none" || article.evidenceBasis === "vendor")
    ) {
      signals.push({
        kind: "article",
        id: String(article.id),
        title: article.title,
        url: article.url,
        reason: "重要性高但可信度低 / 证据为厂商自述，需要独立复现后再判断。",
        popularity: null,
        evidenceQuality: null,
      });
    }
  }

  return signals.slice(0, 12);
}

export function buildTrends(filters: {
  range: TrendRange;
  topic: TrendTopic;
  source: TrendSource;
}): TrendsReport {
  const rangeDays = filters.range === "7d" ? 7 : 30;
  const githubCollectionEnabled = isProviderEnabled("github");
  const papersCollectionEnabled =
    isProviderEnabled("arxiv") || isProviderEnabled("arxiv-rss");

  // Paused collection does not hide historical snapshots — it only means the
  // numbers are stale, which `coverage.github.note` and the UI make explicit.
  const includeGithub = filters.source !== "arxiv";
  const includeArxiv = filters.source !== "github";

  const snapshots = repoSnapshotStats();

  const paperStats = getDb()
    .prepare(
      `SELECT COUNT(*) AS c, MAX(published_at) AS latest
       FROM articles WHERE provider IN ('arxiv','arxiv-rss')`,
    )
    .get() as { c: number; latest: string | null };

  const coverage: TrendCoverage = {
    sampledAt: new Date().toISOString(),
    github: {
      available: githubCollectionEnabled,
      collectionEnabled: githubCollectionEnabled,
      reposTracked: snapshots.repos,
      snapshots: snapshots.snapshots,
      oldestSnapshotAt: snapshots.oldest,
      latestSnapshotAt: snapshots.latest,
      note: !githubCollectionEnabled
        ? snapshots.snapshots === 0
          ? "GitHub 自动采集已暂停，且没有历史快照。"
          : "GitHub 自动采集已暂停：以下仓库指标来自历史快照，不是实时数据。"
        : snapshots.snapshots === 0
          ? "尚无仓库快照，点击「Collect data」采集。"
          : "Star 增长率仅在存在两次以上历史快照、且跨度 ≥24 小时时计算。",
    },
    arxiv: {
      available: papersCollectionEnabled,
      collectionEnabled: papersCollectionEnabled,
      articles: Number(paperStats.c),
      latestArticleAt: paperStats.latest ? String(paperStats.latest) : null,
    },
  };

  const report: TrendsReport = {
    coverage,
    risingRepos: includeGithub ? buildRisingRepos(rangeDays, filters.topic) : [],
    releases: buildReleases(),
    researcherSignals: includeArxiv
      ? buildResearcherSignals(rangeDays)
      : [],
    emergingTopics: buildEmergingTopics(rangeDays),
    earlySignals: includeGithub ? buildEarlySignals(rangeDays) : [],
    scoringExplanation:
      "五个指标独立计算并展示：Popularity（当前热度，对数化 star）、Momentum（仅在有 ≥2 次快照且跨度 ≥24 小时时计算增长率）、Technical Merit（代码/文档/发布/复现）、Evidence Quality（README/许可证/Release/演示）、Relevance（与关注方向相关性）。综合排序为加权求和（权重在每条理由中说明），momentum 缺失时其权重并入证据与技术价值，不做猜测。采集暂停时仅展示历史快照，不据此推断当前趋势。",
    filters,
  };

  return report;
}
