import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_FOCUS_WEIGHTS,
  MAX_RELEVANCE,
  clampWeight,
  normalizeWeights,
  relevanceForCategory,
  topicsForCategory,
} from "@/lib/focus-weights";
import type { TopicId } from "@/lib/types";

describe("focus weights → relevance mapping", () => {
  it("scales a category by its topic weight", () => {
    const weights: Record<TopicId, number> = {
      ...DEFAULT_FOCUS_WEIGHTS,
      "physical-ai": 100,
    };
    expect(relevanceForCategory("physical-ai", weights)).toBe(MAX_RELEVANCE);
  });

  it("ignores topic weights that do not feed the category", () => {
    const weights: Record<TopicId, number> = {
      ...DEFAULT_FOCUS_WEIGHTS,
      "physical-ai": 100,
      "ai-math": 20,
    };
    expect(relevanceForCategory("physical-ai", weights)).toBe(30);
    // ai-math is ALSO fed by llm-reasoning (still at its default), and the
    // strongest matching topic wins — so it inherits that interest.
    expect(topicsForCategory("ai-math")).toContain("llm-reasoning");
    expect(relevanceForCategory("ai-math", weights)).toBe(26); // 85% of 30
  });

  it("scales a single-topic category exactly by its weight", () => {
    const weights = Object.fromEntries(
      Object.keys(DEFAULT_FOCUS_WEIGHTS).map((topic) => [topic, 0]),
    ) as Record<TopicId, number>;
    weights["ai-math"] = 20;
    // Every other topic is zeroed, so ai-math's own weight decides.
    expect(relevanceForCategory("ai-math", weights)).toBe(6);
  });

  it("drops to zero when the user zeroes every relevant weight", () => {
    const weights = Object.fromEntries(
      Object.keys(DEFAULT_FOCUS_WEIGHTS).map((topic) => [topic, 0]),
    ) as Record<TopicId, number>;
    expect(relevanceForCategory("physical-ai", weights)).toBe(0);
    expect(relevanceForCategory("ai-models", weights)).toBe(0);
  });

  it("keeps a fixed baseline for categories no topic tracks", () => {
    const weights = Object.fromEntries(
      Object.keys(DEFAULT_FOCUS_WEIGHTS).map((topic) => [topic, 0]),
    ) as Record<TopicId, number>;
    expect(topicsForCategory("other-science")).toEqual([]);
    expect(relevanceForCategory("other-science", weights)).toBe(14);
  });

  it("maps every tracked category to at least one topic", () => {
    for (const category of [
      "ai-models",
      "ai-research",
      "ai-math",
      "ai-cs",
      "physical-ai",
      "agents-coding",
      "open-source",
      "signals",
    ] as const) {
      expect(topicsForCategory(category).length).toBeGreaterThan(0);
    }
  });
});

describe("weight validation", () => {
  it("clamps and rounds input", () => {
    expect(clampWeight(150)).toBe(100);
    expect(clampWeight(-5)).toBe(0);
    expect(clampWeight(72.6)).toBe(73);
    expect(clampWeight("40")).toBe(40);
    expect(clampWeight("abc")).toBeNull();
    expect(clampWeight(Number.NaN)).toBeNull();
    expect(clampWeight(null)).toBeNull();
  });

  it("ignores unknown topics and keeps defaults for the rest", () => {
    const weights = normalizeWeights({ "physical-ai": 25, "not-a-topic": 99 });
    expect(weights["physical-ai"]).toBe(25);
    expect(weights["ai-math"]).toBe(DEFAULT_FOCUS_WEIGHTS["ai-math"]);
    expect(weights).not.toHaveProperty("not-a-topic");
  });

  it("falls back to defaults for an empty patch", () => {
    expect(normalizeWeights(null)).toEqual(DEFAULT_FOCUS_WEIGHTS);
  });
});

/* ------------------------------------------------------------------ */
/* Persistence + rescore against a real SQLite file                   */
/* ------------------------------------------------------------------ */

const dbFile = path.join(os.tmpdir(), `signal-weights-${Date.now()}.db`);

function rawArticle(index: number, category: "physical-ai" | "ai-math" | "other-science") {
  const now = new Date().toISOString();
  return {
    provider: "arxiv-rss" as const,
    externalId: `w:${index}`,
    title: `Paper ${index}`,
    summary: "We propose a method and report 10% and 20% gains on a benchmark.",
    url: `https://example.com/w/${index}`,
    sourceName: "Test",
    category,
    publishedAt: now,
    fetchedAt: now,
    authors: ["A"],
    tags: ["t"],
  };
}

