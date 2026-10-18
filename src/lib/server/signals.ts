import "server-only";
import { getDb } from "./db";
import { TOPIC_CATEGORIES } from "@/lib/topics";
import type { SignalRecord } from "@/lib/signals";
import type { CategoryId, TopicId } from "@/lib/types";
import type { ProviderId } from "./types";

export interface SignalQuery {
  page: number;
  pageSize: number;
  q?: string;
  category?: CategoryId;
  topic?: TopicId;
  source?: string;
  provider?: ProviderId;
  sort?: "newest" | "importance";
}

const CATEGORY_IDS: CategoryId[] = [
  "ai-models",
  "ai-research",
  "ai-math",
  "ai-cs",
  "physical-ai",
  "agents-coding",
  "open-source",
  "signals",
  "other-science",
];

const SORT_SQL: Record<NonNullable<SignalQuery["sort"]>, string> = {
  newest: "a.published_at DESC",
  importance: "COALESCE(an.importance_score, 0) DESC, a.published_at DESC",
};

const SELECT = `
  SELECT a.id, a.provider, a.external_id, a.title, a.summary, a.url,
         a.source_name, a.category, a.published_at, a.fetched_at,
         a.authors, a.tags, a.metrics,
         an.one_liner, an.key_change, an.differences, an.evidence,
         an.limitations, an.impact, an.personal_relevance, an.further_reading,
         an.importance_score,
         an.is_model_release, an.model_family
  FROM articles a
  LEFT JOIN analyses an ON an.article_id = a.id
`;

function rowToSignal(row: Record<string, unknown>): SignalRecord {
  const importanceScore = row.importance_score == null ? 0 : Number(row.importance_score);
  return {
    id: Number(row.id),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    url: String(row.url),
    sourceName: String(row.source_name),
    category: row.category as CategoryId,
    publishedAt: String(row.published_at),
    authors: parseJson(String(row.authors ?? "[]"), [] as string[]),
    tags: parseJson(String(row.tags ?? "[]"), [] as string[]),
    importanceScore,
    keyChange: String(row.key_change ?? ""),
    differences: String(row.differences ?? ""),
    evidence: String(row.evidence ?? ""),
    limitations: String(row.limitations ?? ""),
    impact: String(row.impact ?? ""),
    personalRelevance: String(row.personal_relevance ?? ""),
    oneLineSummary: String(row.one_liner ?? ""),
    furtherReading: parseJson(
      String(row.further_reading ?? "[]"),
      [] as { label: string; url: string }[],
    ),
    isModelRelease: Number(row.is_model_release) === 1,
    modelFamily: row.model_family ? String(row.model_family) : null,
    analyzed: row.importance_score != null,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function listSignals(query: SignalQuery): {
  items: SignalRecord[];
  total: number;
} {
  const database = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.provider) {
    conditions.push("a.provider = ?");
    params.push(query.provider);
  }
  if (query.category && CATEGORY_IDS.includes(query.category)) {
    conditions.push("a.category = ?");
    params.push(query.category);
  }
  if (query.topic) {
    const categories = TOPIC_CATEGORIES[query.topic];
    if (categories && categories.length > 0) {
      conditions.push(`a.category IN (${categories.map(() => "?").join(", ")})`);
      params.push(...categories);
    }
  }
  if (query.source) {
    conditions.push("a.source_name = ?");
    params.push(query.source);
  }
  if (query.q) {
    conditions.push("(a.title LIKE ? OR a.summary LIKE ?)");
    const like = `%${query.q}%`;
    params.push(like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const totalRow = database
    .prepare(`SELECT COUNT(*) AS count FROM articles a ${where}`)
    .get(...params) as { count: number };
  const total = Number(totalRow.count);

  const page = Math.max(1, query.page);
  const pageSize = Math.min(100, Math.max(1, query.pageSize));
  const offset = (page - 1) * pageSize;
  const orderBy = SORT_SQL[query.sort ?? "newest"];

  const rows = database
    .prepare(`${SELECT} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  return { items: rows.map(rowToSignal), total };
}

export interface SignalStats {
  total: number;
  last24h: number;
  last7d: number;
  categoryCounts: Record<CategoryId, number>;
  topicCounts: Record<TopicId, number>;
  sources: string[];
}

export function signalStats(): SignalStats {
  const database = getDb();
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600000).toISOString();
  const since7d = new Date(now - 7 * 86400000).toISOString();

  const total = (
    database.prepare(`SELECT COUNT(*) AS c FROM articles`).get() as { c: number }
  ).c;
  const last24h = (
    database
      .prepare(`SELECT COUNT(*) AS c FROM articles WHERE published_at >= ?`)
      .get(since24h) as { c: number }
  ).c;
  const last7d = (
    database
      .prepare(`SELECT COUNT(*) AS c FROM articles WHERE published_at >= ?`)
      .get(since7d) as { c: number }
  ).c;

  const categoryRows = database
    .prepare(`SELECT category, COUNT(*) AS c FROM articles GROUP BY category`)
    .all() as { category: string; c: number }[];

  const categoryCounts = {} as Record<CategoryId, number>;
  for (const id of CATEGORY_IDS) categoryCounts[id] = 0;
  for (const row of categoryRows) {
    if (CATEGORY_IDS.includes(row.category as CategoryId)) {
      categoryCounts[row.category as CategoryId] = Number(row.c);
    }
  }

  const topicCounts = {} as Record<TopicId, number>;
  for (const [topic, categories] of Object.entries(TOPIC_CATEGORIES)) {
    topicCounts[topic as TopicId] = categories.reduce(
      (sum, category) => sum + (categoryCounts[category] ?? 0),
      0,
    );
  }

  const sourceRows = database
    .prepare(`SELECT DISTINCT source_name AS source FROM articles ORDER BY source_name`)
    .all() as { source: string }[];
  const sources = sourceRows.map((row) => row.source);

  return { total, last24h, last7d, categoryCounts, topicCounts, sources };
}
