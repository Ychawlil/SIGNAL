import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry, HttpError, RateLimiter } from "../http";
import { getServerConfig } from "../env";
import type { CategoryId } from "@/lib/types";
import type { FetchContext, ProviderResult, RawArticle } from "../types";
import { asArray } from "./base";

/**
 * arXiv legacy API client.
 *
 * Follows https://info.arxiv.org/help/api/ (basics + user manual) and the
 * API terms of use (https://info.arxiv.org/help/api/tou.html):
 *   - at most one request every three seconds,
 *   - a single connection at a time,
 *   - paging through `start` / `max_results` (max 2000 per slice).
 */

export const ARXIV_DEFAULT_BASE_URL = "https://export.arxiv.org/api/query";
/** Official minimum spacing between legacy API requests. */
export const ARXIV_MIN_INTERVAL_MS = 3000;
/** Articles requested per page (arXiv allows up to 2000 per slice). */
export const ARXIV_PAGE_SIZE = 200;
/** Upper bound on pages fetched per sync run (200 * 4 = 800 records). */
export const ARXIV_MAX_PAGES = 4;
/** Soft deadline for a whole paged collection. */
const COLLECT_BUDGET_MS = 90_000;
/** Re-scan window so late announcements are not missed. Dedup absorbs repeats. */
const OVERLAP_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 6000;
/** arXiv sends no `Retry-After`; back off well past the 3s floor. */
const RATE_LIMIT_DELAY_MS = 15_000;
/**
 * arXiv's terms forbid working around rate limits, and a 429 from a shared IP
 * does not clear within a single run. Fail fast and let the scheduler retry on
 * its next tick instead of hammering the endpoint.
 */
const RATE_LIMIT_RETRIES = 0;

const CATEGORY_QUERIES = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "cs.NE",
  "cs.RO",
  "cs.SE",
  "cs.PL",
  "cs.DB",
  "cs.DC",
  "cs.OS",
  "cs.AR",
  "cs.SY",
  "cs.LO",
  "stat.ML",
  "math.AG",
  "math.CO",
  "math.NT",
  "math.LO",
  "math.CT",
  "math.GT",
];

/** cs.* sub-categories that describe AI systems / software engineering. */
const SYSTEMS_CATEGORIES = new Set([
  "cs.SE",
  "cs.PL",
  "cs.DB",
  "cs.DC",
  "cs.OS",
  "cs.AR",
  "cs.SY",
  "cs.ET",
  "cs.PF",
]);

const OTHER_SCIENCE_PREFIXES = [
  "q-bio.",
  "physics.",
  "cond-mat.",
  "astro-ph.",
  "quant-ph",
  "hep-",
  "gr-qc",
  "nucl-",
  "eess.",
  "econ.",
  "q-fin.",
];

/* ------------------------------------------------------------------ */
/* Response shapes                                                     */
/* ------------------------------------------------------------------ */

type TextNode = string | number | { "#text"?: string | number };

interface ArxivAuthor {
  name?: TextNode;
}
interface ArxivCategory {
  "@_term"?: string;
}
interface ArxivLink {
  "@_href"?: string;
  "@_rel"?: string;
  "@_type"?: string;
}
interface ArxivEntry extends Record<string, unknown> {
  id?: TextNode;
  title?: TextNode;
  summary?: TextNode;
  published?: TextNode;
  updated?: TextNode;
  author?: ArxivAuthor | ArxivAuthor[];
  category?: ArxivCategory | ArxivCategory[];
  link?: ArxivLink | ArxivLink[];
  "arxiv:primary_category"?: ArxivCategory;
  "arxiv:comment"?: TextNode;
  "arxiv:journal_ref"?: TextNode;
  "arxiv:doi"?: TextNode;
}
interface ArxivFeed {
  feed?: {
    title?: TextNode;
    entry?: ArxivEntry | ArxivEntry[];
    "opensearch:totalResults"?: TextNode;
    "opensearch:startIndex"?: TextNode;
    "opensearch:itemsPerPage"?: TextNode;
  };
}

export class ArxivResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArxivResponseError";
  }
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function textOf(node: TextNode | undefined, fallback = ""): string {
  if (node === undefined || node === null) return fallback;
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  const inner = node["#text"];
  if (inner === undefined) return fallback;
  return typeof inner === "number" ? String(inner) : inner;
}

