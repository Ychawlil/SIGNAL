import "server-only";
import { getDb } from "../db";
import type { LibraryState } from "@/lib/types";
export function migrateFavorites(library: LibraryState): number {
  const db = getDb();
  const insert = db.prepare(`INSERT OR IGNORE INTO saved_items (article_id, saved_at, status, notes, tags, updated_at)
    SELECT id, ?, ?, ?, '[]', ? FROM articles WHERE id = ?`);
  const supplement = db.prepare(`UPDATE saved_items SET notes = ?, updated_at = ? WHERE article_id = ? AND notes = ''`);
  let migrated = 0;
  db.exec("BEGIN");
  try {
    for (const id of new Set(library.favoriteIds)) {
      const now = new Date().toISOString();
      const note = (library.notes[id] ?? "").slice(0, 20000);
      migrated += Number(insert.run(now, library.readIds.includes(id) ? "read" : "later", note, now, Number(id)).changes);
      if (note) supplement.run(note, now, Number(id));
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return migrated;
}
