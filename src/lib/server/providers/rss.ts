import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry, RateLimiter } from "../http";
import { getServerConfig } from "../env";
import type { CategoryId } from "@/lib/types";
import type { ProviderResult, RawArticle } from "../types";
import { asArray, stripTags } from "./base";

/**
 * Generic RSS / Atom provider for official blogs, lab pages and tech media.
 * Feeds are configured via the RSS_FEEDS environment variable. Every feed URL
 * is SSRF-validated (scheme + public IP) before fetching.
 */

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj["#text"] ?? obj["@_href"] ?? "");
  }
  return "";
}

function linkOf(value: unknown, fallback: string): string {
  const text = textOf(value);
  if (text) return text;
  if (value && typeof value === "object") {
    const links = asArray<Record<string, unknown>>(
      (value as Record<string, unknown>)["link"] as never,
    );
    for (const link of links) {
      const href = link?.["@_href"] ?? link?.["@_rel"];
      if (href) return String(href);
    }
  }
  return fallback;
}

function validIso(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pickDate(item: Record<string, unknown>): string | null {
  for (const key of ["published", "updated", "pubDate", "dc:date", "date"]) {
    const value = textOf(item[key]);
    if (value) {
      const iso = validIso(value);
      if (iso) return iso;
    }
  }
  return null;
}

function categoryFromFeed(title: string, host: string): CategoryId {
  const t = `${title} ${host}`.toLowerCase();
  if (/(robot|vla|embodied|physical)/.test(t)) return "physical-ai";
  if (/(theorem|formal|math)/.test(t)) return "ai-math";
  if (/(agent|coding|software)/.test(t)) return "agents-coding";
  if (/(system|compiler|database|infrastructure)/.test(t)) return "ai-cs";
  if (/(ai|machine|model|llm|deep)/.test(t)) return "ai-research";
  return "other-science";
}

function parseFeed(xml: string): {
  title: string;
  host: string;
  items: Record<string, unknown>[];
} {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  }).parse(xml) as Record<string, unknown>;

  const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
    | Record<string, unknown>
    | undefined;
  if (channel) {
    const items = asArray<Record<string, unknown>>(channel.item as never);
    return { title: textOf(channel.title), host: "", items };
  }

  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed) {
    const entries = asArray<Record<string, unknown>>(feed.entry as never);
    return { title: textOf(feed.title), host: "", items: entries };
  }

  return { title: "", host: "", items: [] };
}

export const rssProvider = {
  id: "rss" as const,
  name: "RSS / Blogs",

  async fetch(): Promise<ProviderResult> {
    const config = getServerConfig();
    const limiter = new RateLimiter(config.minRequestIntervalMs);
    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];
    let itemsSeen = 0;
    let succeededFeeds = 0;

    for (const feedUrl of config.rssFeeds) {
      // A single unreachable feed must not fail the whole provider.
      try {
        const response = await fetchWithRetry(feedUrl, {
          timeoutMs: config.requestTimeoutMs,
          rateLimiter: limiter,
          retries: 2,
          allowHosts: [], // validated against public-IP rules only
        });
        const xml = await response.text();
        const feed = parseFeed(xml);
        let host = "";
        try {
          host = new URL(feedUrl).hostname;
        } catch {
          // ignore
        }
        const feedCategory = categoryFromFeed(feed.title, host);
        succeededFeeds += 1;

        const parsed = feed.items
          .map((item) => {
            const published = pickDate(item);
            // Never substitute the fetch time for a missing content time.
            if (!published) return null;
            const title = textOf(item.title) || textOf(item["dc:title"]) || "Untitled";
            const summary =
              textOf(item.description) ||
              textOf(item.summary) ||
              stripTags(textOf(item["content:encoded"] || item.content || ""));
            const guid = textOf(item.guid) || textOf(item.id) || "";
            const link = linkOf(item.link ?? item, feedUrl);
            if (!/^https?:\/\//i.test(link)) return null;
            return { published, title, summary, guid, link };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.published.localeCompare(a.published))
          .slice(0, 30); // keep only the most recent items per feed

        for (const item of parsed) {
          articles.push({
            provider: "rss",
            externalId: `rss:${item.guid || item.link}`,
            title: stripTags(item.title).slice(0, 300),
            summary: item.summary.slice(0, 4000),
            url: item.link,
            sourceName: feed.title || host || "RSS",
            category: feedCategory,
            publishedAt: item.published,
            fetchedAt,
            authors: [],
            tags: ["rss", host],
            raw: { title: item.title, link: item.link, published: item.published },
          });
        }
        itemsSeen += feed.items.length;
      } catch (error) {
        console.warn(`[rss] failed to fetch feed ${feedUrl}:`, error instanceof Error ? error.message : error);
      }
    }

    if (succeededFeeds === 0 && config.rssFeeds.length > 0) {
      throw new Error("all configured RSS feeds failed to fetch");
    }

    return { articles, itemsSeen, truncated: false };
  },

  healthCheck() {
    const config = getServerConfig();
    if (config.rssFeeds.length === 0) {
      return {
        health: "unconfigured" as const,
        message: "No RSS feeds configured. Set RSS_FEEDS (comma-separated URLs).",
      };
    }
    return {
      health: "ok" as const,
      message: `${config.rssFeeds.length} feed(s) configured.`,
    };
  },
};
