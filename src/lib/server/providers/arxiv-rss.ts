import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry, HttpError, RateLimiter } from "../http";
import { getServerConfig, isProviderEnabled } from "../env";
import type { ProviderResult, RawArticle } from "../types";
import { asArray } from "./base";
import { ARXIV_MIN_INTERVAL_MS, mapArxivCategory, normalizeArxivText } from "./arxiv";

/**
 * arXiv daily announcement feeds (https://rss.arxiv.org/rss/<category>).
 *
 * Used as the primary paper source while the legacy export API is paused for
 * rate limiting. RSS is part of arXiv's legacy APIs, so the same pacing rules
 * apply: one request every ≥3s, one at a time.
 */

export const ARXIV_RSS_HOST = "rss.arxiv.org";
const REQUEST_TIMEOUT_MS = 90_000;
const RETRY_ATTEMPTS = 1;
const RETRY_BASE_DELAY_MS = 5000;
/** Safety cap per feed — the cs.AI feed currently carries ~450 items/day. */
const MAX_ITEMS_PER_FEED = 500;

type TextNode = string | number | { "#text"?: string | number };

interface RssItem {
  title?: TextNode;
  link?: TextNode;
  description?: TextNode;
  guid?: TextNode;
  category?: TextNode | TextNode[];
  pubDate?: TextNode;
  "dc:creator"?: TextNode;
  "arxiv:announce_type"?: TextNode;
}

interface RssChannel {
  rss?: {
    channel?: {
      title?: TextNode;
      item?: RssItem | RssItem[];
      lastBuildDate?: TextNode;
      pubDate?: TextNode;
      "skipDays"?: unknown;
    };
  };
}

export class ArxivRssError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArxivRssError";
  }
}

function textOf(node: TextNode | undefined, fallback = ""): string {
  if (node === undefined || node === null) return fallback;
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  const inner = node["#text"];
  if (inner === undefined) return fallback;
  return typeof inner === "number" ? String(inner) : inner;
}

/** Extract the version-less arXiv id from a link or `oai:arXiv.org:` guid. */
export function arxivIdFromRssItem(item: RssItem): string | null {
  const link = normalizeArxivText(textOf(item.link));
  const linkMatch = link.match(/\/(?:abs|pdf)\/(.+)$/);
  if (linkMatch) {
    return (
      linkMatch[1]
        .replace(/\.pdf$/, "")
        .replace(/v\d+$/, "")
        .replace(/\/+$/, "") || null
    );
  }
  const guid = normalizeArxivText(textOf(item.guid));
  const guidMatch = guid.match(/arXiv\.org:([^v]+?)(?:v\d+)?$/i);
  if (guidMatch) return guidMatch[1].replace(/\.pdf$/, "");
  return null;
}

function descriptionToAbstract(raw: string): string {
  // arXiv prefixes the abstract with "arXiv:ID Announce Type: new" metadata.
  const marker = raw.search(/Abstract:/i);
  const body = marker >= 0 ? raw.slice(marker).replace(/^Abstract:\s*/i, "") : raw;
  return body.replace(/\s+/g, " ").trim();
}

export function parseArxivRssFeed(
  xml: string,
  fetchedAt = new Date().toISOString(),
): { entries: RawArticle[]; channelTitle: string } {
  const body = xml.trim();
  if (!body.startsWith("<")) {
    throw new ArxivRssError(
      `arXiv RSS returned a non-XML response: ${body.slice(0, 120)}`,
    );
  }

  let parsed: RssChannel;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: false,
    }).parse(body) as RssChannel;
  } catch (error) {
    throw new ArxivRssError(
      `arXiv RSS could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const channel = parsed.rss?.channel;
  if (!channel) throw new ArxivRssError("arXiv RSS response is not an RSS channel");

  const channelTitle = normalizeArxivText(textOf(channel.title));
  const entries: RawArticle[] = [];

  for (const item of asArray(channel.item).slice(0, MAX_ITEMS_PER_FEED)) {
    const id = arxivIdFromRssItem(item);
    if (!id) continue;

    const title = normalizeArxivText(textOf(item.title)) || "Untitled";
    const summary = descriptionToAbstract(textOf(item.description));

    // The feed's pubDate is the announcement date, never the fetch time.
    const rawPublished = normalizeArxivText(textOf(item.pubDate)) || normalizeArxivText(
      textOf(channel.lastBuildDate),
    );
    const published = rawPublished ? new Date(rawPublished) : null;
    if (!published || Number.isNaN(published.getTime())) continue;

    const primary = normalizeArxivText(textOf(asArray(item.category)[0] as TextNode | undefined));
    const terms = asArray(item.category)
      .map((entry) => normalizeArxivText(textOf(entry)))
      .filter(Boolean);

    const creators = normalizeArxivText(textOf(item["dc:creator"]));
    const authors = creators
      ? creators.split(",").map((name) => name.trim()).filter(Boolean)
      : [];

    entries.push({
      provider: "arxiv-rss",
      externalId: `arxiv:${id}`,
      title,
      summary,
      url: normalizeArxivText(textOf(item.link)) || `https://arxiv.org/abs/${id}`,
      sourceName: "arXiv RSS",
      category: mapArxivCategory(primary || null, terms),
      publishedAt: published.toISOString(),
      fetchedAt,
      authors,
      tags: [...new Set(terms)],
      raw: {
        id,
        primaryCategory: primary || null,
        categories: terms,
        announceType: normalizeArxivText(textOf(item["arxiv:announce_type"])) || null,
        published: published.toISOString(),
      },
    });
  }

  return { entries, channelTitle };
}

