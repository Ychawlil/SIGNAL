import { describe, expect, it } from "vitest";
import { analyzeArticle } from "@/lib/server/analysis/analyzer";
import type { StoredArticle } from "@/lib/server/types";

function article(overrides: Partial<StoredArticle> = {}): StoredArticle {
  return {
    id: 1,
    provider: "arxiv",
    externalId: "arxiv:2401.12345",
    title: "A Method for Robotic Manipulation",
    summary:
      "We introduce a new policy for robot manipulation and evaluate it on several benchmarks, reporting state-of-the-art results.",
    url: "https://arxiv.org/abs/2401.12345",
    sourceName: "arXiv",
    category: "physical-ai",
    publishedAt: "2026-10-16T00:00:00Z",
    fetchedAt: "2026-10-17T00:00:00Z",
    authors: ["Alice", "Bob"],
    tags: ["vla"],
    metrics: null,
    ...overrides,
  };
}

describe("analyzer", () => {
  it("produces every structured analysis field", () => {
    const result = analyzeArticle(article());
    expect(result.oneLineSummary.length).toBeGreaterThan(0);
    expect(result.keyChange.length).toBeGreaterThan(0);
    expect(typeof result.differences).toBe("string");
    expect(typeof result.evidence).toBe("string");
    expect(typeof result.limitations).toBe("string");
    expect(typeof result.impact).toBe("string");
    expect(typeof result.personalRelevance).toBe("string");
    expect(result.furtherReading.length).toBeGreaterThan(0);
  });

  it("separates importance and confidence as independent scores", () => {
    const result = analyzeArticle(article());
    expect(result.importanceScore).toBeGreaterThanOrEqual(0);
    expect(result.importanceScore).toBeLessThanOrEqual(100);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
    expect(["high", "medium", "low"]).toContain(result.confidenceLevel);
    expect(result.importanceFactors).toHaveProperty("relevance");
    expect(result.confidenceFactors).toHaveProperty("sourceType");
  });

  it("does not classify an ordinary paper as a model release", () => {
    const result = analyzeArticle(
      article({ title: "English Language Models: A Survey of Trends" }),
    );
    expect(result.isModelRelease).toBe(false);
    expect(result.modelFamily).toBeNull();
  });

  it("classifies a versioned model title as a release", () => {
    const result = analyzeArticle(
      article({ title: "LLaMA-2: Open Foundation Models" }),
    );
    expect(result.isModelRelease).toBe(true);
    expect(result.modelFamily).toBe("LLaMA-2");
  });

  it("flags missing evidence honestly", () => {
    const result = analyzeArticle(
      article({
        summary:
          "We describe an idea for future work. A short abstract without numbers or benchmarks.",
      }),
    );
    expect(result.evidenceBasis).toBe("none");
  });
});
