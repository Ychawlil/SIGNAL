import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
const dbFile = path.join(os.tmpdir(), `signal-research-flow-${Date.now()}.db`);
const today = "2026-10-22T10:00:00Z";
describe("research workflow", () => {
 beforeAll(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  process.env.SIGNAL_DB_PATH = dbFile; vi.resetModules();
  const { insertArticles, getDb } = await import("@/lib/server/db");
  insertArticles([1, 2, 3].map((id) => ({ provider: "rss" as const, externalId: `flow:${id}`, title: id === 1 ? "org/tool · v1.0" : id === 2 ? "org/tool · v2.0" : "An unrelated result", summary: "We propose an algorithm with open-source code and compare to a baseline in experiments with 20% improvement.", url: id === 1 ? "https://github.com/org/tool/releases/tag/v1" : id === 2 ? "https://github.com/org/tool/releases/tag/v2" : "https://elsewhere.com/other", sourceName: "Test", category: "open-source" as const, publishedAt: id === 1 ? "2026-10-20T00:00:00Z" : today, fetchedAt: today, authors: [], tags: [], metrics: {} })));
  const { saveItem } = await import("@/lib/server/library/store"); saveItem(1);
  getDb().prepare("UPDATE saved_items SET saved_at = ? WHERE article_id = 1").run("2026-10-21T00:00:00Z");
 });
 afterAll(() => { vi.useRealTimers(); delete process.env.SIGNAL_DB_PATH; for (const suffix of ["", "-wal", "-shm"]) { try { fs.rmSync(dbFile + suffix, { force: true }); } catch { /* Windows may retain handles. */ } } });
 it("finds a newer repository release, excludes unrelated records, and supports read acknowledgement", async () => {
  const { libraryUpdates, articleContext, markUpdatesSeen } = await import("@/lib/server/discovery");
  expect(articleContext(1)?.followups.map((item) => item.id)).toEqual([2]);
  const updates = libraryUpdates(); expect(updates).toHaveLength(1); expect(updates[0].items.map((item) => item.id)).toEqual([2]);
  markUpdatesSeen(1); expect(libraryUpdates()).toHaveLength(0);
 });
 it("filters unread articles before pagination", async () => { const { listSignals } = await import("@/lib/server/signals"); const result = listSignals({ page: 1, pageSize: 1, excludeIds: [1, 2] }); expect(result.total).toBe(1); expect(result.items[0].id).toBe(3); });
 it("stores queue state and keeps collections accessible", async () => {
  const { saveItem, updateItem, listSavedItems, createCollection, addCollectionItem, listCollectionItems } = await import("@/lib/server/library/store");
  saveItem(2); expect(listSavedItems({ status: "later" }).some((item) => item.article.id === 2)).toBe(true);
  updateItem(2, { status: "read" }); expect(listSavedItems({ status: "later" }).some((item) => item.article.id === 2)).toBe(false);
  const collection = createCollection("Robotics", "Research"); addCollectionItem(collection.id, 2, "Reproduce"); expect(listCollectionItems(collection.id)[0].articleId).toBe(2);
 });
 it("reads historical snapshots without generating missing days", async () => {
  const { getDb } = await import("@/lib/server/db");
  const payload = { date: "2026-10-20", count: 1, sections: [], digest: "Archived summary", generatedAt: "2026-10-20T12:00:00Z" };
  getDb().prepare("INSERT INTO briefings (date, generated_at, payload, article_ids) VALUES (?, ?, ?, ?)").run(payload.date, payload.generatedAt, JSON.stringify(payload), "[1]");
  const { GET } = await import("@/app/api/briefing/history/route");
  const response = await GET(new NextRequest("http://localhost/api/briefing/history?date=2026-10-20")); const data = await response.json(); expect(data.dates).toContain("2026-10-20"); expect(data.briefing.digest).toBe("Archived summary");
  const absent = await GET(new NextRequest("http://localhost/api/briefing/history?date=2025-01-01")); expect((await absent.json()).briefing).toBeNull();
 });
 it("upgrades score factors without changing model-written analysis text", async () => {
  const { analyzeArticle } = await import("@/lib/server/analysis/analyzer"); const { saveAnalysis, listResearchRecords } = await import("@/lib/server/analysis/store");
  const { getDb } = await import("@/lib/server/db"); const { rescoreImportance } = await import("@/lib/server/analysis/rescore"); const { DEFAULT_FOCUS_WEIGHTS } = await import("@/lib/focus-weights");
  const row = getDb().prepare("SELECT * FROM articles WHERE id = 1").get()!;
  const article = { id: 1, provider: "rss" as const, externalId: "flow:1", title: String(row.title), summary: String(row.summary), url: String(row.url), sourceName: "Test", category: "open-source" as const, publishedAt: String(row.published_at), fetchedAt: today, authors: [], tags: [], metrics: null };
  const analysis = analyzeArticle(article); saveAnalysis({ ...analysis, impact: "Preserve model-written text", importanceScore: 99 }, "llm");
  rescoreImportance(DEFAULT_FOCUS_WEIGHTS); const result = listResearchRecords({ page: 1, pageSize: 100 }).items.find((item) => item.id === 1)!; expect(result.analysis.impact).toBe("Preserve model-written text"); expect(result.analysis.importanceFactors.version).toBe(2); expect(result.analysis.importanceScore).not.toBe(99);
 });
});
