import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry, RateLimiter } from "../http";
import { getServerConfig } from "../env";
import type { CategoryId } from "@/lib/types";
import type { FetchContext, ProviderResult, RawArticle } from "../types";
import { asArray } from "./base";

const ARXIV_HOST = "export.arxiv.org";

const QUERY_CATEGORIES = [
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

type TextNode = string | { "#text"?: string };

interface ArxivAuthor {
  name?: string;
}
interface ArxivCategory {
  "@_term"?: string;
}
interface ArxivLink {
  "@_href"?: string;
  "@_rel"?: string;
}
interface ArxivEntry {
  id?: TextNode;
  title?: TextNode;
  summary?: TextNode;
  published?: TextNode;
  updated?: TextNode;
  author?: ArxivAuthor | ArxivAuthor[];
  category?: ArxivCategory | ArxivCategory[];
  link?: ArxivLink | ArxivLink[];
}
interface ArxivFeed {
  feed?: { entry?: ArxivEntry | ArxivEntry[] };
}

function textOf(node: TextNode | undefined, fallback = ""): string {
  if (typeof node === "string") return node;
  return node?.["#text"] ?? fallback;
}

function mapArxivCategory(terms: string[]): CategoryId {
  const has = (prefix: string) =>
    terms.some((t) => t.startsWith(prefix));

  if (has("cs.RO")) return "physical-ai";
  if (has("math.") || has("cs.LO")) return "ai-math";
  if (
    has("cs.SE") ||
    has("cs.PL") ||
    has("cs.DB") ||
    has("cs.DC") ||
    has("cs.OS") ||
    has("cs.AR") ||
    has("cs.SY")
  ) {
    return "ai-cs";
  }
  if (has("cs.") || has("stat.ML")) return "ai-research";
  if (
    has("q-bio.") ||
    has("physics.") ||
    has("cond-mat.") ||
    has("astro-ph.") ||
    has("quant-ph") ||
    has("hep-") ||
    has("gr-qc") ||
    has("nucl-")
  ) {
    return "other-science";
  }
  return "other-science";
}

function arxivIdFromUrl(raw: string): string {
  // <id> looks like http://arxiv.org/abs/2401.12345v2
  const match = raw.match(/\/abs\/([^/]+)/);
  if (!match) return raw;
  return match[1].replace(/v\d+$/, "");
}

function toSinceFilter(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return stamp;
}

export const arxivProvider = {
  id: "arxiv" as const,
  name: "arXiv",

  async fetch(ctx: FetchContext): Promise<ProviderResult> {
    const config = getServerConfig();
    const limiter = new RateLimiter(config.minRequestIntervalMs);

    const searchTerms = QUERY_CATEGORIES.map((c) => `cat:${c}`).join(" OR ");
    const sinceFilter = toSinceFilter(ctx.since);
    const query = sinceFilter
      ? `(${searchTerms}) AND submittedDate:[${sinceFilter} TO 999912312359]`
      : searchTerms;

    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", query);
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", "50");

    const response = await fetchWithRetry(url.toString(), {
      allowHosts: [ARXIV_HOST],
      timeoutMs: 30000, // arXiv export API can be slow under load
      rateLimiter: limiter,
      retries: 2,
    });

    const xml = await response.text();
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
    }).parse(xml) as ArxivFeed;

    const entries = asArray(parsed.feed?.entry);
    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];

    for (const entry of entries) {
      const id = arxivIdFromUrl(textOf(entry.id));
      const title = textOf(entry.title, "Untitled");
      const summary = textOf(entry.summary);
      const published = textOf(entry.published);
      if (!id || !published) continue;

      const authors = asArray(entry.author)
        .map((a) => a.name ?? "")
        .filter(Boolean);

      const terms = asArray(entry.category)
        .map((c) => c["@_term"])
        .filter((t): t is string => Boolean(t));

      const links = asArray(entry.link);
      const absLink =
        links.find((l) => l["@_rel"] === "alternate")?.["@_href"] ??
        `https://arxiv.org/abs/${id}`;

      articles.push({
        provider: "arxiv",
        externalId: `arxiv:${id}`,
        title,
        summary,
        url: absLink,
        sourceName: "arXiv",
        category: mapArxivCategory(terms),
        publishedAt: published,
        fetchedAt,
        authors,
        tags: terms,
        raw: { id, terms, authors, published, updated: entry.updated },
      });
    }

    return {
      articles,
      itemsSeen: entries.length,
      truncated: entries.length >= 50,
    };
  },

  healthCheck() {
    return {
      health: "ok" as const,
      message: "arXiv export API is public and keyless (rate-limited by arXiv).",
    };
  },
};
