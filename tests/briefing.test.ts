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

  it("deduplicates the same story fetched from two providers", () => {
    const first = row(1, "ai-models", 90, "2026-10-17T00:00:00Z");
    const duplicate = {
      ...row(2, "ai-models", 89, "2026-10-17T01:00:00Z"),
      title: first.title,
      url: "https://arxiv.org/abs/2v1",
    };
    const briefing = generateBriefing(
      [first, duplicate],
      new Date("2026-10-17T12:00:00Z"),
    );
    const ids = briefing.sections.flatMap((s) => s.items.map((i) => i.articleId));
    expect(ids).toEqual([1]);
    expect(briefing.count).toBe(1);
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

describe("section A overview data", () => {
  const articles = [
    row(1, "physical-ai", 90, "2026-10-17T00:00:00Z"),
    row(2, "physical-ai", 80, "2026-10-16T00:00:00Z"),
    row(3, "ai-models", 75, "2026-10-15T00:00:00Z"),
    row(4, "ai-math", 70, "2026-10-14T00:00:00Z"),
    row(5, "open-source", 65, "2026-10-13T00:00:00Z"),
  ];
  const briefing = generateBriefing(articles, new Date("2026-10-17T12:00:00Z"));

  it("exposes the selected count that matches the rendered sections", () => {
    const rendered = briefing.sections.reduce((sum, s) => sum + s.items.length, 0);
    expect(briefing.count).toBe(rendered);
    expect(briefing.count).toBeGreaterThan(0);
  });

  it("derives key themes from the selected items, most frequent first", () => {
    expect(briefing.keyThemes.length).toBeGreaterThan(0);
    expect(briefing.keyThemes.length).toBeLessThanOrEqual(5);

    // physical-ai appears twice, so VLA / Robot Learning must lead.
    const physical = briefing.keyThemes.filter((t) =>
      ["VLA", "Robot Learning", "Physical AI & Robotics"].includes(t.label),
    );
    expect(physical.length).toBeGreaterThan(0);
    expect(physical[0].count).toBe(2);

    // Counts never exceed the number of selected items and are sorted desc.
    for (const theme of briefing.keyThemes) {
      expect(theme.count).toBeLessThanOrEqual(briefing.count);
      expect(theme.count).toBeGreaterThan(0);
    }
    const counts = briefing.keyThemes.map((t) => t.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("links themes to a filterable topic or category", () => {
    for (const theme of briefing.keyThemes) {
      expect(theme.topic !== null || theme.category !== null).toBe(true);
    }
  });

  it("builds a digest from the actual selected items, not a fixed template", () => {
    expect(briefing.digest.length).toBeGreaterThan(20);
    // Mentions the top item title and the real selected count.
    expect(briefing.digest).toContain(`共 ${briefing.count} 条精选`);
    expect(briefing.digest).toContain("Title 1");
    expect(briefing.digest).toContain("Key change.");
    expect(briefing.digest).toContain("证据状态");
  });

  it("summarises the confidence split of the selected items", () => {
    const total = briefing.evidence.high + briefing.evidence.medium + briefing.evidence.low;
    expect(total).toBe(briefing.count);
  });

  it("states the coverage window it actually used", () => {
    expect(briefing.window).toEqual({ freshHours: 24, backfillDays: 7 });
  });

  it("does not list the same signal under both a topic and its parent category", () => {
    const labels = briefing.keyThemes.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    // ai-math items map to the "AI for Mathematics" topic, never the raw category.
    expect(labels).not.toContain("AI × Mathematics");
  });

  it("joins Latin-ending sentences with a space", () => {
    // keyChange "Key change." ends with an ASCII period.
    expect(briefing.digest).toContain("Key change. 证据状态");
  });

  it("returns empty-but-honest overview data when nothing qualifies", () => {
    const empty = generateBriefing([], new Date("2026-10-17T12:00:00Z"));
    expect(empty.count).toBe(0);
    expect(empty.keyThemes).toEqual([]);
    expect(empty.digest).toContain("没有达到精选阈值");
    expect(empty.evidence).toEqual({ high: 0, medium: 0, low: 0 });
  });
});
