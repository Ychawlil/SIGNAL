import "server-only";
import { getDb } from "./db";
import { CELESTIAL_BODIES, type UniverseReport, type PlanetId, type PlanetStats } from "@/lib/universe/planets";
/** Read-only navigation data: never ingests, analyzes or re-scores articles. */
export function getUniverseReport(now = new Date()): UniverseReport {
 const db = getDb(); const since = new Date(now.getTime() - 86400000).toISOString(); const until = now.toISOString();
 const planets = {} as Record<PlanetId, PlanetStats>;
 for (const planet of CELESTIAL_BODIES) {
   const saved = planet.id === "library";
   const rows = (saved
    ? db.prepare(`SELECT a.id, s.saved_at AS updated, s.saved_at AS published FROM saved_items s JOIN articles a ON a.id = s.article_id`).all()
    : planet.id === "briefing"
      ? db.prepare(`SELECT id, fetched_at AS updated, published_at AS published FROM articles WHERE published_at >= ? AND published_at <= ?`).all(since, until)
      : db.prepare(`SELECT id, fetched_at AS updated, published_at AS published FROM articles WHERE category IN (${planet.categories.map(() => "?").join(",")})`).all(...planet.categories)) as { id: number; updated: string; published: string }[];
   const updates = rows.map((row) => row.updated).filter((value) => Number.isFinite(Date.parse(value)) && value <= until).sort();
   planets[planet.id] = { total: rows.length, new24h: rows.filter((row) => row.published >= since && row.published <= until).length, lastUpdatedAt: updates[updates.length - 1] ?? null, articleIds: rows.map((row) => String(row.id)), kind: saved ? "saved" : planet.id === "briefing" ? "briefing" : "article" };
 }
 const total = db.prepare(`SELECT COUNT(*) AS count FROM articles`).get() as { count: number };
 return { sampledAt: until, totalArticles: Number(total.count), planets };
}
