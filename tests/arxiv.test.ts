import { describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/server/http";
import {
  ARXIV_MIN_INTERVAL_MS,
  arxivIdFromUrl,
  arxivProvider,
  buildArxivQuery,
  collectArxiv,
  normalizeArxivText,
  parseArxivFeed,
} from "@/lib/server/providers/arxiv";

/** Build a realistic Atom entry mirroring the arXiv response layout. */
function entry(options: {
  id: string;
  title: string;
  summary?: string;
  published: string;
  primary?: string;
  categories?: string[];
  authors?: string[];
}): string {
  const categories = options.categories ?? [options.primary ?? "cs.AI"];
  return `  <entry>
    <id>http://arxiv.org/abs/${options.id}</id>
    <published>${options.published}</published>
    <updated>${options.published}</updated>
    <title>${options.title}</title>
    <summary>${options.summary ?? "An abstract."}</summary>
${(options.authors ?? ["Ada Lovelace"]).map((name) => `    <author><name>${name}</name></author>`).join("\n")}
    <link href="http://arxiv.org/abs/${options.id}" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/${options.id}" rel="related" type="application/pdf"/>
    <arxiv:primary_category term="${options.primary ?? categories[0]}" scheme="http://arxiv.org/schemas/atom"/>
${categories.map((term) => `    <category term="${term}" scheme="http://arxiv.org/schemas/atom"/>`).join("\n")}
  </entry>`;
}

function feed(entries: string[], totalResults: number, startIndex = 0): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <link href="http://export.arxiv.org/api/query?search_query=cat:cs.AI&amp;start=${startIndex}&amp;max_results=1" rel="self" type="application/atom+xml"/>
  <title>ArXiv Query</title>
  <id>http://arxiv.org/api/abc</id>
  <updated>2026-10-17T00:00:00-04:00</updated>
  <opensearch:totalResults>${totalResults}</opensearch:totalResults>
  <opensearch:startIndex>${startIndex}</opensearch:startIndex>
  <opensearch:itemsPerPage>${entries.length}</opensearch:itemsPerPage>
${entries.join("\n")}
</feed>`;
}

describe("arXiv response parsing", () => {
  it("normalizes multi-line titles and abstracts", () => {
    const xml = feed(
      [
        entry({
          id: "2610.22342v1",
          title: "Spark-0: Scaling Spatially\n      Aligned Tactile Pretraining",
          summary: "We present Spark-0,\n a model.\n\nIt uses touch.",
          published: "2026-10-16T17:59:58Z",
          primary: "cs.RO",
          categories: ["cs.RO", "cs.LG"],
          authors: ["Alice", "Bob"],
        }),
      ],
      1,
    );

    const parsed = parseArxivFeed(xml, "2026-10-17T00:00:00.000Z");
    expect(parsed.totalResults).toBe(1);
    expect(parsed.entries).toHaveLength(1);

    const article = parsed.entries[0];
    expect(article.title).toBe("Spark-0: Scaling Spatially Aligned Tactile Pretraining");
    expect(article.summary).toBe("We present Spark-0, a model. It uses touch.");
    expect(article.externalId).toBe("arxiv:2610.22342");
    expect(article.url).toBe("http://arxiv.org/abs/2610.22342v1");
    expect(article.category).toBe("physical-ai");
    expect(article.authors).toEqual(["Alice", "Bob"]);
    expect(article.tags).toEqual(["cs.RO", "cs.LG"]);
    // Content time comes from <published>, never from the fetch time.
    expect(article.publishedAt).toBe("2026-10-16T17:59:58.000Z");
    expect(article.fetchedAt).toBe("2026-10-17T00:00:00.000Z");
  });

  it("maps the primary category before cross-listed terms", () => {
    const xml = feed(
      [
        entry({
          id: "2610.00001",
          title: "Learning-based systems paper",
          published: "2026-10-16T00:00:00Z",
          primary: "cs.SE",
          categories: ["cs.SE", "math.CO"],
        }),
      ],
      1,
    );
    expect(parseArxivFeed(xml).entries[0].category).toBe("ai-cs");
  });

  it("parses legacy (old style) identifiers", () => {
    expect(arxivIdFromUrl("http://arxiv.org/abs/hep-ex/0307015v1")).toBe("hep-ex/0307015");
    expect(arxivIdFromUrl("http://arxiv.org/abs/hep-ex/0307015")).toBe("hep-ex/0307015");
    expect(arxivIdFromUrl("http://arxiv.org/abs/2401.12345v2")).toBe("2401.12345");
    expect(arxivIdFromUrl("http://arxiv.org/pdf/2401.12345v2.pdf")).toBe("2401.12345");
  });

  it("collapses whitespace in arbitrary fields", () => {
    expect(normalizeArxivText("  a \n  b\t c ")).toBe("a b c");
  });

  it("rejects a plain-text rate-limit body instead of returning zero results", () => {
    expect(() => parseArxivFeed("Rate exceeded.")).toThrow(/non-Atom response/);
  });

  it("rejects an HTML outage page instead of returning zero results", () => {
    const html = "<!DOCTYPE html><html><head><title>503</title></head><body>503</body></html>";
    expect(() => parseArxivFeed(html)).toThrow(/not an Atom feed/);
  });

  it("rejects an empty body", () => {
    expect(() => parseArxivFeed("   ")).toThrow(/empty response body/);
  });

  it("accepts a valid feed with zero entries", () => {
    expect(parseArxivFeed(feed([], 0))).toEqual({ totalResults: 0, entries: [] });
  });
});

describe("arXiv query construction", () => {
  it("uses only category terms on a full refresh", () => {
    const query = buildArxivQuery(undefined);
    expect(query).toContain("cat:cs.RO");
    expect(query).not.toContain("submittedDate");
  });

  it("builds an incremental submittedDate window with a 24h overlap", () => {
    const query = buildArxivQuery(
      "2026-10-16T12:00:00.000Z",
      new Date("2026-10-17T12:00:00.000Z"),
    );
    // 2026-10-16T12:00 minus 24h => 2026-10-15T12:00
    expect(query).toContain("submittedDate:[202610151200 TO 202610171200]");
  });

  it("treats an invalid watermark as a full refresh", () => {
    expect(buildArxivQuery("not-a-date")).not.toContain("submittedDate");
  });
});

describe("arXiv pagination", () => {
  it("walks pages with start/max_results until totalResults is reached", async () => {
    const requests: URL[] = [];
    const pages = [
      feed(
        [
          entry({ id: "2610.00003", title: "Third", published: "2026-10-16T03:00:00Z" }),
          entry({ id: "2610.00002", title: "Second", published: "2026-10-16T02:00:00Z" }),
        ],
        3,
      ),
      feed(
        [entry({ id: "2610.00001", title: "First", published: "2026-10-16T01:00:00Z" })],
        3,
        2,
      ),
    ];

    const result = await collectArxiv({
      pageSize: 2,
      fetchPage: (url) => {
        requests.push(new URL(url));
        return Promise.resolve(pages[requests.length - 1] ?? feed([], 3));
      },
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.get("start")).toBe("0");
    expect(requests[0].searchParams.get("max_results")).toBe("2");
    expect(requests[0].searchParams.get("sortBy")).toBe("submittedDate");
    expect(requests[0].searchParams.get("sortOrder")).toBe("descending");
    expect(requests[1].searchParams.get("start")).toBe("2");

    expect(result.articles.map((a) => a.externalId)).toEqual([
      "arxiv:2610.00003",
      "arxiv:2610.00002",
      "arxiv:2610.00001",
    ]);
    expect(result.itemsSeen).toBe(3);
    expect(result.totalResults).toBe(3);
    expect(result.pages).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("deduplicates repeated records across pages", async () => {
    const duplicate = entry({
      id: "2610.00009",
      title: "Duplicate",
      published: "2026-10-16T00:00:00Z",
    });
    const result = await collectArxiv({
      pageSize: 1,
      fetchPage: () => Promise.resolve(feed([duplicate], 5)),
    });

    expect(result.articles).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it("reports truncation and a safe resume point when the page cap is hit", async () => {
    const page = (n: number) =>
      feed(
        Array.from({ length: 2 }, (_, i) =>
          entry({
            id: `2610.0000${n}${i}`,
            title: `Item ${n}-${i}`,
            published: `2026-10-1${n}T0${i}:00:00Z`,
          }),
        ),
        50,
      );

    const result = await collectArxiv({
      pageSize: 2,
      maxPages: 2,
      fetchPage: () => Promise.resolve(page(2)),
    });

    expect(result.pages).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.articles).toHaveLength(2); // same ids returned twice -> deduped
    expect(result.oldestPublishedAt).toBe("2026-10-12T00:00:00.000Z");
  });

  it("stops when a short page signals the end of results", async () => {
    const result = await collectArxiv({
      pageSize: 10,
      fetchPage: () =>
        Promise.resolve(
          feed(
            [entry({ id: "2610.00001", title: "Only", published: "2026-10-16T00:00:00Z" })],
            1,
          ),
        ),
    });
    expect(result.pages).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("stops when the budget is exhausted", async () => {
    let calls = 0;
    const result = await collectArxiv({
      pageSize: 1,
      maxPages: 10,
      budgetMs: 20,
      fetchPage: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return feed(
          [entry({ id: `2610.0000${calls}`, title: `t${calls}`, published: "2026-10-16T00:00:00Z" })],
          100,
        );
      },
    });
    expect(result.pages).toBeLessThan(10);
    expect(result.truncated).toBe(true);
  });
});

describe("arXiv error handling", () => {
  it("turns HTTP 429 into an explicit rate-limit error", async () => {
    await expect(
      collectArxiv({
        fetchPage: () => Promise.reject(new HttpError("HTTP 429 from export.arxiv.org", 429)),
      }),
    ).rejects.toThrow(/rate limit \(HTTP 429\)/);
  });

  it("propagates other transport errors unchanged", async () => {
    await expect(
      collectArxiv({
        fetchPage: () => Promise.reject(new Error("Request timed out after 45000ms")),
      }),
    ).rejects.toThrow("Request timed out after 45000ms");
  });

  it("surfaces a malformed payload instead of silently returning no articles", async () => {
    await expect(
      collectArxiv({ fetchPage: () => Promise.resolve("Rate exceeded.") }),
    ).rejects.toThrow(/non-Atom response/);
  });

  it("keeps pages that already arrived when a later page fails", async () => {
    const first = feed(
      [
        entry({ id: "2610.00002", title: "Second", published: "2026-10-16T02:00:00Z" }),
        entry({ id: "2610.00001", title: "First", published: "2026-10-16T01:00:00Z" }),
      ],
      4,
    );
    let call = 0;
    const result = await collectArxiv({
      pageSize: 2,
      maxPages: 3,
      fetchPage: () => {
        call += 1;
        if (call === 1) return Promise.resolve(first);
        return Promise.reject(new HttpError("HTTP 503 from export.arxiv.org", 503));
      },
    });

    expect(result.articles).toHaveLength(2);
    expect(result.pages).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.warning).toContain("HTTP 503");
    expect(result.oldestPublishedAt).toBe("2026-10-16T01:00:00.000Z");
  });
});

describe("fetchWithRetry rate-limit policy", () => {
  it("retries 429 only as often as rateLimitRetries allows", async () => {
    const { fetchWithRetry } = await import("@/lib/server/http");
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        return new Response("Rate exceeded.", { status: 429 });
      }),
    );

    await expect(
      fetchWithRetry("https://export.arxiv.org/api/query", {
        allowHosts: ["export.arxiv.org"],
        retries: 2,
        rateLimitRetries: 1,
        rateLimitDelayMs: 5,
        baseDelayMs: 5,
      }),
    ).rejects.toThrow(/HTTP 429/);
    expect(attempts).toBe(2);
    vi.unstubAllGlobals();
  });

  it("retries 5xx up to the transport retry budget", async () => {
    const { fetchWithRetry } = await import("@/lib/server/http");
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        return new Response("<html>503</html>", { status: 503 });
      }),
    );

    await expect(
      fetchWithRetry("https://export.arxiv.org/api/query", {
        allowHosts: ["export.arxiv.org"],
        retries: 2,
        baseDelayMs: 5,
      }),
    ).rejects.toThrow(/HTTP 503/);
    expect(attempts).toBe(3);
    vi.unstubAllGlobals();
  });

  it("does not retry non-transient 4xx", async () => {
    const { fetchWithRetry } = await import("@/lib/server/http");
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        return new Response("bad request", { status: 400 });
      }),
    );

    await expect(
      fetchWithRetry("https://export.arxiv.org/api/query", {
        allowHosts: ["export.arxiv.org"],
        retries: 3,
      }),
    ).rejects.toThrow(/HTTP 400/);
    expect(attempts).toBe(1);
    vi.unstubAllGlobals();
  });
});

describe("arXiv provider contract", () => {
  it("serializes concurrent runs and spaces requests ≥3s apart", async () => {
    const startedAt: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const page = feed(
      [entry({ id: "2610.00001", title: "Only", published: "2026-10-16T00:00:00Z" })],
      1,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        startedAt.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        return new Response(page, {
          status: 200,
          headers: { "content-type": "application/atom+xml" },
        });
      }),
    );

    const [a, b] = await Promise.all([
      collectArxiv({ pageSize: 1, maxPages: 1 }),
      collectArxiv({ pageSize: 1, maxPages: 1 }),
    ]);

    expect(a.articles).toHaveLength(1);
    expect(b.articles).toHaveLength(1);
    expect(maxInFlight).toBe(1);
    expect(startedAt).toHaveLength(2);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(ARXIV_MIN_INTERVAL_MS - 100);

    vi.unstubAllGlobals();
  }, 20_000);

  it("honours the documented ≥3s request spacing", async () => {
    // Measure the real limiter used by the default fetcher.
    const { RateLimiter } = await import("@/lib/server/http");
    const limiter = new RateLimiter(ARXIV_MIN_INTERVAL_MS);
    const timestamps: number[] = [];
    for (let i = 0; i < 2; i += 1) {
      await limiter.wait();
      timestamps.push(Date.now());
    }
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(ARXIV_MIN_INTERVAL_MS - 25);
  });

  it("documents its pacing policy in the health check", () => {
    const health = arxivProvider.healthCheck();
    expect(health.health).toBe("ok");
    expect(health.message).toContain("3s");
  });

  it("exposes nextSince so a truncated run can resume safely", async () => {
    vi.stubEnv("ARXIV_API_URL", "https://export.arxiv.org/api/query");
    const result = await collectArxiv({
      pageSize: 1,
      maxPages: 1,
      fetchPage: () =>
        Promise.resolve(
          feed(
            [entry({ id: "2610.00001", title: "Only", published: "2026-10-16T00:00:00Z" })],
            500,
          ),
        ),
    });
    expect(result.truncated).toBe(true);
    expect(result.oldestPublishedAt).toBe("2026-10-16T00:00:00.000Z");
    vi.unstubAllEnvs();
  });
});