/* ------------------------------------------------------------------ */
/* Request plumbing                                                    */
/* ------------------------------------------------------------------ */

let sharedLimiter: RateLimiter | null = null;
let sharedIntervalMs = 0;
let serialQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = serialQueue.then(task, task);
  serialQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function intervalMs(): number {
  const configured = getServerConfig().minRequestIntervalMs;
  return Math.max(ARXIV_MIN_INTERVAL_MS, Number.isFinite(configured) ? configured : 0);
}

function limiter(): RateLimiter {
  const interval = intervalMs();
  if (!sharedLimiter || sharedIntervalMs !== interval) {
    sharedLimiter = new RateLimiter(interval);
    sharedIntervalMs = interval;
  }
  return sharedLimiter;
}

export function feedUrlForCategory(category: string): string {
  const base = process.env.ARXIV_RSS_BASE_URL?.trim() || `https://${ARXIV_RSS_HOST}/rss`;
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(category)}`;
}

async function fetchFeed(url: string): Promise<string> {
  return serialized(async () => {
    const host = new URL(url).hostname;
    const response = await fetchWithRetry(url, {
      allowHosts: [host],
      timeoutMs: REQUEST_TIMEOUT_MS,
      rateLimiter: limiter(),
      retries: RETRY_ATTEMPTS,
      baseDelayMs: RETRY_BASE_DELAY_MS,
      headers: { accept: "application/rss+xml" },
    });
    return response.text();
  });
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export const arxivRssProvider = {
  id: "arxiv-rss" as const,
  name: "arXiv RSS",

  async fetch(): Promise<ProviderResult> {
    const config = getServerConfig();
    const categories = config.arxivRssCategories;
    if (categories.length === 0) {
      return { articles: [], itemsSeen: 0, truncated: false };
    }

    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];
    const seen = new Set<string>();
    const warnings: string[] = [];
    let itemsSeen = 0;
    let failures = 0;

    for (const category of categories) {
      try {
        const xml = await fetchFeed(feedUrlForCategory(category));
        const parsed = parseArxivRssFeed(xml, fetchedAt);
        itemsSeen += parsed.entries.length;
        for (const article of parsed.entries) {
          if (seen.has(article.externalId)) continue;
          seen.add(article.externalId);
          articles.push(article);
        }
      } catch (error) {
        failures += 1;
        warnings.push(
          `${category}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (error instanceof HttpError && error.status === 429) {
          // Back off rather than hammer a rate-limited endpoint.
          break;
        }
      }
    }

    // Every feed failed and nothing was collected: surface it as a real error
    // so the run is recorded and the previous data is preserved.
    if (failures === categories.length && articles.length === 0) {
      throw new ArxivRssError(
        `All ${categories.length} arXiv RSS feed(s) failed: ${warnings[0] ?? "unknown error"}`,
      );
    }

    return {
      articles,
      itemsSeen,
      truncated: articles.length >= categories.length * MAX_ITEMS_PER_FEED,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  healthCheck() {
    if (!isProviderEnabled("arxiv-rss")) {
      return {
        health: "disabled" as const,
        message: "已暂停 arXiv RSS 采集（SIGNAL_DISABLED_PROVIDERS）。",
      };
    }
    const categories = getServerConfig().arxivRssCategories;
    if (categories.length === 0) {
      return {
        health: "unconfigured" as const,
        message: "未配置 arXiv RSS 分类（ARXIV_RSS_CATEGORIES）。",
      };
    }
    return {
      health: "ok" as const,
      message:
        `${categories.length} 个 arXiv 每日公告 RSS（${categories.join(", ")}），` +
        `请求间隔 ≥${intervalMs()}ms。`,
    };
  },
};
