import "server-only";
import { getDb } from "../db";
import { relevanceForCategory } from "@/lib/focus-weights";
import type { CategoryId, TopicId } from "@/lib/types";
import type { AnalysisFactors } from "./types";

/**
 * Recomputes the weight-dependent part of importance for every stored analysis.
 *
 * Only the `relevance` factor depends on the user's focus weights: the other
 * four factors are derived from the article itself. Re-scoring therefore never
 * needs to re-run the text analysis, so changing a slider in Settings is cheap
 * and cannot damage the stored summaries.
 */
export function rescoreImportance(weights: Record<TopicId, number>): number {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT an.article_id, an.importance_factors, a.category
       FROM analyses an
       JOIN articles a ON a.id = an.article_id`,
    )
    .all() as {
    article_id: number;
    importance_factors: string;
    category: string;
  }[];

  if (rows.length === 0) return 0;

  const update = database.prepare(
    `UPDATE analyses SET importance_score = ?, importance_factors = ? WHERE article_id = ?`,
  );

  let updated = 0;
  database.exec("BEGIN");
  try {
    for (const row of rows) {
      let factors: AnalysisFactors;
      try {
        factors = JSON.parse(String(row.importance_factors)) as AnalysisFactors;
      } catch {
        continue;
      }
      if (!factors || typeof factors !== "object") continue;

      const relevance = relevanceForCategory(row.category as CategoryId, weights);
      const next: AnalysisFactors = { ...factors, relevance };
      const score =
        next.relevance +
        (next.novelty ?? 0) +
        (next.impact ?? 0) +
        (next.verifiability ?? 0) +
        (next.learning ?? 0);

      update.run(score, JSON.stringify(next), Number(row.article_id));
      updated += 1;
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return updated;
}
