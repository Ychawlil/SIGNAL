import { describe, expect, it } from "vitest";
import {
  arxivIdFromRssItem,
  parseArxivRssFeed,
} from "@/lib/server/providers/arxiv-rss";

/** Mirrors the real rss.arxiv.org/rss/<category> layout. */
function channel(items: string[], extra = ""): string {
  return `<?xml version='1.0' encoding='UTF-8'?>
<rss xmlns:arxiv="http://arxiv.org/schemas/atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
  <channel>
    <title>cs.AI updates on arXiv.org</title>
    <link>http://rss.arxiv.org/rss/cs.AI</link>
    <description>cs.AI updates on the arXiv.org e-print archive.</description>
    <lastBuildDate>Sat, 17 Oct 2026 04:00:00 +0000</lastBuildDate>
    <pubDate>Sat, 17 Oct 2026 00:00:00 -0400</pubDate>
${extra}
${items.join("\n")}
  </channel>
</rss>`;
}

const ITEM = `    <item>
      <title>The World Won't Wait: Evaluating and Teaching Agents Under a Live Clock</title>
      <link>https://arxiv.org/abs/2610.20665</link>
      <description>arXiv:2610.20665v1 Announce Type: new
Abstract: Large language model (LLM) agents can solve complex interactive tasks.</description>
      <guid isPermaLink="false">oai:arXiv.org:2610.20665v1</guid>
      <category>cs.AI</category>
      <pubDate>Sat, 17 Oct 2026 00:00:00 -0400</pubDate>
      <arxiv:announce_type>new</arxiv:announce_type>
      <dc:creator>Ningxin Pan, Hanyu Li</dc:creator>
    </item>`;

describe("arXiv RSS parsing", () => {
  it("parses items with the announcement date as the content time", () => {
    const parsed = parseArxivRssFeed(channel([ITEM]), "2026-10-17T05:00:00.000Z");
    expect(parsed.channelTitle).toBe("cs.AI updates on arXiv.org");
    expect(parsed.entries).toHaveLength(1);

    const entry = parsed.entries[0];
    expect(entry.externalId).toBe("arxiv:2610.20665");
    expect(entry.title).toBe(
      "The World Won't Wait: Evaluating and Teaching Agents Under a Live Clock",
    );
    // The RSS metadata prefix is stripped from the abstract.
    expect(entry.summary).toBe(
      "Large language model (LLM) agents can solve complex interactive tasks.",
    );
    expect(entry.category).toBe("ai-research");
    expect(entry.authors).toEqual(["Ningxin Pan", "Hanyu Li"]);
    expect(entry.provider).toBe("arxiv-rss");
    expect(entry.url).toBe("https://arxiv.org/abs/2610.20665");
    // pubDate (-04:00) == 04:00Z, not the fetch time.
    expect(entry.publishedAt).toBe("2026-10-17T04:00:00.000Z");
    expect(entry.fetchedAt).toBe("2026-10-17T05:00:00.000Z");
  });

  it("handles an empty channel (arXiv skips weekends)", () => {
    expect(parseArxivRssFeed(channel([]))).toEqual({
      entries: [],
      channelTitle: "cs.AI updates on arXiv.org",
    });
  });

  it("derives ids from the guid when the link is missing", () => {
    expect(
      arxivIdFromRssItem({
        guid: "oai:arXiv.org:2610.20665v2",
      }),
    ).toBe("2610.20665");
    expect(
      arxivIdFromRssItem({ link: "https://arxiv.org/abs/hep-ex/0307015v1" }),
    ).toBe("hep-ex/0307015");
    expect(arxivIdFromRssItem({})).toBeNull();
  });

  it("maps robotics papers to physical-ai", () => {
    const parsed = parseArxivRssFeed(
      channel([ITEM.replace("<category>cs.AI</category>", "<category>cs.RO</category>")]),
    );
    expect(parsed.entries[0].category).toBe("physical-ai");
  });

  it("rejects non-RSS bodies", () => {
    expect(() => parseArxivRssFeed("Rate exceeded.")).toThrow(/non-XML/);
    expect(() => parseArxivRssFeed("<html><body>503</body></html>")).toThrow(
      /not an RSS channel/,
    );
  });
});