/** arXiv wraps long titles/abstracts across lines — collapse the whitespace. */
export function normalizeArxivText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Extract the canonical arXiv identifier from an `<id>` URL.
 * Handles both new style (`/abs/2401.12345v2`) and legacy
 * (`/abs/hep-ex/0307015v1`) identifiers.
 */
export function arxivIdFromUrl(raw: string): string | null {
  const value = normalizeArxivText(raw);
  if (!value) return null;
  const match = value.match(/\/(?:abs|pdf)\/(.+)$/);
  const candidate = match ? match[1] : value;
  const cleaned = candidate
    .replace(/\.pdf$/, "")
    .replace(/v\d+$/, "")
    .replace(/\/+$/, "");
  return cleaned || null;
}

function categoryFor(primary: string | null, terms: string[]): CategoryId {
  const decide = (term: string | null | undefined): CategoryId | null => {
    if (!term) return null;
    if (term === "cs.RO") return "physical-ai";
    if (term.startsWith("math.") || term === "cs.LO") return "ai-math";
    if (SYSTEMS_CATEGORIES.has(term)) return "ai-cs";
    if (term.startsWith("cs.") || term === "stat.ML") return "ai-research";
    if (OTHER_SCIENCE_PREFIXES.some((prefix) => term.startsWith(prefix))) {
      return "other-science";
    }
    return null;
  };

  const direct = decide(primary);
  if (direct) return direct;
  for (const term of terms) {
    const mapped = decide(term);
    if (mapped) return mapped;
  }
  return "other-science";
}

/** Map an arXiv category term (primary first, then cross-lists) to a SIGNAL category. */
export function mapArxivCategory(primary: string | null, terms: string[]): CategoryId {
  return categoryFor(primary, terms);
}

export interface ParsedFeed {
  totalResults: number | null;
  entries: RawArticle[];
}

/**
 * Parse an arXiv Atom feed. Throws {@link ArxivResponseError} when the body is
 * not an Atom feed (arXiv answers rate limiting and outages with plain text or
 * HTML error pages, which must never be mistaken for "zero results").
 */
export function parseArxivFeed(xml: string, fetchedAt = new Date().toISOString()): ParsedFeed {
  const body = xml.trim();
  if (!body) throw new ArxivResponseError("arXiv returned an empty response body");
  if (!body.startsWith("<")) {
    throw new ArxivResponseError(
      `arXiv returned a non-Atom response: ${body.slice(0, 120)}`,
    );
  }

  let parsed: ArxivFeed;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: false,
    }).parse(body) as ArxivFeed;
  } catch (error) {
    throw new ArxivResponseError(
      `arXiv response could not be parsed as XML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const feed = parsed.feed;
  if (!feed) {
    throw new ArxivResponseError("arXiv response is not an Atom feed (missing <feed>)");
  }

  const totalParsed = Number.parseInt(textOf(feed["opensearch:totalResults"]), 10);
  const totalResults = Number.isFinite(totalParsed) ? totalParsed : null;

  const entries: RawArticle[] = [];
  for (const entry of asArray(feed.entry)) {
    const id = arxivIdFromUrl(textOf(entry.id));
    const rawPublished = textOf(entry.published) || textOf(entry.updated);
    const published = rawPublished ? new Date(rawPublished) : null;
    if (!id || !published || Number.isNaN(published.getTime())) continue;

    const title = normalizeArxivText(textOf(entry.title)) || "Untitled";
    const summary = normalizeArxivText(textOf(entry.summary));
    const authors = asArray(entry.author)
      .map((author) => normalizeArxivText(textOf(author?.name)))
      .filter(Boolean);

    const primaryTerm = entry["arxiv:primary_category"]?.["@_term"] ?? null;
    const terms = asArray(entry.category)
      .map((category) => category?.["@_term"])
      .filter((term): term is string => Boolean(term));
    const tags = [
      ...new Set([primaryTerm, ...terms].filter((term): term is string => Boolean(term))),
    ];

    const links = asArray(entry.link);
    const absLink =
      links.find((link) => link?.["@_rel"] === "alternate")?.["@_href"] ??
      `https://arxiv.org/abs/${id}`;

    entries.push({
      provider: "arxiv",
      externalId: `arxiv:${id}`,
      title,
      summary,
      url: absLink,
      sourceName: "arXiv",
      category: categoryFor(primaryTerm, terms),
      publishedAt: published.toISOString(),
      fetchedAt,
      authors,
      tags,
      raw: {
        id,
        primaryCategory: primaryTerm,
        categories: terms,
        authors,
        published: published.toISOString(),
        updated: normalizeArxivText(textOf(entry.updated)) || null,
        comment: normalizeArxivText(textOf(entry["arxiv:comment"])) || null,
        journalRef: normalizeArxivText(textOf(entry["arxiv:journal_ref"])) || null,
        doi: normalizeArxivText(textOf(entry["arxiv:doi"])) || null,
      },
    });
  }

  return { totalResults, entries };
}

