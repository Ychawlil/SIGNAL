import "server-only";

/**
 * Server-only configuration. API keys are read exclusively from
 * process.env and never shipped to the client bundle.
 */
export interface ServerConfig {
  /** Optional GitHub personal access token (raises API limits). */
  githubToken: string | undefined;
  /** Comma-separated allowlisted RSS feed URLs. */
  rssFeeds: string[];
  /** Optional SQLite database path override. */
  dbPath: string | undefined;
  /** Per-request timeout in ms. */
  requestTimeoutMs: number;
  /** Minimum interval between outbound HTTP requests (rate limiting). */
  minRequestIntervalMs: number;
}

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return undefined;
  return value.trim();
}

export function getServerConfig(): ServerConfig {
  const rssFeeds = read("RSS_FEEDS")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

  return {
    githubToken: read("GITHUB_TOKEN"),
    rssFeeds,
    dbPath: read("SIGNAL_DB_PATH"),
    requestTimeoutMs: Number(read("SIGNAL_REQUEST_TIMEOUT_MS") ?? 15000),
    minRequestIntervalMs: Number(read("SIGNAL_MIN_REQUEST_INTERVAL_MS") ?? 1000),
  };
}
