import "server-only";
import { getDb } from "../db";
import { scoreImportance, SCORING_VERSION } from "./scoring";
import { getFocusWeights } from "../settings";
import type { TopicId } from "@/lib/types";
import type { StoredArticle } from "../types";
export function rescoreImportance(weights: Record<TopicId, number>): number {
  const db = getDb();
  const rows = db.prepare(`SELECT a.* FROM articles a JOIN analyses an ON an.article_id = a.id`).all() as Record<string, unknown>[];
  const update = db.prepare(`UPDATE analyses SET importance_score = ?, importance_factors = ? WHERE article_id = ?`);
  const parse = <T>(value: unknown, fallback: T): T => { try { return JSON.parse(String(value)) as T; } catch { return fallback; } };
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const article: StoredArticle = { id: Number(row.id), provider: row.provider as StoredArticle["provider"], externalId: String(row.external_id), title: String(row.title), summary: String(row.summary), url: String(row.url), sourceName: String(row.source_name), category: row.category as StoredArticle["category"], publishedAt: String(row.published_at), fetchedAt: String(row.fetched_at), authors: parse(row.authors, [] as string[]), tags: parse(row.tags, [] as string[]), metrics: parse(row.metrics, null as Record<string, number> | null) };
      const result = scoreImportance(article, weights); update.run(result.score, JSON.stringify(result.factors), article.id);
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return rows.length;
}
export function ensureScoringCurrent(): void {
 const db = getDb();
 db.exec(`CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
 const weights = getFocusWeights();
 const signature = JSON.stringify([SCORING_VERSION, new Date().toISOString().slice(0, 10), weights]);
 const previous = db.prepare(`SELECT value FROM app_metadata WHERE key = 'scoring'`).get() as { value: string } | undefined;
 if (previous?.value === signature) return;
 rescoreImportance(weights);
 // Keep archived days intact; today's payload must use the new criteria.
 db.prepare(`DELETE FROM briefings WHERE date = ?`).run(new Date().toISOString().slice(0, 10));
 db.prepare(`INSERT INTO app_metadata (key, value) VALUES ('scoring', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(signature);
}
