import "server-only";
import type { GithubRepoRow, RepoSnapshotRow } from "./store";
import type { MomentumDetail, RepoMetrics } from "./types";

const FOCUS_TOPICS = [
  "vla",
  "robot-learning",
  "world-model",
  "llm",
  "ai-agents",
  "ai-coding",
  "theorem-proving",
  "llm-inference",
  "robotics",
  "embodied-ai",
  "reinforcement-learning",
  "mathematics",
  "formal-verification",
];

const RELEVANT_LANGUAGES = [
  "python",
  "rust",
  "c++",
  "c",
  "cuda",
  "julia",
  "go",
];

export function popularityScore(stars: number): number {
  if (stars <= 0) return 0;
  return Math.min(100, Math.round(20 * Math.log10(stars + 1)));
}

export function relevanceScore(repo: GithubRepoRow): number {
  const topics = repo.topics.map((t) => t.toLowerCase());
  const text = `${repo.description} ${topics.join(" ")}`.toLowerCase();

  let score = 40;
  if (topics.some((t) => FOCUS_TOPICS.includes(t))) score += 30;
  if (/(robot|vla|embodied|world model)/.test(text)) score += 10;
  if (/(llm|reasoning|agent|coding)/.test(text)) score += 10;
  if (/(theorem|formal|math)/.test(text)) score += 10;
  return Math.min(100, score);
}

export function technicalMeritScore(repo: GithubRepoRow): number {
  let score = 0;
  if (repo.hasReadme === true) score += 20;
  if (repo.license) score += 10;
  if (repo.hasReleases === true) score += 15;
  if (repo.description.length >= 60) score += 10;
  if (!repo.isFork) score += 10;
  if (!repo.archived) score += 5;
  if (repo.language && RELEVANT_LANGUAGES.includes(repo.language.toLowerCase())) score += 15;
  if (repo.homepage) score += 15;
  return Math.min(100, score);
}

export function evidenceQualityScore(repo: GithubRepoRow): number {
  let score = 0;
  if (repo.hasReadme === true) score += 30;
  if (repo.license) score += 20;
  if (repo.hasReleases === true) score += 20;
  if (repo.homepage) score += 15;
  if (repo.topics.length > 0) score += 15;
  return Math.min(100, score);
}

export function momentumDetail(
  snapshots: RepoSnapshotRow[],
): MomentumDetail {
  if (snapshots.length < 2) {
    return {
      available: false,
      snapshots: snapshots.length,
      spanDays: null,
      growthStars: null,
      ratePerDay: null,
      note: "需要至少两次历史快照才能计算增长率，不做单次查询推测。",
    };
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.sampledAt).getTime() - new Date(b.sampledAt).getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanMs = new Date(last.sampledAt).getTime() - new Date(first.sampledAt).getTime();
  const spanDays = spanMs / 86400000;
  const growthStars = last.stars - first.stars;

  if (spanDays < 1 / 24) {
    return {
      available: false,
      snapshots: sorted.length,
      spanDays,
      growthStars,
      ratePerDay: null,
      note: "快照间隔过短，暂不计算增长率。",
    };
  }

  return {
    available: true,
    snapshots: sorted.length,
    spanDays,
    growthStars,
    ratePerDay: growthStars / spanDays,
    note: `基于 ${sorted.length} 次快照、跨度 ${spanDays.toFixed(1)} 天。`,
  };
}

function momentumScore(detail: MomentumDetail): number | null {
  if (!detail.available || detail.ratePerDay === null) return null;
  const rate = detail.ratePerDay;
  if (rate <= 0) return 0;
  return Math.min(100, Math.round(30 * Math.log10(rate + 1)));
}

export function computeRepoMetrics(
  repo: GithubRepoRow,
  snapshots: RepoSnapshotRow[],
): { metrics: RepoMetrics; momentum: MomentumDetail } {
  const momentum = momentumDetail(snapshots);
  return {
    momentum,
    metrics: {
      popularity: popularityScore(repo.stars),
      momentum: momentumScore(momentum),
      technicalMerit: technicalMeritScore(repo),
      evidenceQuality: evidenceQualityScore(repo),
      relevance: relevanceScore(repo),
    },
  };
}

export interface CompositeResult {
  score: number | null;
  rationale: string;
}

/**
 * Transparent composite ranking. When momentum is unknown (single snapshot),
 * its weight is redistributed to relevance/evidence instead of guessing.
 */
export function compositeScore(
  metrics: RepoMetrics,
  momentum: MomentumDetail,
): CompositeResult {
  const weights = {
    relevance: 0.25,
    evidenceQuality: 0.25,
    technicalMerit: 0.2,
    popularity: 0.2,
    momentum: 0.1,
  };

  if (metrics.momentum === null) {
    const total =
      metrics.relevance * 0.25 +
      metrics.evidenceQuality * 0.3 +
      metrics.technicalMerit * 0.25 +
      metrics.popularity * 0.2;
    return {
      score: Math.round(total),
      rationale:
        "综合分 = 0.25×相关性 + 0.30×证据质量 + 0.25×技术价值 + 0.20×热度；momentum 未知（缺少历史快照），其权重并入证据质量与技术价值。",
    };
  }

  const total =
    metrics.relevance * weights.relevance +
    metrics.evidenceQuality * weights.evidenceQuality +
    metrics.technicalMerit * weights.technicalMerit +
    metrics.popularity * weights.popularity +
    metrics.momentum * weights.momentum;

  return {
    score: Math.round(total),
    rationale: `综合分 = 0.25×相关性 + 0.25×证据质量 + 0.20×技术价值 + 0.20×热度 + 0.10×momentum（${momentum.note}）。`,
  };
}
