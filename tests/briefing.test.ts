import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRIEFING_ITEMS,
  clampBriefingItems,
  generateBriefing,
} from "@/lib/server/analysis/briefing";
import { BRIEFING_SCHEMA_VERSION } from "@/lib/server/analysis/types";
import type { AnalyzedArticleRow } from "@/lib/server/analysis/store";
import type { StoredArticle } from "@/lib/server/types";
import type { AnalysisResult } from "@/lib/server/analysis/types";

/** Fixed "now" so the 24h window is deterministic. */
const NOW = new Date("2026-10-17T12:00:00Z");

/** Hours before NOW, as an ISO timestamp. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3600000).toISOString();
}

function row(
  id: number,
  category: StoredArticle["category"],
  importance: number,
  publishedAt: string,
  overrides: { title?: string; sourceName?: string; isModelRelease?: boolean } = {},
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
    evidenceBasis: "vendor" as const,
    isModelRelease: overrides.isModelRelease ?? false,
    modelFamily: null,
    analyzedAt: "2026-10-17T00:00:00Z",
  } satisfies AnalysisResult;

  return {
    id,
    provider: "arxiv",
    externalId: `x-${id}`,
    title: overrides.title ?? `Title ${id}`,
    summary: "Summary.",
    url: `https://arxiv.org/abs/${id}`,
    sourceName: overrides.sourceName ?? "arXiv",
    category,
    publishedAt,
    fetchedAt: "2026-10-17T00:00:00Z",
    authors: [],
    tags: [],
    metrics: null,
    analysis,
  };
}

describe("daily briefing selection window", () => {
  it("only considers content published in the last 24 hours", () => {
    const articles = [
      row(1, "physical-ai", 80, hoursAgo(2)),
      row(2, "ai-models", 90, hoursAgo(23)),
      row(3, "ai-math", 95, hoursAgo(25)), // just outside the window
      row(4, "ai-cs", 95, hoursAgo(48)),
    ];
    const briefing = generateBriefing(articles, NOW);

    const ids = briefing.sections.flatMap((s) => s.items.map((i) => i.articleId));
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    // Higher importance, but too old: the 24h window wins.
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
    expect(briefing.windowHours).toBe(24);
  });

  it("ignores timestamps in the future", () => {
    const briefing = generateBriefing(
      [row(1, "physical-ai", 90, new Date(NOW.getTime() + 3600000).toISOString())],
      NOW,
    );
    expect(briefing.count).toBe(0);
  });

  it("excludes items below the importance threshold", () => {
    const briefing = generateBriefing(
      [
        row(1, "physical-ai", 80, hoursAgo(1)),
        row(2, "ai-models", 44, hoursAgo(2)),
        row(3, "ai-math", 10, hoursAgo(3)),
      ],
      NOW,
    );
    expect(briefing.count).toBe(1);
  });

  it("ranks purely by importance inside the 24h window", () => {
    const briefing = generateBriefing(
      [
        row(1, "physical-ai", 70, hoursAgo(1)),
        row(2, "ai-models", 90, hoursAgo(20)),
      ],
      NOW,
    );
    const top = briefing.sections.find((s) => s.key === "top");
    expect(top?.items[0].articleId).toBe(2);
  });
});

describe("daily briefing sections", () => {
  const articles = [
    row(1, "physical-ai", 90, hoursAgo(1)),
    row(2, "physical-ai", 80, hoursAgo(2)),
    row(3, "ai-models", 75, hoursAgo(3)),
    row(4, "ai-math", 70, hoursAgo(4)),
    row(5, "open-source", 65, hoursAgo(5)),
  ];
  const briefing = generateBriefing(articles, NOW);

  it("produces at most one item per section", () => {
    for (const section of briefing.sections) {
      expect(section.items).toHaveLength(1);
    }
    expect(briefing.sections.map((s) => s.key)).toContain("top");
    expect(briefing.reduced).toBe(false);
  });

  it("reduces rather than pads when quality is scarce", () => {
    const sparse = generateBriefing([row(1, "physical-ai", 80, hoursAgo(1))], NOW);
    expect(sparse.reduced).toBe(true);
    expect(sparse.count).toBeLessThan(3);
  });

  it("drops categories that have no briefing section", () => {
    const withSignals = generateBriefing(
      [row(1, "physical-ai", 90, hoursAgo(1)), row(2, "signals", 99, hoursAgo(1))],
      NOW,
    );
    const ids = withSignals.sections.flatMap((s) => s.items.map((i) => i.articleId));
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  it("does not list the same story twice", () => {
    const withDuplicates = generateBriefing(
      [
        row(1, "physical-ai", 90, hoursAgo(1), { title: "Same Paper" }),
        row(2, "physical-ai", 88, hoursAgo(2), { title: "same   paper" }),
      ],
      NOW,
    );
    const ids = withDuplicates.sections.flatMap((s) => s.items.map((i) => i.articleId));
    expect(ids).toEqual([1]);
  });
});

describe("daily signal count", () => {
  // 12 qualified candidates, alternating between two sections.
  const many = Array.from({ length: 12 }, (_, i) =>
    row(
      i + 1,
      i % 2 === 0 ? "physical-ai" : "ai-models",
      90 - i,
      hoursAgo(1 + i),
    ),
  );

  it("caps the briefing at the requested item count", () => {
    const two = generateBriefing(many, NOW, { maxItems: 2 });
    expect(two.count).toBe(2);
    expect(two.maxItems).toBe(2);
    const rendered = two.sections.reduce((sum, s) => sum + s.items.length, 0);
    expect(rendered).toBe(2);
    expect(two.sourceMix.reduce((sum, s) => sum + s.count, 0)).toBe(2);
  });

  it("fills the remaining budget with the next most important items", () => {
    const ten = generateBriefing(many, NOW, { maxItems: 10 });
    expect(ten.count).toBe(10);
    // Once the budget exceeds the number of sections, sections repeat.
    expect(ten.sections.some((s) => s.items.length > 1)).toBe(true);
  });

  it("keeps the editorial default of five items", () => {
    expect(generateBriefing(many, NOW).maxItems).toBe(DEFAULT_BRIEFING_ITEMS);
    expect(generateBriefing(many, NOW).maxItems).toBe(5);
  });

  it("clamps out-of-range counts instead of failing", () => {
    expect(generateBriefing(many, NOW, { maxItems: 0 }).maxItems).toBe(1);
    expect(generateBriefing(many, NOW, { maxItems: -3 }).maxItems).toBe(1);
    expect(generateBriefing(many, NOW, { maxItems: 999 }).maxItems).toBe(30);
    expect(clampBriefingItems("7")).toBe(7);
    expect(clampBriefingItems(null)).toBe(DEFAULT_BRIEFING_ITEMS);
    expect(clampBriefingItems("not-a-number")).toBe(DEFAULT_BRIEFING_ITEMS);
  });

  it("never invents items beyond the qualified candidates", () => {
    const three = generateBriefing(many.slice(0, 3), NOW, { maxItems: 10 });
    expect(three.count).toBe(3);
  });
});

describe("section A overview data", () => {
  const articles = [
    row(1, "physical-ai", 90, hoursAgo(1), { sourceName: "arXiv RSS" }),
    row(2, "physical-ai", 80, hoursAgo(2), { sourceName: "arXiv RSS" }),
    row(3, "ai-models", 75, hoursAgo(3), { sourceName: "GitHub Release" }),
    row(4, "ai-math", 70, hoursAgo(4), { sourceName: "arXiv RSS" }),
    row(5, "open-source", 65, hoursAgo(5), { sourceName: "Hacker News" }),
  ];
  const briefing = generateBriefing(articles, NOW);

  it("stamps the payload version so stale caches are detectable", () => {
    expect(briefing.version).toBe(BRIEFING_SCHEMA_VERSION);
  });

  it("exposes the selected count that matches the rendered sections", () => {
    const rendered = briefing.sections.reduce((sum, s) => sum + s.items.length, 0);
    expect(briefing.count).toBe(rendered);
    expect(briefing.count).toBeGreaterThan(0);
  });

  it("derives key themes from the selected items, most frequent first", () => {
    expect(briefing.keyThemes.length).toBeGreaterThan(0);
    expect(briefing.keyThemes.length).toBeLessThanOrEqual(5);

    const physical = briefing.keyThemes.filter((t) =>
      ["VLA", "Robot Learning", "Physical AI & Robotics"].includes(t.label),
    );
    expect(physical.length).toBeGreaterThan(0);
    expect(physical[0].count).toBe(2);

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

  it("does not list the same signal under both a topic and its parent category", () => {
    const labels = briefing.keyThemes.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain("AI × Mathematics");
  });

  it("builds a digest from the actual selected items, not a fixed template", () => {
    expect(briefing.digest.length).toBeGreaterThan(20);
    expect(briefing.digest).toContain(`共 ${briefing.count} 条精选`);
    expect(briefing.digest).toContain("Title 1");
    expect(briefing.digest).toContain("Key change.");
  });

  it("reports contributing sources instead of a credibility score", () => {
    expect(briefing.sourceMix.length).toBeGreaterThan(0);
    const total = briefing.sourceMix.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(briefing.count);
    expect(briefing.sourceMix[0]).toEqual({ sourceName: "arXiv RSS", count: 3 });
    expect(briefing.digest).toContain("来源构成");
    // The removed metric must not reappear through the payload.
    expect(briefing).not.toHaveProperty("evidence");
    expect(JSON.stringify(briefing)).not.toMatch(/"confidence/i);
  });

  it("joins Latin-ending sentences with a space", () => {
    expect(briefing.digest).toContain("Key change. 来源构成");
  });

  it("returns empty-but-honest overview data when nothing qualifies", () => {
    const empty = generateBriefing([], NOW);
    expect(empty.count).toBe(0);
    expect(empty.keyThemes).toEqual([]);
    expect(empty.sourceMix).toEqual([]);
    expect(empty.digest).toContain("没有达到重要性阈值");
    expect(empty.reduced).toBe(true);
  });
});
