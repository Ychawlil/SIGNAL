import "server-only";
import type { ProviderId } from "./types";

/**
 * Server-only configuration. API keys are read exclusively from
 * process.env and never shipped to the client bundle.
 */
export interface ServerConfig {
  /** Optional GitHub personal access token (raises API limits). */
  githubToken: string | undefined;
  /** Comma-separated allowlisted RSS feed URLs. */
  rssFeeds: string[];
  /** arXiv RSS categories to follow (e.g. cs.AI). */
  arxivRssCategories: string[];
  /**
   * Sources whose automatic collection is paused. Historical rows are kept
   * and the manual "Sync now" button skips them.
   */
  disabledProviders: ProviderId[];
  /** Optional SQLite database path override. */
  dbPath: string | undefined;
  /** Per-request timeout in ms. */
  requestTimeoutMs: number;
  /** Minimum interval between outbound HTTP requests (rate limiting). */
  minRequestIntervalMs: number;
}

const ALL_PROVIDERS: ProviderId[] = ["arxiv", "arxiv-rss", "github", "rss", "hackernews"];

/** Default arXiv RSS categories when ARXIV_RSS_CATEGORIES is not set. */
export const DEFAULT_ARXIV_RSS_CATEGORIES = ["cs.AI", "cs.LG", "cs.RO", "cs.CL", "cs.SE"];

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return undefined;
  return value.trim();
}

function readList(name: string): string[] {
  return (
    read(name)
      ?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? []
  );
}

export function getServerConfig(): ServerConfig {
  const disabled = readList("SIGNAL_DISABLED_PROVIDERS")
    .map((entry) => entry.toLowerCase())
    .filter((entry): entry is ProviderId =>
      ALL_PROVIDERS.includes(entry as ProviderId),
    );

  return {
    githubToken: read("GITHUB_TOKEN"),
    rssFeeds: readList("RSS_FEEDS"),
    arxivRssCategories: readList("ARXIV_RSS_CATEGORIES").length
      ? readList("ARXIV_RSS_CATEGORIES")
      : [...DEFAULT_ARXIV_RSS_CATEGORIES],
    disabledProviders: [...new Set(disabled)],
    dbPath: read("SIGNAL_DB_PATH"),
    requestTimeoutMs: Number(read("SIGNAL_REQUEST_TIMEOUT_MS") ?? 15000),
    minRequestIntervalMs: Number(read("SIGNAL_MIN_REQUEST_INTERVAL_MS") ?? 1000),
  };
}

export function isProviderEnabled(id: ProviderId): boolean {
  return !getServerConfig().disabledProviders.includes(id);
}
