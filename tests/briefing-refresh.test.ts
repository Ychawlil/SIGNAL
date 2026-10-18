import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnalysisResult } from "@/lib/server/analysis/types";
import type { RawArticle } from "@/lib/server/types";

const dbFile = path.join(os.tmpdir(), `signal-briefing-window-${Date.now()}.db`);

function article(index: number, category: RawArticle["category"], title: string): RawArticle {
  const now = new Date().toISOString();
  return {
    provider: "rss",
    externalId: `test:${index}`,
    title,
    summary: "Summary.",
    url: `https://example.com/signals/${index}`,
    sourceName: "Test feed",
    category,
    publishedAt: now,
    fetchedAt: now,
    authors: [],
    tags: [],
  };
}

function analysis(articleId: number, importanceScore: number): AnalysisResult {
  return {
    articleId,
    oneLineSummary: "One line summary.",
    keyChange: "Key change.",
    differences: "Diff.",
    evidence: "Evidence.",
    limitations: "Limitations.",
    impact: "Impact.",
    personalRelevance: "Relevance.",
    furtherReading: [],
    importanceScore,
    importanceFactors: {
      relevance: 0,
      novelty: 0,
      impact: 0,
      verifiability: 0,
      learning: 0,
    },
    evidenceBasis: "vendor",
    isModelRelease: false,
    modelFamily: null,
    analyzedAt: new Date().toISOString(),
  };
}

describe("daily briefing freshness window", () => {
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

  it("includes recent items that a capped top-100 page would hide", async () => {
    const { getDb, insertArticles } = await import("@/lib/server/db");
    const { saveAnalysis } = await import("@/lib/server/analysis/store");
    const { getDailyBriefing } = await import("@/lib/server/analysis/service");

    const articles = Array.from({ length: 100 }, (_, i) =>
      article(i, "ai-models", `High signal ${i}`),
    );
    articles.push(article(100, "physical-ai", "Low-scored robotics signal"));
    expect(insertArticles(articles)).toEqual({ inserted: 101, skipped: 0 });

    const rows = getDb().prepare(`SELECT id, title FROM articles`).all() as {
      id: number;
      title: string;
    }[];
    const idByTitle = new Map(rows.map((row) => [row.title, row.id]));
    for (let i = 0; i < 100; i++) {
      saveAnalysis(analysis(idByTitle.get(`High signal ${i}`)!, 90));
    }
    saveAnalysis(analysis(idByTitle.get("Low-scored robotics signal")!, 50));

    const briefing = getDailyBriefing({ force: true });

    // The robotics item ranks 101st; the capped page would never expose it.
    expect(briefing.sections.map((section) => section.key)).toContain("embodied");
    const ids = briefing.sections.flatMap((section) =>
      section.items.map((item) => item.articleId),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
