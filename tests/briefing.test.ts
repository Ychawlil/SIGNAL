import { describe, expect, it } from "vitest";
import { generateBriefing } from "@/lib/server/analysis/briefing";
import type { AnalyzedArticleRow } from "@/lib/server/analysis/store";
import type { StoredArticle } from "@/lib/server/types";
import type { AnalysisResult } from "@/lib/server/analysis/types";

function row(
  id: number,
  category: StoredArticle["category"],
  importance: number,
  publishedAt: string,
): AnalyzedArticleRow {
  const analysis = {
    articleId: id,
    oneLineSummary: "One line summary.",
    keyChange: "Key change.",
    differences: "差异说明",
    evidence: "Evidence.",
    limitations: "Limitations.",
    impact: "Impact.",
    personalRelevance: "Relevance.",
    furtherReading: [],
    importanceScore: importance,
    importanceFactors: { relevance: 0, novelty: 0, impact: 0, verifiability: 0, learning: 0 },
    confidenceScore: 60,
    confidenceLevel: "medium" as const,
    confidenceFactors: { sourceType: 0, methodTransparency: 0, experimentQuality: 0, independentReproduction: 0, evidenceCompleteness: 0 },
    evidenceBasis: "vendor" as const,
    isModelRelease: false,
    modelFamily: null,
    analyzedAt: "2026-10-17T00:00:00Z",
  } satisfies AnalysisResult;

  return {
    id,
    provider: "arxiv",
    externalId: `x-${id}`,
    title: `Title ${id}`,
    summary: "Summary.",
    url: "https://arxiv.org/abs/1",
    sourceName: "arXiv",
    category,
    publishedAt,
    fetchedAt: "2026-10-17T00:00:00Z",
    authors: [],
    tags: [],
    metrics: null,
    analysis,
  };
}

describe("daily briefing generation", () => {
  it("produces up to five sections from quality items", () => {
    const articles = [
      row(1, "physical-ai", 90, "2026-10-17T00:00:00Z"),
      row(2, "ai-models", 80, "2026-10-16T00:00:00Z"),
      row(3, "ai-math", 75, "2026-10-15T00:00:00Z"),
      row(4, "ai-cs", 70, "2026-10-14T00:00:00Z"),
      row(5, "open-source", 65, "2026-10-13T00:00:00Z"),
    ];
    const briefing = generateBriefing(articles, new Date("2026-10-17T12:00:00Z"));
    expect(briefing.count).toBeLessThanOrEqual(5);
    expect(briefing.sections.map((s) => s.key)).toContain("top");
    expect(briefing.reduced).toBe(false);
  });

  it("reduces rather than pads when quality is scarce", () => {
    const articles = [row(1, "physical-ai", 80, "2026-10-17T00:00:00Z")];
    const briefing = generateBriefing(articles, new Date("2026-10-17T12:00:00Z"));
    expect(briefing.reduced).toBe(true);
    expect(briefing.count).toBeLessThan(3);
  });

  it("excludes items below the importance threshold", () => {
    const articles = [
      row(1, "physical-ai", 80, "2026-10-17T00:00:00Z"),
      row(2, "ai-models", 20, "2026-10-16T00:00:00Z"),
      row(3, "ai-math", 10, "2026-10-15T00:00:00Z"),
    ];
    const briefing = generateBriefing(articles, new Date("2026-10-17T12:00:00Z"));
    expect(briefing.count).toBe(1);
  });
});
