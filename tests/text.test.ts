import { describe, expect, it } from "vitest";
import {
  findArxivRefs,
  findBenchmarks,
  firstSentence,
  splitSentences,
} from "@/lib/server/analysis/text";

describe("text helpers", () => {
  it("splits sentences", () => {
    expect(splitSentences("First. Second! Third?")).toEqual(["First.", "Second!", "Third?"]);
  });

  it("detects named benchmarks", () => {
    const found = findBenchmarks("We evaluate on MMLU, GSM8K and SWE-bench Verified.");
    expect(found).toContain("MMLU");
    expect(found).toContain("GSM8K");
    expect(found).toContain("SWE-bench Verified");
  });

  it("extracts arXiv ids", () => {
    const ids = findArxivRefs("see arXiv:2401.12345 and arXiv:2305.00001v2 for details");
    expect(ids).toContain("2401.12345");
    expect(ids).toContain("2305.00001");
  });

  it("returns a length-capped first sentence", () => {
    const long = "A very long sentence. ".repeat(20).trim();
    expect(firstSentence(long, 50).length).toBeLessThanOrEqual(51);
  });
});
