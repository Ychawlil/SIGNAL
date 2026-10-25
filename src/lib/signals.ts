import type {
  CategoryId,
  IntelligenceItem,
} from "./types";
import { categoryToTopics } from "./topics";

/**
 * Flattened article + analysis record returned by `/api/signals`.
 * This is the single client-facing shape for real intelligence records.
 */
export interface SignalRecord {
  id: number;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  category: CategoryId;
  publishedAt: string;
  authors: string[];
  tags: string[];
  importanceScore: number;
  importanceFactors?: import("./server/analysis/types").AnalysisFactors | null;
  evidenceBasis?: string;
  keyChange: string;
  differences: string;
  evidence: string;
  limitations: string;
  impact: string;
  personalRelevance: string;
  oneLineSummary: string;
  furtherReading: { label: string; url: string }[];
  isModelRelease: boolean;
  modelFamily: string | null;
  analyzed: boolean;
}

export function estimateReadingMinutes(summary: string): number {
  const words = (summary || "").trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / 220));
}

/** Map a real SignalRecord onto the legacy IntelligenceItem view shape. */
export function toIntelligenceItem(record: SignalRecord): IntelligenceItem {
  const summary = record.summary || record.oneLineSummary || "";
  return {
    id: String(record.id),
    title: record.title,
    summary: summary || "—",
    category: record.category,
    sourceName: record.sourceName,
    sourceUrl: record.url,
    publishedAt: record.publishedAt,
    importanceScore: record.importanceScore,
    importanceFactors: record.importanceFactors,
    evidenceBasis: record.evidenceBasis,
    keyChange: record.keyChange || record.differences || "—",
    whyItMatters: record.impact || "—",
    limitations: record.limitations || "—",
    personalRelevance: record.personalRelevance || "—",
    tags: record.tags,
    topics: categoryToTopics(record.category),
    readingTimeMinutes: estimateReadingMinutes(summary),
  };
}
