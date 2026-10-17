import type { CategoryId } from "@/lib/types";

/** Identifiers for the pluggable intelligence sources. */
export type ProviderId = "arxiv" | "arxiv-rss" | "github" | "rss" | "hackernews";

export type ProviderHealth =
  | "ok"
  | "degraded"
  | "error"
  | "disabled"
  | "unconfigured";

/** A normalized article before it is persisted. */
export interface RawArticle {
  provider: ProviderId;
  externalId: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  category: CategoryId;
  /** Content publication time as reported by the source. */
  publishedAt: string;
  /** Time at which SIGNAL fetched the content. */
  fetchedAt: string;
  authors: string[];
  tags: string[];
  /** Optional growth metrics (e.g. GitHub stars/forks). */
  metrics?: Record<string, number>;
  /** Original source payload, retained for traceability. */
  raw?: unknown;
}

export interface ProviderResult {
  articles: RawArticle[];
  /** Total number of source records inspected during this fetch. */
  itemsSeen: number;
  /** True when the source result was truncated / paginated. */
  truncated: boolean;
  /** Opaque cursor for the next incremental fetch. */
  cursor?: string;
  /** ETag / Last-Modified style token for conditional requests. */
  etag?: string;
  /**
   * Override the incremental watermark stored after this run. Used when a
   * provider stopped early (page cap / budget) and must resume from an older
   * point rather than from "now", so no records are skipped.
   */
  nextSince?: string;
  /** Non-fatal problems (e.g. a later page failed) recorded but not fatal. */
  warnings?: string[];
}

export interface FetchContext {
  /** ISO timestamp — fetch only items published/updated after this. */
  since?: string;
  cursor?: string;
  etag?: string;
}

export interface ProviderHealthCheck {
  health: ProviderHealth;
  message: string;
}

export interface IntelligenceProvider {
  id: ProviderId;
  name: string;
  fetch(ctx: FetchContext): Promise<ProviderResult>;
  healthCheck(): ProviderHealthCheck;
}

export interface StoredArticle {
  id: number;
  provider: ProviderId;
  externalId: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  category: CategoryId;
  publishedAt: string;
  fetchedAt: string;
  authors: string[];
  tags: string[];
  metrics: Record<string, number> | null;
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  health: ProviderHealth;
  message: string;
  /** False when automatic collection is paused via SIGNAL_DISABLED_PROVIDERS. */
  enabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastItemsSeen: number | null;
  lastItemsNew: number | null;
  lastError: string | null;
  /** Rows currently stored for this provider (historical data is kept). */
  storedArticles: number;
}

export interface SyncSummary {
  startedAt: string;
  finishedAt: string;
  runs: {
    provider: ProviderId;
    name: string;
    status: "success" | "error" | "unconfigured" | "disabled";
    itemsSeen: number;
    itemsNew: number;
    message: string | null;
  }[];
  totalNew: number;
}
