import "server-only";
import { getDb } from "./db";
import { sameEvent, isFollowup, type EventArticle } from "@/lib/event-matching";
export interface ContextArticle extends EventArticle { sourceName: string; fetchedAt: string; }
function articleRows(): ContextArticle[] {
 return getDb().prepare(`SELECT a.id, a.title, a.url, a.summary, a.published_at AS publishedAt, a.fetched_at AS fetchedAt, a.source_name AS sourceName, an.model_family AS modelFamily FROM articles a LEFT JOIN analyses an ON an.article_id = a.id ORDER BY a.published_at DESC LIMIT 5000`).all() as unknown as ContextArticle[];
}
function getTarget(id: number): ContextArticle | undefined { return getDb().prepare(`SELECT a.id, a.title, a.url, a.summary, a.published_at AS publishedAt, a.fetched_at AS fetchedAt, a.source_name AS sourceName, an.model_family AS modelFamily FROM articles a LEFT JOIN analyses an ON an.article_id = a.id WHERE a.id = ?`).get(id) as unknown as ContextArticle | undefined; }
export function articleContext(id: number) {
 const target = getTarget(id); if (!target) return null;
 const rows = articleRows().filter((item) => item.id !== id);
 return { event: rows.filter((item) => sameEvent(target, item) && !isFollowup(target, item)).slice(0, 20), followups: rows.filter((item) => isFollowup(target, item)).slice(0, 20), scope: "基于本地最近 5000 条记录，以相同链接、标题和项目标识保守匹配；不代表已独立验证。" };
}
export function libraryUpdates() {
 const db = getDb();
 db.exec(`CREATE TABLE IF NOT EXISTS followup_seen (article_id INTEGER PRIMARY KEY, seen_at TEXT NOT NULL)`);
 const saved = db.prepare(`SELECT s.article_id AS id, s.saved_at AS savedAt, w.seen_at AS seenAt FROM saved_items s LEFT JOIN followup_seen w ON w.article_id = s.article_id`).all() as { id: number; savedAt: string; seenAt: string | null }[];
 const rows = articleRows();
 return saved.flatMap((savedItem) => {
  const target = getTarget(savedItem.id); if (!target) return [];
  const since = Math.max(Date.parse(savedItem.savedAt), Date.parse(savedItem.seenAt ?? savedItem.savedAt));
  const items = rows.filter((item) => item.id !== target.id && Date.parse(item.fetchedAt) > since && isFollowup(target, item)).slice(0, 10);
  return items.length ? [{ articleId: target.id, title: target.title, items }] : [];
 });
}
export function markUpdatesSeen(id: number) { const db = getDb(); db.exec(`CREATE TABLE IF NOT EXISTS followup_seen (article_id INTEGER PRIMARY KEY, seen_at TEXT NOT NULL)`); db.prepare(`INSERT INTO followup_seen (article_id, seen_at) SELECT article_id, ? FROM saved_items WHERE article_id = ? ON CONFLICT(article_id) DO UPDATE SET seen_at = excluded.seen_at`).run(new Date().toISOString(), id); }
