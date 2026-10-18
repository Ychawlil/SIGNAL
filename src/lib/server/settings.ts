import "server-only";
import { getDb } from "./db";
import {
  DEFAULT_FOCUS_WEIGHTS,
  TOPIC_IDS,
  clampWeight,
  normalizeWeights,
} from "@/lib/focus-weights";
import type { TopicId } from "@/lib/types";

/**
 * Server-side persistence for the user's focus-area weights.
 *
 * These weights feed the `relevance` factor of importance scoring, so they
 * must live on the server: the analysis runs in SQLite, not in the browser.
 */

let cache: { weights: Record<TopicId, number>; at: number } | null = null;
const CACHE_MS = 5_000;

export function getFocusWeights(): Record<TopicId, number> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.weights;

  const rows = getDb()
    .prepare(`SELECT topic, weight FROM focus_weights`)
    .all() as { topic: string; weight: number }[];

  const weights: Record<TopicId, number> = { ...DEFAULT_FOCUS_WEIGHTS };
  for (const row of rows) {
    if (!TOPIC_IDS.includes(row.topic as TopicId)) continue;
    const value = clampWeight(row.weight);
    if (value !== null) weights[row.topic as TopicId] = value;
  }

  cache = { weights, at: now };
  return weights;
}

export function saveFocusWeights(
  patch: Record<string, unknown> | null | undefined,
): Record<TopicId, number> {
  const weights = normalizeWeights(patch);
  const database = getDb();
  const now = new Date().toISOString();
  const statement = database.prepare(
    `INSERT INTO focus_weights (topic, weight, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(topic) DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at`,
  );

  database.exec("BEGIN");
  try {
    for (const topic of TOPIC_IDS) {
      statement.run(topic, weights[topic], now);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  cache = { weights, at: Date.now() };
  return weights;
}

/** Drop the current day's cached briefing so new weights take effect. */
export function invalidateTodayBriefing(): void {
  const date = new Date().toISOString().slice(0, 10);
  getDb().prepare(`DELETE FROM briefings WHERE date = ?`).run(date);
  cache = null;
}
