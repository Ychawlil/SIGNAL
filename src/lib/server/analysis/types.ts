import type { StoredArticle } from "../types";

/** Importance scoring output (0–100), summed from five weighted factors. */
export interface AnalysisFactors {
  /** Relevance to tracked focus areas (0–30). */
  relevance: number;
  /** Technical novelty (0–20). */
  novelty: number;
  /** Potential impact (0–20). */
  impact: number;
  /** Verifiability (0–15). */
  verifiability: number;
  /** Personal learning value (0–15). */
  learning: number;
}

export type EvidenceBasis = "none" | "vendor" | "independent" | "mixed";

export interface FurtherReadingRef {
  label: string;
  url: string;
}

export interface AnalysisResult {
  articleId: number;
  /** 一句话摘要 (English, derived from the source). */
  oneLineSummary: string;
  /** 关键技术变化. */
  keyChange: string;
  /** 与已有方案相比的差异. */
  differences: string;
  /** 实验、基准和证据. */
  evidence: string;
  /** 已知局限与未解决问题. */
  limitations: string;
  /** 对 AI 和相关产业的潜在影响. */
  impact: string;
  /** 对个人学习和研究的相关性. */
  personalRelevance: string;
  /** 建议继续阅读的原始资料. */
  furtherReading: FurtherReadingRef[];
  importanceScore: number;
  importanceFactors: AnalysisFactors;
  evidenceBasis: EvidenceBasis;
  isModelRelease: boolean;
  modelFamily: string | null;
  analyzedAt: string;
}

export interface ModelVersion {
  family: string;
  name: string;
  version: string | null;
  sourceArticleId: number | null;
  reasoning: string | null;
  math: string | null;
  coding: string | null;
  multimodal: string | null;
  agent: string | null;
  params: string | null;
  contextLength: string | null;
  latency: string | null;
  cost: string | null;
  openWeights: boolean | null;
  apiAvailable: boolean | null;
  license: string | null;
  deployment: string | null;
  benchmarks: string[];
  evalNote: string;
  claimOrigin: "vendor" | "independent" | "unknown";
  updatedAt: string;
}

export interface ModelFamily {
  family: string;
  versions: ModelVersion[];
  /** Honest comparison note; "缺乏可直接比较的证据" when fields are missing. */
  comparisonNote: string;
}

export interface BriefingItem {
  articleId: number;
  title: string;
  url: string;
  category: string;
  sourceName: string;
  publishedAt: string;
  oneLineSummary: string;
  keyChange: string;
  /** Why it matters (the analysis `impact` field). */
  whyItMatters: string;
  /** Known limitations and open questions. */
  limitations: string;
  /** Value for the reader's own study / research. */
  personalRelevance: string;
  importanceScore: number;
}

export interface BriefingSection {
  key:
    | "top"
    | "models"
    | "math-cs"
    | "embodied"
    | "open-research"
    | "other-science";
  title: string;
  items: BriefingItem[];
}

export interface BriefingTheme {
  label: string;
  /** Topic id when the theme maps to a tracked topic (enables Explore filtering). */
  topic: string | null;
  category: string | null;
  count: number;
}

export interface BriefingSourceMix {
  sourceName: string;
  count: number;
}

/** Bumped whenever the payload shape changes, to invalidate the day cache. */
export const BRIEFING_SCHEMA_VERSION = 8;

export interface DailyBriefing {
  /** Payload shape version — see BRIEFING_SCHEMA_VERSION. */
  version: number;
  date: string;
  generatedAt: string;
  count: number;
  intro: string;
  sections: BriefingSection[];
  /** True when quality content was scarce and fewer items were returned. */
  reduced: boolean;
  /** Ranked key themes across the selected items (section A). */
  keyThemes: BriefingTheme[];
  /** Short editorial digest built from the selected items (section A). */
  digest: string;
  /** Which sources contributed the selected items (section A). */
  sourceMix: BriefingSourceMix[];
  /** Selection window actually used, in hours. */
  windowHours: number;
  /** Item cap that produced this briefing (the daily signal count). */
  maxItems: number;
}

/** Pluggable analysis engine (rule-based now, LLM later). */
export interface AnalysisEngine {
  id: string;
  available(): boolean;
  availabilityMessage(): string;
  analyze(
    article: StoredArticle,
    weights?: Record<string, number>,
  ): Promise<AnalysisResult>;
}
