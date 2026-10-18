import "server-only";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getServerConfig } from "./env";
import { canonicalizeUrl } from "./url-guard";
import type { ProviderId, RawArticle, StoredArticle } from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  source_name TEXT NOT NULL,
  category TEXT NOT NULL,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  metrics TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(provider, external_id),
  UNIQUE(url_hash)
);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_provider ON articles(provider);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  truncated INTEGER NOT NULL DEFAULT 0,
  cursor TEXT,
  etag TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_provider ON ingestion_runs(provider, started_at DESC);

CREATE TABLE IF NOT EXISTS provider_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  run_id INTEGER,
  message TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_errors_provider ON provider_errors(provider, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_state (
  provider TEXT PRIMARY KEY,
  etag TEXT,
  last_cursor TEXT,
  last_since TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS analyses (
  article_id INTEGER PRIMARY KEY,
  one_liner TEXT NOT NULL,
  key_change TEXT NOT NULL DEFAULT '',
  differences TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  personal_relevance TEXT NOT NULL DEFAULT '',
  further_reading TEXT NOT NULL DEFAULT '[]',
  importance_score INTEGER NOT NULL,
  importance_factors TEXT NOT NULL DEFAULT '{}',
  evidence_basis TEXT NOT NULL DEFAULT 'none',
  is_model_release INTEGER NOT NULL DEFAULT 0,
  model_family TEXT,
  analyzed_at TEXT NOT NULL,
  FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_analyses_importance ON analyses(importance_score DESC);

CREATE TABLE IF NOT EXISTS model_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT,
  source_article_id INTEGER,
  reasoning TEXT,
  math TEXT,
  coding TEXT,
  multimodal TEXT,
  agent TEXT,
  params TEXT,
  context_length TEXT,
  latency TEXT,
  cost TEXT,
  open_weights INTEGER,
  api_available INTEGER,
  license TEXT,
  deployment TEXT,
  benchmarks TEXT NOT NULL DEFAULT '[]',
  eval_note TEXT NOT NULL DEFAULT '',
  claim_origin TEXT NOT NULL DEFAULT 'unknown',
  updated_at TEXT NOT NULL,
  UNIQUE(family, version)
);
CREATE INDEX IF NOT EXISTS idx_models_family ON model_versions(family);

CREATE TABLE IF NOT EXISTS briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  article_ids TEXT NOT NULL DEFAULT '[]',
  UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS github_repos (
  full_name TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  language TEXT,
  license TEXT,
  homepage TEXT,
  topics TEXT NOT NULL DEFAULT '[]',
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  pushed_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  is_fork INTEGER NOT NULL DEFAULT 0,
  has_readme INTEGER,
  has_releases INTEGER,
  last_fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_repos_stars ON github_repos(stars DESC);

CREATE TABLE IF NOT EXISTS repo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo TEXT NOT NULL,
  stars INTEGER NOT NULL,
  forks INTEGER NOT NULL,
  open_issues INTEGER NOT NULL,
  sampled_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_repo ON repo_snapshots(repo, sampled_at);

CREATE TABLE IF NOT EXISTS saved_items (
  article_id INTEGER PRIMARY KEY,
  saved_at TEXT NOT NULL,
  status TEXT,
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_saved_status ON saved_items(status);

CREATE TABLE IF NOT EXISTS custom_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  topic_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, article_id),
  FOREIGN KEY(collection_id) REFERENCES research_collections(id) ON DELETE CASCADE,
  FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  week_start TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result_json TEXT,
  error TEXT,
  skipped_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_task_runs ON task_runs(task, started_at DESC);

CREATE TABLE IF NOT EXISTS task_locks (
  task TEXT PRIMARY KEY,
  acquired_at TEXT NOT NULL,
  lease_until TEXT NOT NULL
);

-- User-managed focus weights. These drive the relevance factor of importance.
CREATE TABLE IF NOT EXISTS focus_weights (
  topic TEXT PRIMARY KEY,
  weight INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- Legacy category id migration: 'x-signals' -> 'signals'.
UPDATE articles SET category = 'signals' WHERE category = 'x-signals';
`;

let db: DatabaseSync | null = null;

/**
 * Drops columns that were removed from the schema. They hold derived,
 * recomputable values only, so no historical intelligence is lost.
 */
function dropLegacyColumns(database: DatabaseSync): void {
  const columns = (
    database.prepare(`SELECT name FROM pragma_table_info('analyses')`).all() as {
      name: string;
    }[]
  ).map((row) => row.name);

  for (const column of ["confidence_score", "confidence_factors", "confidence_level"]) {
    if (!columns.includes(column)) continue;
    try {
      database.exec(`ALTER TABLE analyses DROP COLUMN ${column}`);
    } catch {
      // Older SQLite builds cannot drop columns; leaving it is harmless
      // because nothing reads or writes it any more.
    }
  }
}

export function getDb(): DatabaseSync {
  if (db) return db;
  const config = getServerConfig();
  const dbPath =
    config.dbPath ?? path.join(process.cwd(), ".data", "signal.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  dropLegacyColumns(db);
  return db;
}

function hashUrl(url: string): string {
  return createHash("sha1").update(canonicalizeUrl(url)).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

const INSERT_ARTICLE = `
INSERT OR IGNORE INTO articles (
  provider, external_id, title, summary, url, url_hash, source_name,
  category, published_at, fetched_at, authors, tags, metrics, raw_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/** Insert normalized articles; returns the number of newly added rows. */
export function insertArticles(articles: RawArticle[]): {
  inserted: number;
  skipped: number;
} {
  const database = getDb();
  let inserted = 0;
  let skipped = 0;

  const stmt = database.prepare(INSERT_ARTICLE);
  database.exec("BEGIN");
  try {
    for (const article of articles) {
      const result = stmt.run(
        article.provider,
        article.externalId,
        article.title.slice(0, 1000),
        article.summary.slice(0, 20000),
        article.url.slice(0, 2000),
        hashUrl(article.url),
        article.sourceName.slice(0, 300),
        article.category,
        article.publishedAt,
        article.fetchedAt,
        JSON.stringify(article.authors ?? []),
        JSON.stringify(article.tags ?? []),
        article.metrics ? JSON.stringify(article.metrics) : null,
        article.raw ? JSON.stringify(article.raw).slice(0, 100000) : null,
      );
      if (result.changes > 0) inserted += 1;
      else skipped += 1;
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { inserted, skipped };
}

export interface RunRecord {
  id: number;
  provider: ProviderId;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  itemsSeen: number;
  itemsNew: number;
  itemsUpdated: number;
  truncated: boolean;
  cursor: string | null;
  etag: string | null;
  errorMessage: string | null;
}

export function startRun(provider: ProviderId): RunRecord {
  const database = getDb();
  const startedAt = nowIso();
  const result = database
    .prepare(
      `INSERT INTO ingestion_runs (provider, status, started_at)
       VALUES (?, 'running', ?)`,
    )
    .run(provider, startedAt);
  return {
    id: Number(result.lastInsertRowid),
    provider,
    status: "running",
    startedAt,
    finishedAt: null,
    itemsSeen: 0,
    itemsNew: 0,
    itemsUpdated: 0,
    truncated: false,
    cursor: null,
    etag: null,
    errorMessage: null,
  };
}

export function finishRun(
  run: RunRecord,
  outcome: {
    status: "success" | "error" | "unconfigured" | "disabled";
    itemsSeen?: number;
    itemsNew?: number;
    itemsUpdated?: number;
    truncated?: boolean;
    cursor?: string | null;
    etag?: string | null;
    errorMessage?: string | null;
  },
): void {
  const database = getDb();
  database
    .prepare(
      `UPDATE ingestion_runs
       SET status = ?, finished_at = ?, items_seen = ?, items_new = ?,
           items_updated = ?, truncated = ?, cursor = ?, etag = ?, error_message = ?
       WHERE id = ?`,
    )
    .run(
      outcome.status,
      nowIso(),
      outcome.itemsSeen ?? 0,
      outcome.itemsNew ?? 0,
      outcome.itemsUpdated ?? 0,
      outcome.truncated ? 1 : 0,
      outcome.cursor ?? null,
      outcome.etag ?? null,
      outcome.errorMessage ?? null,
      run.id,
    );
}

export function recordError(
  provider: ProviderId,
  runId: number | null,
  message: string,
  detail?: string,
): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO provider_errors (provider, run_id, message, detail)
       VALUES (?, ?, ?, ?)`,
    )
    .run(provider, runId, message.slice(0, 2000), detail?.slice(0, 10000) ?? null);
}

export interface ProviderStateRow {
  provider: ProviderId;
  etag: string | null;
  lastCursor: string | null;
  lastSince: string | null;
}

export function getProviderState(provider: ProviderId): ProviderStateRow | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT provider, etag, last_cursor AS lastCursor, last_since AS lastSince
       FROM provider_state WHERE provider = ?`,
    )
    .get(provider) as
    | { provider: string; etag: string | null; lastCursor: string | null; lastSince: string | null }
    | undefined;
  if (!row) return null;
  return {
    provider: row.provider as ProviderId,
    etag: row.etag,
    lastCursor: row.lastCursor,
    lastSince: row.lastSince,
  };
}

export function saveProviderState(
  provider: ProviderId,
  state: { etag?: string | null; cursor?: string | null; since?: string | null },
): void {
  const database = getDb();
  const existing = getProviderState(provider);
  database
    .prepare(
      `INSERT INTO provider_state (provider, etag, last_cursor, last_since, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET
         etag = excluded.etag,
         last_cursor = excluded.last_cursor,
         last_since = excluded.last_since,
         updated_at = excluded.updated_at`,
    )
    .run(
      provider,
      state.etag ?? existing?.etag ?? null,
      state.cursor ?? existing?.lastCursor ?? null,
      state.since ?? existing?.lastSince ?? null,
      nowIso(),
    );
}

export interface ArticleQuery {
  page: number;
  pageSize: number;
  provider?: ProviderId;
  category?: string;
  q?: string;
}

export function queryArticles(query: ArticleQuery): {
  articles: StoredArticle[];
  total: number;
} {
  const database = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.provider) {
    conditions.push("provider = ?");
    params.push(query.provider);
  }
  if (query.category) {
    conditions.push("category = ?");
    params.push(query.category);
  }
  if (query.q) {
    conditions.push("(title LIKE ? OR summary LIKE ?)");
    const like = `%${query.q}%`;
    params.push(like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const totalRow = database
    .prepare(`SELECT COUNT(*) AS count FROM articles ${where}`)
    .get(...params) as { count: number };
  const total = totalRow.count;

  const page = Math.max(1, query.page);
  const pageSize = Math.min(100, Math.max(1, query.pageSize));
  const offset = (page - 1) * pageSize;

  const rows = database
    .prepare(
      `SELECT * FROM articles ${where}
       ORDER BY published_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  return {
    articles: rows.map(rowToStoredArticle),
    total,
  };
}

export function latestRun(provider: ProviderId): RunRecord | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM ingestion_runs WHERE provider = ? ORDER BY started_at DESC LIMIT 1`,
    )
    .get(provider) as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}

export function latestSuccessRun(provider: ProviderId): RunRecord | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM ingestion_runs
       WHERE provider = ? AND status = 'success'
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(provider) as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}

export function latestError(provider: ProviderId): string | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT message FROM provider_errors WHERE provider = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(provider) as { message: string } | undefined;
  return row?.message ?? null;
}

export function recentErrors(limit = 10): {
  id: number;
  provider: ProviderId;
  message: string;
  createdAt: string;
}[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT id, provider, message, created_at AS createdAt
       FROM provider_errors ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as {
    id: number;
    provider: string;
    message: string;
    createdAt: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider as ProviderId,
    message: row.message,
    createdAt: row.createdAt,
  }));
}

export function articleCounts(): { total: number; byProvider: Record<string, number> } {
  const database = getDb();
  const total = (database.prepare(`SELECT COUNT(*) AS c FROM articles`).get() as { c: number }).c;
  const rows = database
    .prepare(`SELECT provider, COUNT(*) AS c FROM articles GROUP BY provider`)
    .all() as { provider: string; c: number }[];
  const byProvider: Record<string, number> = {};
  for (const row of rows) byProvider[row.provider] = row.c;
  return { total, byProvider };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToStoredArticle(row: Record<string, unknown>): StoredArticle {
  return {
    id: Number(row.id),
    provider: row.provider as ProviderId,
    externalId: String(row.external_id),
    title: String(row.title),
    summary: String(row.summary),
    url: String(row.url),
    sourceName: String(row.source_name),
    category: row.category as StoredArticle["category"],
    publishedAt: String(row.published_at),
    fetchedAt: String(row.fetched_at),
    authors: parseJson(String(row.authors ?? "[]"), [] as string[]),
    tags: parseJson(String(row.tags ?? "[]"), [] as string[]),
    metrics: parseJson(String(row.metrics ?? ""), null as Record<string, number> | null),
  };
}

function rowToRun(row: Record<string, unknown>): RunRecord {
  return {
    id: Number(row.id),
    provider: row.provider as ProviderId,
    status: String(row.status),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    itemsSeen: Number(row.items_seen),
    itemsNew: Number(row.items_new),
    itemsUpdated: Number(row.items_updated),
    truncated: Number(row.truncated) === 1,
    cursor: row.cursor ? String(row.cursor) : null,
    etag: row.etag ? String(row.etag) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
  };
}
