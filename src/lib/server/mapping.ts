import "server-only";
import type {
  ConfidenceLevel,
  IntelligenceItem,
  ResearchItem,
} from "@/lib/types";
import type { ProviderId, StoredArticle } from "./types";

/**
 * Maps persisted raw articles onto the application models. English titles and
 * original content are preserved; Chinese summaries / extracted insights are
 * left for the downstream analysis stage.
 */

function confidenceForProvider(provider: ProviderId): ConfidenceLevel {
  switch (provider) {
    case "github":
      return "high";
    case "arxiv":
    case "arxiv-rss":
      return "medium";
    case "rss":
      return "low";
    case "hackernews":
      return "low";
    default:
      return "medium";
  }
}

export function articleToIntelligenceItem(
  article: StoredArticle,
): IntelligenceItem {
  return {
    id: `src-${article.provider}-${article.id}`,
    title: article.title,
    summary: article.summary,
    category: article.category,
    sourceName: article.sourceName,
    sourceUrl: article.url,
    publishedAt: article.publishedAt,
    importanceScore: 50, // assigned by the analysis stage
    confidenceLevel: confidenceForProvider(article.provider),
    keyChange: "",
    whyItMatters: "",
    limitations: "",
    personalRelevance: "",
    tags: article.tags,
    topics: [],
    readingTimeMinutes: 5,
  };
}

export function articleToResearchItem(
  article: StoredArticle,
): ResearchItem {
  return {
    id: `rsr-${article.provider}-${article.id}`,
    title: article.title,
    kind: article.provider === "arxiv" || article.provider === "arxiv-rss" ? "paper" : "open-source",
    category: article.category,
    topics: [],
    researchQuestion: article.summary,
    coreMethod: "",
    innovation: "",
    evidence: "",
    limitations: "",
    relatedWorks: [],
    readingOrder: [],
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    importanceScore: 50,
    tags: article.tags,
  };
}
