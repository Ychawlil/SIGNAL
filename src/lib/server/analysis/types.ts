import type { StoredArticle } from "../types";

/** Independent importance-vs-confidence scoring output. */
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

export interface ConfidenceFactors {
  /** Source type credibility (0–30). */
  sourceType: number;
  /** Method transparency (0–25). */
  methodTransparency: number;
  /** Experiment / benchmark quality (0–25). */
  experimentQuality: number;
  /** Independent reproduction signals (0–10). */
  independentReproduction: number;
  /** Evidence completeness (0–10). */
  evidenceCompleteness: number;
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
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  confidenceFactors: ConfidenceFactors;
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
  importanceScore: number;
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
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

export interface DailyBriefing {
  date: string;
  generatedAt: string;
  count: number;
  intro: string;
  sections: BriefingSection[];
  /** True when quality content was scarce and fewer items were returned. */
  reduced: boolean;
}

/** Pluggable analysis engine (rule-based now, LLM later). */
export interface AnalysisEngine {
  id: string;
  available(): boolean;
  availabilityMessage(): string;
  analyze(article: StoredArticle): Promise<AnalysisResult>;
}