/* ------------------------------------------------------------------ */
/* Query building                                                      */
/* ------------------------------------------------------------------ */

/** arXiv expects `YYYYMMDDHHmm` in UTC for `submittedDate` ranges. */
export function toArxivDateStamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`
  );
}

export function buildArxivQuery(since: string | undefined, now = new Date()): string {
  const terms = CATEGORY_QUERIES.map((category) => `cat:${category}`).join(" OR ");
  if (!since) return terms;

  const sinceDate = new Date(since);
  if (Number.isNaN(sinceDate.getTime())) return terms;

  // Re-scan an overlap window: arXiv announces submissions with a delay, and
  // re-fetched records are rejected by the (provider, external_id) constraint.
  const from = new Date(sinceDate.getTime() - OVERLAP_MS);
  return `(${terms}) AND submittedDate:[${toArxivDateStamp(from)} TO ${toArxivDateStamp(now)}]`;
}

/* ------------------------------------------------------------------ */
/* Request plumbing                                                    */
/* ------------------------------------------------------------------ */

let sharedLimiter: RateLimiter | null = null;
let sharedIntervalMs = 0;
let serialQueue: Promise<unknown> = Promise.resolve();

/** arXiv asks for one request at a time — serialize every call in-process. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = serialQueue.then(task, task);
  serialQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * One process-wide limiter keeps arXiv requests at the documented
 * spacing (≥3s), regardless of how many syncs are triggered.
 */
function arxivIntervalMs(): number {
  const configured = getServerConfig().minRequestIntervalMs;
  return Math.max(ARXIV_MIN_INTERVAL_MS, Number.isFinite(configured) ? configured : 0);
}

function arxivLimiter(): RateLimiter {
  const interval = arxivIntervalMs();
  if (!sharedLimiter || sharedIntervalMs !== interval) {
    sharedLimiter = new RateLimiter(interval);
    sharedIntervalMs = interval;
  }
  return sharedLimiter;
}

function resolveBaseUrl(): { url: string; host: string } {
  const raw = process.env.ARXIV_API_URL?.trim() || ARXIV_DEFAULT_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ArxivResponseError(`Invalid ARXIV_API_URL: ${raw}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ArxivResponseError(`ARXIV_API_URL must be http(s), got ${parsed.protocol}`);
  }
  return { url: parsed.toString(), host: parsed.hostname };
}

export type ArxivPageFetcher = (url: string) => Promise<string>;

const defaultPageFetcher: ArxivPageFetcher = (url) =>
  serialized(async () => {
    const { host } = resolveBaseUrl();
    const response = await fetchWithRetry(url, {
      allowHosts: [host],
      timeoutMs: REQUEST_TIMEOUT_MS,
      rateLimiter: arxivLimiter(),
      retries: RETRY_ATTEMPTS,
      rateLimitRetries: RATE_LIMIT_RETRIES,
      baseDelayMs: RETRY_BASE_DELAY_MS,
      rateLimitDelayMs: RATE_LIMIT_DELAY_MS,
      headers: { accept: "application/atom+xml" },
    });
    return response.text();
  });

/* ------------------------------------------------------------------ */
/* Collection                                                          */
/* ------------------------------------------------------------------ */

export interface CollectOptions {
  since?: string;
  now?: Date;
  fetchPage?: ArxivPageFetcher;
  pageSize?: number;
  maxPages?: number;
  budgetMs?: number;
}

