import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractJsonObject,
  llmAnalysisEngine,
  ruleBasedEngine,
} from "@/lib/server/analysis/analyzer";
import type { StoredArticle } from "@/lib/server/types";

function article(overrides: Partial<StoredArticle> = {}): StoredArticle {
  return {
    id: 7,
    provider: "hackernews",
    externalId: "hn:1",
    title: "Show HN: A gateway for LLM traffic",
    summary:
      "The author introduces a gateway that claims under 15 MB of resident memory. No benchmarks or third-party evaluation are provided.",
    url: "https://news.ycombinator.com/item?id=1",
    sourceName: "Hacker News",
    category: "agents-coding",
    publishedAt: "2026-10-18T00:00:00Z",
    fetchedAt: "2026-10-18T00:30:00Z",
    authors: [],
    tags: [],
    metrics: null,
    ...overrides,
  };
}

function completion(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const COMPLETE = {
  oneLineSummary: "A Go gateway for LLM traffic claims a very small memory footprint.",
  keyChange: "Ships routing and caching in a single small binary.",
  differences: "Unlike Python gateways, it avoids a runtime dependency.",
  evidence: "The post reports no benchmarks.",
  whyItMatters:
    "If the memory claim holds, LLM routing becomes practical on edge nodes and in sidecars.",
  limitations:
    "No benchmark, no source-level verification and a single author claim, so the memory figure is unverified.",
  personalRelevance:
    "A compact Go codebase worth reading to understand streaming proxies and token accounting.",
};

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"a":"b"}')).toEqual({ a: "b" });
  });

  it("strips markdown fences and surrounding prose", () => {
    const text = 'Here you go:\n```json\n{"a":"b"}\n```\nThanks';
    expect(extractJsonObject(text)).toEqual({ a: "b" });
  });

  it("rejects non-object payloads", () => {
    expect(extractJsonObject("[1,2,3]")).toBeNull();
    expect(extractJsonObject("not json at all")).toBeNull();
    expect(extractJsonObject("   ")).toBeNull();
  });
});

describe("llm analysis engine", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_ANALYZER_API_KEY", "test-key");
    vi.stubEnv("LLM_ANALYZER_BASE_URL", "https://api.example.test");
    vi.stubEnv("LLM_ANALYZER_MODEL", "deepseek-flash");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports unavailability without a key and falls back to the rule engine", async () => {
    vi.stubEnv("LLM_ANALYZER_API_KEY", "");
    expect(llmAnalysisEngine.available()).toBe(false);
    const result = await llmAnalysisEngine.analyze(article());
    const expected = await ruleBasedEngine.analyze(article());
    expect(result.oneLineSummary).toBe(expected.oneLineSummary);
  });

  it("maps whyItMatters onto the stored impact field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion(COMPLETE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await llmAnalysisEngine.analyze(article());

    expect(result.impact).toContain("edge nodes");
    expect(result.limitations).toContain("unverified");
    expect(result.personalRelevance).toContain("Go codebase");
    expect(result.oneLineSummary).toBe(COMPLETE.oneLineSummary);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("deepseek-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    // Scoring stays deterministic and is never delegated to the model.
    expect(typeof result.importanceScore).toBe("number");
  });

  it("refuses to persist an analysis that is missing briefing fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        completion({ oneLineSummary: "Something happened.", keyChange: "A change." }),
      ),
    );

    await expect(llmAnalysisEngine.analyze(article())).rejects.toThrow(
      /incomplete analysis/,
    );
  });

  it("retries a retryable status once before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream busy", { status: 503 }))
      .mockResolvedValueOnce(completion(COMPLETE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await llmAnalysisEngine.analyze(article());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.limitations).toContain("unverified");
  });

  it("surfaces a hard failure when every attempt returns invalid output", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(llmAnalysisEngine.analyze(article())).rejects.toThrow(/empty message/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(llmAnalysisEngine.analyze(article())).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
