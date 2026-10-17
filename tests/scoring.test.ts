import { describe, expect, it } from "vitest";
import {
  compositeScore,
  computeRepoMetrics,
  momentumDetail,
  popularityScore,
} from "@/lib/server/trends/scoring";
import type { GithubRepoRow, RepoSnapshotRow } from "@/lib/server/trends/store";

const repo: GithubRepoRow = {
  fullName: "org/repo",
  description: "A very detailed description of a robot learning project that is useful.",
  url: "https://github.com/org/repo",
  language: "Python",
  license: "Apache-2.0",
  homepage: "https://example.com",
  topics: ["robot-learning", "vla"],
  stars: 1000,
  forks: 100,
  openIssues: 5,
  watchers: 50,
  createdAt: "2026-01-01T00:00:00Z",
  pushedAt: "2026-10-01T00:00:00Z",
  archived: false,
  isFork: false,
  hasReadme: true,
  hasReleases: true,
  lastFetchedAt: "2026-10-17T00:00:00Z",
};

const snap = (stars: number, sampledAt: string): RepoSnapshotRow => ({
  repo: "org/repo",
  stars,
  forks: 100,
  openIssues: 5,
  sampledAt,
});

describe("trend scoring", () => {
  it("maps popularity on a log scale", () => {
    expect(popularityScore(0)).toBe(0);
    expect(popularityScore(1000)).toBe(60);
    expect(popularityScore(100000)).toBe(100);
  });

  it("requires two snapshots for momentum", () => {
    const detail = momentumDetail([snap(100, "2026-10-17T00:00:00Z")]);
    expect(detail.available).toBe(false);
    expect(detail.note).toContain("两次");
  });

  it("rejects momentum over too-short a span", () => {
    const detail = momentumDetail([
      snap(100, "2026-10-17T00:00:00Z"),
      snap(110, "2026-10-17T00:10:00Z"),
    ]);
    expect(detail.available).toBe(false);
    expect(detail.note).toContain("不足以判断增长趋势");
  });

  it("rejects momentum when the snapshots are minutes apart", () => {
    // Sampling jitter over a few hours is not a growth trend.
    const detail = momentumDetail([
      snap(1000, "2026-10-17T00:00:00Z"),
      snap(1003, "2026-10-17T03:00:00Z"),
    ]);
    expect(detail.available).toBe(false);
    expect(detail.note).toContain("需 ≥24 小时");
  });

  it("computes momentum over a meaningful span", () => {
    const detail = momentumDetail([
      snap(100, "2026-10-15T00:00:00Z"),
      snap(120, "2026-10-17T00:00:00Z"),
    ]);
    expect(detail.available).toBe(true);
    expect(detail.growthStars).toBe(20);
    expect(detail.ratePerDay).toBe(10);
  });

  it("separates the five metrics and explains the composite", () => {
    const { metrics, momentum } = computeRepoMetrics(repo, [
      snap(1000, "2026-10-15T00:00:00Z"),
      snap(1200, "2026-10-17T00:00:00Z"),
    ]);
    expect(metrics.popularity).toBeGreaterThanOrEqual(0);
    expect(metrics.technicalMerit).toBeGreaterThan(0);
    expect(metrics.evidenceQuality).toBeGreaterThan(0);
    expect(metrics.relevance).toBeGreaterThan(0);
    expect(metrics.momentum).not.toBeNull();

    const composite = compositeScore(metrics, momentum);
    expect(composite.score).toBeGreaterThanOrEqual(0);
    expect(composite.score).toBeLessThanOrEqual(100);
    expect(composite.rationale).toContain("0.25");
  });

  it("redistributes momentum weight when unknown", () => {
    const { metrics, momentum } = computeRepoMetrics(repo, [
      snap(1000, "2026-10-17T00:00:00Z"),
    ]);
    expect(metrics.momentum).toBeNull();
    const composite = compositeScore(metrics, momentum);
    expect(composite.rationale).toContain("momentum 未知");
  });
});