export interface CollectResult {
  articles: RawArticle[];
  itemsSeen: number;
  truncated: boolean;
  totalResults: number | null;
  pages: number;
  /** Oldest publication time collected — a safe resume point when truncated. */
  oldestPublishedAt: string | null;
  /** Non-fatal problem that stopped paging after at least one page landed. */
  warning?: string;
}

/**
 * Page through an arXiv query with official `start` / `max_results` semantics.
 * Stops on: empty page, short page, `totalResults` reached, page cap, or budget.
 */
export async function collectArxiv(options: CollectOptions = {}): Promise<CollectResult> {
  const fetchPage = options.fetchPage ?? defaultPageFetcher;
  const pageSize = Math.min(2000, Math.max(1, options.pageSize ?? ARXIV_PAGE_SIZE));
  const maxPages = Math.max(1, options.maxPages ?? ARXIV_MAX_PAGES);
  const budgetMs = options.budgetMs ?? COLLECT_BUDGET_MS;
  const now = options.now ?? new Date();
  const deadline = Date.now() + budgetMs;

  const base = resolveBaseUrl();
  const query = buildArxivQuery(options.since, now);
  const fetchedAt = now.toISOString();

  const articles: RawArticle[] = [];
  const seenIds = new Set<string>();
  let itemsSeen = 0;
  let totalResults: number | null = null;
  let pages = 0;
  let start = 0;
  let truncated = false;
  let warning: string | undefined;

  while (pages < maxPages) {
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }

    const url = new URL(base.url);
    url.searchParams.set("search_query", query);
    url.searchParams.set("start", String(start));
    url.searchParams.set("max_results", String(pageSize));
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");

    let xml: string;
    try {
      xml = await fetchPage(url.toString());
    } catch (error) {
      // Nothing collected yet: fail the run so the stored data is untouched.
      if (pages === 0) {
        if (error instanceof HttpError && error.status === 429) {
          throw new HttpError(
            "arXiv rate limit (HTTP 429). Requests are paced at ≥3s; retry later. Existing data is preserved.",
            429,
          );
        }
        throw error;
      }
      // At least one page is already in hand — keep it and resume next run.
      truncated = true;
      warning =
        `Paging stopped after ${pages} page(s): ` +
        `${error instanceof Error ? error.message : String(error)}`;
      break;
    }

    const parsed = parseArxivFeed(xml, fetchedAt);
    pages += 1;
    itemsSeen += parsed.entries.length;
    if (parsed.totalResults !== null) totalResults = parsed.totalResults;

    for (const article of parsed.entries) {
      if (seenIds.has(article.externalId)) continue;
      seenIds.add(article.externalId);
      articles.push(article);
    }

    start += parsed.entries.length;

    if (parsed.entries.length === 0) break;
    if (parsed.entries.length < pageSize) break;
    if (totalResults !== null && start >= totalResults) break;
    if (pages >= maxPages) {
      truncated = totalResults === null || start < totalResults;
      break;
    }
  }

  const oldestPublishedAt = articles.reduce<string | null>((oldest, article) => {
    if (!oldest) return article.publishedAt;
    return article.publishedAt < oldest ? article.publishedAt : oldest;
  }, null);

  return { articles, itemsSeen, truncated, totalResults, pages, oldestPublishedAt, warning };
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export const arxivProvider = {
  id: "arxiv" as const,
  name: "arXiv",

  async fetch(ctx: FetchContext): Promise<ProviderResult> {
    const result = await collectArxiv({ since: ctx.since });

    return {
      articles: result.articles,
      itemsSeen: result.itemsSeen,
      truncated: result.truncated,
      // When truncation stops the walk, resume from the oldest item fetched
      // instead of jumping the watermark to "now", so nothing is skipped.
      nextSince: result.truncated
        ? (result.oldestPublishedAt ?? ctx.since ?? undefined)
        : undefined,
      warnings: result.warning ? [result.warning] : undefined,
    };
  },

  healthCheck() {
    return {
      health: "ok" as const,
      message:
        "arXiv export API (public, keyless). Pacing: ≥3s between requests, " +
        `${ARXIV_PAGE_SIZE} results/page, ≤${ARXIV_MAX_PAGES} pages per run ` +
        `(limiter ${arxivIntervalMs()}ms).`,
    };
  },
};
