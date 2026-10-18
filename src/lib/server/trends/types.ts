export type TrendRange = "7d" | "30d";

export type TrendSource = "github" | "arxiv" | "all";

export type TrendTopic =
  | "all"
  | "vla"
  | "robot-learning"
  | "world-model"
  | "llm"
  | "ai-agents"
  | "ai-coding"
  | "theorem-proving"
  | "llm-inference";

export interface RepoMetrics {
  /** 0–100 — current attention, log-scaled stars. */
  popularity: number;
  /** 0–100 or null — requires ≥2 historical snapshots. */
  momentum: number | null;
  /** 0–100 — code / docs / releases / reproducibility signals. */
  technicalMerit: number;
  /** 0–100 — README, license, releases, demo presence. */
  evidenceQuality: number;
  /** 0–100 — overlap with tracked focus areas. */
  relevance: number;
}

export interface MomentumDetail {
  available: boolean;
  snapshots: number;
  spanDays: number | null;
  growthStars: number | null;
  ratePerDay: number | null;
  note: string;
}

export interface RisingRepo {
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  license: string | null;
  homepage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  hasReadme: boolean | null;
  hasReleases: boolean | null;
  pushedAt: string | null;
  metrics: RepoMetrics;
  momentumDetail: MomentumDetail;
  compositeScore: number | null;
  compositeRationale: string;
}

export interface ReleaseSignal {
  id: number;
  title: string;
  url: string;
  category: string;
  sourceName: string;
  publishedAt: string;
  license: string | null;
  openWeights: boolean | null;
  benchmarks: string[];
  evalNote: string;
  claimOrigin: string;
  relevance: number;
  evidenceQuality: number;
}

export interface ResearcherSignal {
  id: number;
  title: string;
  url: string;
  authors: string[];
  category: string;
  publishedAt: string;
  summary: string;
}

export interface EmergingTopic {
  topic: string;
  count: number;
  previousCount: number | null;
  growth: number | null;
  windowDays: number;
  note: string;
}

export interface EarlySignal {
  kind: "repo" | "article";
  id: string;
  title: string;
  url: string;
  reason: string;
  popularity: number | null;
  evidenceQuality: number | null;
}

export interface TrendCoverage {
  sampledAt: string;
  github: {
    available: boolean;
    /** False when automatic collection is paused (SIGNAL_DISABLED_PROVIDERS). */
    collectionEnabled: boolean;
    reposTracked: number;
    snapshots: number;
    oldestSnapshotAt: string | null;
    /** Time of the most recent stored snapshot (data freshness). */
    latestSnapshotAt: string | null;
    note: string;
  };
  arxiv: {
    available: boolean;
    /** False when the paper sources are paused. */
    collectionEnabled: boolean;
    articles: number;
    /** Most recent stored publication time across paper sources. */
    latestArticleAt: string | null;
  };
}

export interface TrendsReport {
  coverage: TrendCoverage;
  risingRepos: RisingRepo[];
  releases: ReleaseSignal[];
  researcherSignals: ResearcherSignal[];
  emergingTopics: EmergingTopic[];
  earlySignals: EarlySignal[];
  scoringExplanation: string;
  filters: { range: TrendRange; topic: TrendTopic; source: TrendSource };
}
