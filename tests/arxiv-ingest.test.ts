import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * End-to-end check of the arXiv pipeline against a real SQLite file:
 * parse -> normalize -> insert -> de-duplicate.
 */
const dbFile = path.join(os.tmpdir(), `signal-arxiv-test-${Date.now()}.db`);

function atom(entries: string[], total: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <opensearch:totalResults>${total}</opensearch:totalResults>
${entries.join("\n")}
</feed>`;
}

const ENTRY = `  <entry>
    <id>http://arxiv.org/abs/2610.22342v1</id>
    <published>2026-10-16T17:59:58Z</published>
    <updated>2026-10-16T17:59:58Z</updated>
    <title>Spark-0: Scaling Spatially
      Aligned Tactile Pretraining</title>
    <summary>We present Spark-0, a spatially aligned
      vision-tactile-language-action model.</summary>
    <author><name>Alice</name></author>
    <link href="http://arxiv.org/abs/2610.22342v1" rel="alternate" type="text/html"/>
    <arxiv:primary_category term="cs.RO" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.RO" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>`;

describe("arXiv ingest integration", () => {
  beforeAll(() => {
    process.env.SIGNAL_DB_PATH = dbFile;
    vi.resetModules();
  });

  afterAll(() => {
    delete process.env.SIGNAL_DB_PATH;
    // Windows keeps the SQLite handle open for the process lifetime, so the
    // temp file may still be locked here — best-effort cleanup only.
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.rmSync(`${dbFile}${suffix}`, { force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("persists parsed articles and rejects duplicates on re-ingest", async () => {
    const { parseArxivFeed } = await import("@/lib/server/providers/arxiv");
    const { insertArticles, getDb } = await import("@/lib/server/db");

    const parsed = parseArxivFeed(atom([ENTRY], 1), "2026-10-17T05:00:00.000Z");
    expect(parsed.entries).toHaveLength(1);

    const first = insertArticles(parsed.entries);
    expect(first).toEqual({ inserted: 1, skipped: 0 });

    // A second run over the same window must not duplicate rows.
    const second = insertArticles(parseArxivFeed(atom([ENTRY], 1), "2026-10-17T06:00:00.000Z").entries);
    expect(second).toEqual({ inserted: 0, skipped: 1 });

    const rows = getDb()
      .prepare(
        `SELECT title, summary, url, category, published_at, fetched_at, tags, authors
         FROM articles WHERE provider = 'arxiv'`,
      )
      .all() as Record<string, unknown>[];

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.title).toBe("Spark-0: Scaling Spatially Aligned Tactile Pretraining");
    expect(row.summary).toBe(
      "We present Spark-0, a spatially aligned vision-tactile-language-action model.",
    );
    expect(row.category).toBe("physical-ai");
    // Publication time stays the content time, not the fetch time.
    expect(row.published_at).toBe("2026-10-16T17:59:58.000Z");
    expect(row.fetched_at).toBe("2026-10-17T05:00:00.000Z");
    expect(JSON.parse(String(row.tags))).toEqual(["cs.RO", "cs.LG"]);
    expect(JSON.parse(String(row.authors))).toEqual(["Alice"]);
  });
});