describe("weights drive stored importance", () => {
  beforeAll(() => {
    process.env.SIGNAL_DB_PATH = dbFile;
    vi.resetModules();
  });

  afterAll(() => {
    delete process.env.SIGNAL_DB_PATH;
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.rmSync(`${dbFile}${suffix}`, { force: true });
      } catch {
        /* Windows may hold the handle */
      }
    }
  });

  it("persists weights, rescores existing analyses, and changes the ranking", async () => {
    const { insertArticles, getDb } = await import("@/lib/server/db");
    const { saveAnalysis } = await import("@/lib/server/analysis/store");
    const { analyzeArticle } = await import("@/lib/server/analysis/analyzer");
    const { getFocusWeights, saveFocusWeights } = await import("@/lib/server/settings");
    const { rescoreImportance } = await import("@/lib/server/analysis/rescore");

    insertArticles([
      rawArticle(1, "physical-ai"),
      rawArticle(2, "ai-math"),
      rawArticle(3, "other-science"),
    ]);

    const ids = (
      getDb().prepare(`SELECT id, category FROM articles ORDER BY id`).all() as {
        id: number;
        category: string;
      }[]
    );

    // Analyze with robotics de-prioritised so math wins the ranking.
    const mathsFirst = { ...DEFAULT_FOCUS_WEIGHTS, "physical-ai": 0, "ai-math": 100 };
    const weights = saveFocusWeights(mathsFirst);
    expect(getFocusWeights()).toEqual(weights);

    for (const row of ids) {
      const { getDb: db2 } = await import("@/lib/server/db");
      const article = db2()
        .prepare(`SELECT * FROM articles WHERE id = ?`)
        .get(row.id) as Record<string, unknown>;
      saveAnalysis(
        analyzeArticle(
          {
            id: Number(article.id),
            provider: "arxiv-rss",
            externalId: String(article.external_id),
            title: String(article.title),
            summary: String(article.summary),
            url: String(article.url),
            sourceName: String(article.source_name),
            category: article.category as "physical-ai" | "ai-math" | "other-science",
            publishedAt: String(article.published_at),
            fetchedAt: String(article.fetched_at),
            authors: ["A"],
            tags: ["t"],
            metrics: null,
          },
          weights,
        ),
      );
    }

    const before = getDb()
      .prepare(
        `SELECT a.category, an.importance_score s, an.importance_factors f
         FROM analyses an JOIN articles a ON a.id = an.article_id ORDER BY a.id`,
      )
      .all() as { category: string; s: number; f: string }[];

    const physicalBefore = before.find((r) => r.category === "physical-ai")!;
    const mathBefore = before.find((r) => r.category === "ai-math")!;
    expect(JSON.parse(physicalBefore.f).relevance).toBe(0);
    expect(JSON.parse(mathBefore.f).relevance).toBe(30);
    expect(mathBefore.s).toBeGreaterThan(physicalBefore.s);

    // Flip the weights the other way and rescore without re-running analysis.
    const roboticsFirst = { ...mathsFirst, "physical-ai": 100, "ai-math": 0 };
    saveFocusWeights(roboticsFirst);
    const rescored = rescoreImportance(roboticsFirst);
    expect(rescored).toBe(3);

    const after = getDb()
      .prepare(
        `SELECT a.category, an.importance_score s, an.importance_factors f
         FROM analyses an JOIN articles a ON a.id = an.article_id ORDER BY a.id`,
      )
      .all() as { category: string; s: number; f: string }[];

    const physicalAfter = after.find((r) => r.category === "physical-ai")!;
    const mathAfter = after.find((r) => r.category === "ai-math")!;
    expect(JSON.parse(physicalAfter.f).relevance).toBe(30);
    // ai-math itself is zeroed but llm-reasoning still covers it.
    expect(JSON.parse(mathAfter.f).relevance).toBe(26);
    expect(physicalAfter.s).toBeGreaterThan(mathAfter.s);

    // The other four factors are untouched by rescoring.
    const physicalFactorsBefore = JSON.parse(physicalBefore.f);
    const physicalFactorsAfter = JSON.parse(physicalAfter.f);
    expect(physicalFactorsAfter.novelty).toBe(physicalFactorsBefore.novelty);
    expect(physicalFactorsAfter.impact).toBe(physicalFactorsBefore.impact);
    expect(physicalFactorsAfter.verifiability).toBe(physicalFactorsBefore.verifiability);
    expect(physicalFactorsAfter.learning).toBe(physicalFactorsBefore.learning);
  });
});
