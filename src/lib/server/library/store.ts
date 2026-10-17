import "server-only";
import { getDb } from "../db";
import type { StoredArticle } from "../types";
import type {
  CollectionItem,
  CustomKeyword,
  CustomTopic,
  ResearchCollection,
  SaveStatus,
  SavedItemView,
  SavedFilters,
  WeeklyReview,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToArticle(row: Record<string, unknown>): StoredArticle {
  return {
    id: Number(row.id),
    provider: row.provider as StoredArticle["provider"],
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

/* ============================================================
   Saved items
   ============================================================ */

export function saveItem(articleId: number): void {
  const database = getDb();
  const t = nowIso();
  database
    .prepare(
      `INSERT INTO saved_items (article_id, saved_at, status, notes, tags, updated_at)
       VALUES (?, ?, 'later', '', '[]', ?)
       ON CONFLICT(article_id) DO UPDATE SET updated_at = excluded.updated_at`,
    )
    .run(articleId, t, t);
}

export function unsaveItem(articleId: number): void {
  getDb().prepare(`DELETE FROM saved_items WHERE article_id = ?`).run(articleId);
}

export function updateItem(
  articleId: number,
  patch: { status?: SaveStatus | null; notes?: string; tags?: string[] },
): void {
  const database = getDb();
  const existing = database
    .prepare(`SELECT * FROM saved_items WHERE article_id = ?`)
    .get(articleId) as Record<string, unknown> | undefined;
  if (!existing) return;

  const status = patch.status === undefined ? (existing.status as SaveStatus | null) : patch.status;
  const notes = patch.notes ?? String(existing.notes);
  const tags = patch.tags ?? parseJson(String(existing.tags ?? "[]"), [] as string[]);

  database
    .prepare(
      `UPDATE saved_items SET status = ?, notes = ?, tags = ?, updated_at = ? WHERE article_id = ?`,
    )
    .run(status, notes, JSON.stringify(tags), nowIso(), articleId);
}

export function isSaved(articleId: number): boolean {
  const row = getDb()
    .prepare(`SELECT 1 FROM saved_items WHERE article_id = ?`)
    .get(articleId);
  return row !== undefined;
}

export function savedCount(): number {
  const row = getDb().prepare(`SELECT COUNT(*) AS c FROM saved_items`).get() as { c: number };
  return Number(row.c);
}

export function listSavedItems(filters: SavedFilters = {}): SavedItemView[] {
  const database = getDb();
  const conditions: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (filters.status && filters.status !== "all") {
    conditions.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters.q) {
    conditions.push("(a.title LIKE ? OR a.summary LIKE ? OR s.notes LIKE ? OR s.tags LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.topicId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(s.tags) WHERE value = (SELECT name FROM custom_topics WHERE id = ?))`,
    );
    params.push(filters.topicId);
  }
  if (filters.tag) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(s.tags) WHERE lower(value) = lower(?))`);
    params.push(filters.tag);
  }

  const where = conditions.join(" AND ");
  const rows = database
    .prepare(
      `SELECT a.*, s.saved_at, s.updated_at, s.status, s.notes, s.tags,
              an.importance_score, an.confidence_score, an.confidence_level,
              an.model_family, an.key_change, an.limitations
       FROM saved_items s
       JOIN articles a ON a.id = s.article_id
       LEFT JOIN analyses an ON an.article_id = a.id
       WHERE ${where}
       ORDER BY s.updated_at DESC`,
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map((row) => ({
    article: rowToArticle(row),
    savedAt: String(row.saved_at),
    updatedAt: String(row.updated_at),
    status: (row.status as SaveStatus | null) ?? null,
    notes: String(row.notes),
    tags: parseJson(String(row.tags ?? "[]"), [] as string[]),
    importanceScore: row.importance_score === null ? null : Number(row.importance_score),
    confidenceScore: row.confidence_score === null ? null : Number(row.confidence_score),
    confidenceLevel: row.confidence_level ? String(row.confidence_level) : null,
    modelFamily: row.model_family ? String(row.model_family) : null,
    keyChange: row.key_change ? String(row.key_change) : null,
    limitations: row.limitations ? String(row.limitations) : null,
  }));
}

export function getArticleWithAnalysis(id: number): {
  article: StoredArticle;
  modelFamily: string | null;
  category: string;
  tags: string[];
} | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT a.*, an.model_family
       FROM articles a
       LEFT JOIN analyses an ON an.article_id = a.id
       WHERE a.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const article = rowToArticle(row);
  return {
    article,
    modelFamily: row.model_family ? String(row.model_family) : null,
    category: article.category,
    tags: article.tags,
  };
}

export function queryArticleIdsForRelated(options: {
  modelFamily?: string | null;
  category?: string;
  tags?: string[];
  excludeId: number;
  limit: number;
}): { id: number; title: string; url: string; category: string; sourceName: string; publishedAt: string }[] {
  const database = getDb();
  const conditions: string[] = ["a.id != ?"];
  const params: (string | number)[] = [options.excludeId];

  if (options.modelFamily) {
    conditions.push(
      "EXISTS (SELECT 1 FROM analyses an2 WHERE an2.article_id = a.id AND an2.model_family = ?)",
    );
    params.push(options.modelFamily);
  }
  if (options.category) {
    conditions.push("a.category = ?");
    params.push(options.category);
  }

  const rows = database
    .prepare(
      `SELECT a.id, a.title, a.url, a.category, a.source_name, a.published_at
       FROM articles a
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.published_at DESC
       LIMIT ?`,
    )
    .all(...params, options.limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    url: String(row.url),
    category: String(row.category),
    sourceName: String(row.source_name),
    publishedAt: String(row.published_at),
  }));
}

/* ============================================================
   Custom topics & keywords
   ============================================================ */

export function listTopics(): CustomTopic[] {
  const rows = getDb()
    .prepare(`SELECT * FROM custom_topics ORDER BY created_at DESC`)
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description),
    createdAt: String(row.created_at),
  }));
}

export function createTopic(name: string, description: string): CustomTopic {
  const database = getDb();
  const createdAt = nowIso();
  database
    .prepare(`INSERT INTO custom_topics (name, description, created_at) VALUES (?, ?, ?)`)
    .run(name, description, createdAt);
  const id = Number(
    (database.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id,
  );
  return { id, name, description, createdAt };
}

export function deleteTopic(id: number): void {
  getDb().prepare(`DELETE FROM custom_topics WHERE id = ?`).run(id);
}

export function listKeywords(): CustomKeyword[] {
  const rows = getDb()
    .prepare(`SELECT * FROM custom_keywords ORDER BY created_at DESC`)
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    keyword: String(row.keyword),
    topicId: row.topic_id ? Number(row.topic_id) : null,
    createdAt: String(row.created_at),
  }));
}

export function createKeyword(keyword: string, topicId: number | null): CustomKeyword {
  const database = getDb();
  const createdAt = nowIso();
  database
    .prepare(`INSERT INTO custom_keywords (keyword, topic_id, created_at) VALUES (?, ?, ?)`)
    .run(keyword, topicId, createdAt);
  const id = Number(
    (database.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id,
  );
  return { id, keyword, topicId, createdAt };
}

export function deleteKeyword(id: number): void {
  getDb().prepare(`DELETE FROM custom_keywords WHERE id = ?`).run(id);
}

/* ============================================================
   Research collections
   ============================================================ */

export function listCollections(): ResearchCollection[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS item_count
       FROM research_collections c ORDER BY c.updated_at DESC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    description: String(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    itemCount: Number(row.item_count),
  }));
}

export function createCollection(title: string, description: string): ResearchCollection {
  const database = getDb();
  const t = nowIso();
  database
    .prepare(
      `INSERT INTO research_collections (title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(title, description, t, t);
  const id = Number(
    (database.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id,
  );
  return { id, title, description, createdAt: t, updatedAt: t, itemCount: 0 };
}

export function deleteCollection(id: number): void {
  getDb().prepare(`DELETE FROM research_collections WHERE id = ?`).run(id);
}

export function addCollectionItem(collectionId: number, articleId: number, note: string): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO collection_items (collection_id, article_id, note, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(collection_id, article_id) DO UPDATE SET note = excluded.note`,
    )
    .run(collectionId, articleId, note, nowIso());
  database
    .prepare(`UPDATE research_collections SET updated_at = ? WHERE id = ?`)
    .run(nowIso(), collectionId);
}

export function removeCollectionItem(collectionId: number, articleId: number): void {
  const database = getDb();
  database
    .prepare(`DELETE FROM collection_items WHERE collection_id = ? AND article_id = ?`)
    .run(collectionId, articleId);
  database
    .prepare(`UPDATE research_collections SET updated_at = ? WHERE id = ?`)
    .run(nowIso(), collectionId);
}

export function listCollectionItems(collectionId: number): CollectionItem[] {
  const rows = getDb()
    .prepare(
      `SELECT ci.article_id, ci.note, ci.added_at, a.title, a.url, a.source_name, a.category, a.published_at
       FROM collection_items ci
       JOIN articles a ON a.id = ci.article_id
       WHERE ci.collection_id = ?
       ORDER BY ci.added_at DESC`,
    )
    .all(collectionId) as Record<string, unknown>[];
  return rows.map((row) => ({
    articleId: Number(row.article_id),
    note: String(row.note),
    addedAt: String(row.added_at),
    title: String(row.title),
    url: String(row.url),
    sourceName: String(row.source_name),
    category: String(row.category),
    publishedAt: String(row.published_at),
  }));
}

/* ============================================================
   Weekly review
   ============================================================ */

export function saveWeeklyReview(review: WeeklyReview): void {
  getDb()
    .prepare(
      `INSERT INTO weekly_reviews (week_start, generated_at, payload)
       VALUES (?, ?, ?)
       ON CONFLICT(week_start) DO UPDATE SET generated_at = excluded.generated_at, payload = excluded.payload`,
    )
    .run(review.weekStart, review.generatedAt, JSON.stringify(review));
}

export function getWeeklyReview(weekStart: string): WeeklyReview | null {
  const row = getDb()
    .prepare(`SELECT payload FROM weekly_reviews WHERE week_start = ?`)
    .get(weekStart) as { payload: string } | undefined;
  return row ? (parseJson(row.payload, null) as WeeklyReview | null) : null;
}
