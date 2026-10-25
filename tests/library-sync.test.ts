import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
const dbFile = path.join(os.tmpdir(), `signal-library-sync-${Date.now()}.db`);
describe("unified article favorites", () => {
 beforeAll(async () => {
  process.env.SIGNAL_DB_PATH = dbFile; vi.resetModules();
  const { insertArticles } = await import("@/lib/server/db");
  const now = new Date().toISOString();
  insertArticles([1, 2].map((id) => ({ provider: "arxiv-rss" as const, externalId: `library:${id}`, title: `Article ${id}`, summary: "Summary", url: `https://example.com/library/${id}`, sourceName: "Test", category: "ai-research" as const, publishedAt: now, fetchedAt: now, authors: [], tags: [] })));
 });
 afterAll(() => { delete process.env.SIGNAL_DB_PATH; for (const suffix of ["", "-wal", "-shm"]) { try { fs.rmSync(dbFile + suffix, { force: true }); } catch { /* Windows may retain open handles. */ } } });
 const request = (method: string, body: unknown) => new NextRequest("http://localhost:2026/api/library", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
 it("makes an article favorite visible in the research library and removes it everywhere", async () => {
  const route = await import("@/app/api/library/route");
  expect((await route.POST(request("POST", { articleId: 1 }))).status).toBe(200);
  const response = await route.GET(new NextRequest("http://localhost:2026/api/library"));
  expect((await response.json()).items.map((item: { article: { id: number } }) => item.article.id)).toContain(1);
  await route.DELETE(request("DELETE", { articleId: 1 }));
  const { isSaved } = await import("@/lib/server/library/store"); expect(isSaved(1)).toBe(false);
 });
 it("migrates legacy favorites once without duplicates or overwriting existing notes/status", async () => {
  const { saveItem, updateItem, listSavedItems } = await import("@/lib/server/library/store");
  const { migrateFavorites } = await import("@/lib/server/library/migrate");
  saveItem(1); updateItem(1, { notes: "existing note", status: "reproduce", tags: ["keep"] });
  const legacy = { favoriteIds: ["1", "2", "2", "99999"], readIds: ["2"], notes: { "1": "legacy note", "2": "second note" } };
  expect(migrateFavorites(legacy)).toBe(1); expect(migrateFavorites(legacy)).toBe(0);
  const items = listSavedItems(); expect(items).toHaveLength(2);
  expect(items.find((item) => item.article.id === 1)).toMatchObject({ notes: "existing note", status: "reproduce", tags: ["keep"] });
  expect(items.find((item) => item.article.id === 2)).toMatchObject({ notes: "second note", status: "read" });
 });
 it("rejects attempts to save missing articles", async () => { const route = await import("@/app/api/library/route"); expect((await route.POST(request("POST", { articleId: 99999 }))).status).toBe(404); });
 it("rejects malformed migration data", async () => { const { POST } = await import("@/app/api/library/migrate/route"); const response = await POST(request("POST", { favoriteIds: ["invalid"], readIds: [], notes: {} })); expect(response.status).toBe(400); });
});
