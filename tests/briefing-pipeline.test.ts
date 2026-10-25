import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnalysisResult } from "@/lib/server/analysis/types";
import type { RawArticle, StoredArticle } from "@/lib/server/types";

/**
 * The manual-update pipeline must select the briefing *first* and only then
 * spend model calls on the selected items, skipping anything that already has
 * a real analysis.
 */

const dbFile = path.join(os.tmpdir(), `signal-briefing-pipeline-${Date.now()}.db`);

const engineCalls = vi.hoisted(() => ({ ids: [] as number[] }));

vi.mock("@/lib/server/analysis/analyzer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/analysis/analyzer")>();
  const engine = {
    id: "fake-llm",
    available: () => true,
    availabilityMessage: () => "fake engine",
    async analyze(article: StoredArticle): Promise<AnalysisResult> {
      engineCalls.ids.push(article.id);
      const base = actual.analyzeArticle(article);
      return {
        ...base,
        oneLineSummary: `Summary for ${article.id}.`,
        keyChange: `Key change for ${article.id}.`,
        differences: "Differs.",
        evidence: "Evidence.",
        limitations: `Limitations for ${article.id}.`,
        impact: `Impact for ${article.id}.`,
        personalRelevance: `Relevance for ${article.id}.`,
        // Deterministic, article-specific importance so selection is stable.
        importanceScore: base.importanceScore,
        analyzedAt: new Date().toISOString(),
      };
    },
  };
  return { ...actual, getAnalysisEngine: () => engine };
});

function article(index: number): RawArticle {
  const now = new Date().toISOString();
  return {
    provider: "rss",
    externalId: `pipeline:${index}`,
    title: `Pipeline signal ${index}`,
    summary: "We propose an algorithm and compare it with a baseline in controlled experiments. Code and documentation are available at https://github.com/test/project.",
    url: `https://example.com/pipeline/${index}`,
    sourceName: "Test feed",
    category: index % 2 === 0 ? "ai-models" : "physical-ai",
    publishedAt: now,
    fetchedAt: now,
    authors: [],
    tags: [],
  };
}

function preAnalyzed(articleId: number): AnalysisResult {
  return {
    articleId,
    oneLineSummary: "Existing summary.",
    keyChange: "Existing change.",
    differences: "Existing diff.",
    evidence: "Existing evidence.",
    limitations: "Existing limitations.",
    impact: "Existing impact.",
    personalRelevance: "Existing relevance.",
    furtherReading: [],
    importanceScore: 95,
    importanceFactors: {
      relevance: 30,
      novelty: 20,
      impact: 20,
      verifiability: 15,
      learning: 10,
    },
    evidenceBasis: "none",
    isModelRelease: false,
    modelFamily: null,
    analyzedAt: new Date().toISOString(),
  };
}

describe("briefing-first analysis pipeline", () => {
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
        /* Windows may keep the handle open; best-effort cleanup. */
      }
    }
  });

  it("analyzes only the selected items, and only when nothing exists yet", async () => {
    const { insertArticles } = await import("@/lib/server/db");
    const { analyzeBriefingWindow } = await import("@/lib/server/analysis/service");
    const { getDailyBriefing } = await import("@/lib/server/analysis/service");

    expect(
      insertArticles(Array.from({ length: 30 }, (_, i) => article(i))),
    ).toEqual({ inserted: 30, skipped: 0 });

    engineCalls.ids.length = 0;
    const summary = await analyzeBriefingWindow({ maxItems: 5 });

    // Selection happened before analysis, and only its items were analyzed.
    expect(summary.selected).toBe(5);
    expect(engineCalls.ids).toHaveLength(5);
    expect(summary.analyzed).toBe(5);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(0);

    const briefing = getDailyBriefing({ maxItems: 5 });
    const selectedIds = briefing.sections.flatMap((s) => s.items.map((i) => i.articleId));
    expect(new Set(engineCalls.ids)).toEqual(new Set(selectedIds));
    expect(briefing.count).toBe(5);
    expect(briefing.sections[0].items[0].whyItMatters).toContain("Impact for");
  });

  it("skips items that already have a real analysis", async () => {
    const { getDb } = await import("@/lib/server/db");
    const { saveAnalysis } = await import("@/lib/server/analysis/store");
    const { analyzeBriefingWindow } = await import("@/lib/server/analysis/service");

    // Mark every stored article as already analyzed by the model.
    const ids = (getDb().prepare(`SELECT id FROM articles`).all() as { id: number }[]).map(
      (row) => row.id,
    );
    for (const id of ids) saveAnalysis(preAnalyzed(id), "llm");

    engineCalls.ids.length = 0;
    const summary = await analyzeBriefingWindow({ maxItems: 5 });

    expect(summary.selected).toBe(5);
    expect(summary.skipped).toBe(5);
    expect(summary.analyzed).toBe(0);
    expect(engineCalls.ids).toHaveLength(0);
  });

  it("treats a rule-based baseline as not yet analyzed", async () => {
    const { getDb } = await import("@/lib/server/db");
    const { saveAnalysis } = await import("@/lib/server/analysis/store");
    const { getDailyBriefing } = await import("@/lib/server/analysis/service");
    const { analyzeBriefingWindow } = await import("@/lib/server/analysis/service");

    // Everyone starts "already analyzed" so the selection is stable.
    const ids = (getDb().prepare(`SELECT id FROM articles`).all() as { id: number }[]).map(
      (row) => row.id,
    );
    for (const id of ids) saveAnalysis(preAnalyzed(id), "llm");

    const selectedIds = getDailyBriefing({ force: true, maxItems: 5 }).sections.flatMap(
      (section) => section.items.map((item) => item.articleId),
    );
    expect(selectedIds).toHaveLength(5);

    // Downgrade exactly one selected item to the rule-based baseline.
    const downgraded = selectedIds[0];
    const stored = {
      id: downgraded,
      provider: "rss" as const,
      externalId: `pipeline:${downgraded}`,
      title: `Pipeline signal ${downgraded}`,
      summary: "We propose an algorithm and compare it with a baseline in controlled experiments. Code and documentation are available at https://github.com/test/project.",
      url: `https://example.com/pipeline/${downgraded}`,
      sourceName: "Test feed",
      category: "ai-models" as const,
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      authors: [],
      tags: [],
      metrics: null,
    };
    const { analyzeArticle } = await import("@/lib/server/analysis/analyzer");
    // Keep it at the top of the ranking so it stays selected after the
    // downgrade; the point of the test is the engine marker, not the score.
    saveAnalysis(
      { ...analyzeArticle(stored), importanceScore: 99 },
      "rule-based",
    );

    engineCalls.ids.length = 0;
    const summary = await analyzeBriefingWindow({ maxItems: 5 });

    expect(summary.selected).toBe(5);
    expect(summary.analyzed).toBe(1);
    expect(summary.skipped).toBe(4);
    expect(engineCalls.ids).toEqual([downgraded]);
  });
});
