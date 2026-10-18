import "server-only";
import { getDb } from "../db";
import { getFocusWeights } from "../settings";
import { getAnalysisEngine } from "./analyzer";
import {
  DEFAULT_BRIEFING_ITEMS,
  clampBriefingItems,
  generateBriefing,
} from "./briefing";
import { extractModelInfo } from "./model-extractor";
import {
  countAnalyzed,
  getBriefing,
  listAnalysesSince,
  listModelFamilies,
  listUnanalyzedArticleIds,
  saveAnalysis,
  saveBriefing,
  saveModelVersion,
} from "./store";
import type { StoredArticle } from "../types";
import type { DailyBriefing, ModelFamily } from "./types";
import { BRIEFING_SCHEMA_VERSION } from "./types";

function getArticleById(id: number): StoredArticle | null {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM articles WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
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
    authors: safeJson(String(row.authors ?? "[]"), [] as string[]),
    tags: safeJson(String(row.tags ?? "[]"), [] as string[]),
    metrics: safeJson(String(row.metrics ?? ""), null as Record<string, number> | null),
  };
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface AnalysisRunSummary {
  engine: string;
  engineMessage: string;
  analyzed: number;
  models: number;
  totalAnalyzed: number;
}

/** Analyze all articles that have not been analyzed yet. Idempotent. */
export async function ensureAnalysis(force = false): Promise<AnalysisRunSummary> {
  const engine = getAnalysisEngine();
  // Loaded once per run: every article in this batch is scored with the
  // user's current focus weights.
  const weights = getFocusWeights();
  const ids = force
    ? (() => {
        const database = getDb();
        // Rebuilding the model registry from scratch keeps it consistent
        // with any model-extraction heuristic changes.
        database.prepare(`DELETE FROM model_versions`).run();
        return (
          database
            .prepare(`SELECT id FROM articles ORDER BY published_at DESC LIMIT 500`)
            .all() as { id: number }[]
        ).map((r) => Number(r.id));
      })()
    : listUnanalyzedArticleIds();

  let analyzed = 0;
  let models = 0;

  for (const id of ids) {
    const article = getArticleById(id);
    if (!article) continue;

    const result = await engine.analyze(article, weights);
    saveAnalysis(result);
    analyzed += 1;

    const model = extractModelInfo(article);
    if (model) {
      saveModelVersion({
        family: model.family,
        name: model.name,
        version: model.version,
        sourceArticleId: article.id,
        reasoning: null,
        math: null,
        coding: null,
        multimodal: null,
        agent: null,
        params: model.params,
        contextLength: null,
        latency: null,
        cost: null,
        openWeights: model.openWeights,
        apiAvailable: null,
        license: model.license,
        deployment: null,
        benchmarks: model.benchmarks,
        evalNote: model.evalNote,
        claimOrigin: model.claimOrigin,
        updatedAt: new Date().toISOString(),
      });
      models += 1;
    }
  }

  return {
    engine: engine.id,
    engineMessage: engine.availabilityMessage(),
    analyzed,
    models,
    totalAnalyzed: countAnalyzed(),
  };
}

export function getModelRegistry(): ModelFamily[] {
  return listModelFamilies();
}

export function getDailyBriefing(
  options: { force?: boolean; maxItems?: number } = {},
): DailyBriefing {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const maxItems = clampBriefingItems(options.maxItems ?? DEFAULT_BRIEFING_ITEMS);
  if (!options.force) {
    const cached = getBriefing(date);
    // Cached payloads from an older schema (confidence metric, 7-day window)
    // are ignored, and a cache built for a different item count is rebuilt so
    // the "daily signal count" setting is actually honoured.
    if (
      cached &&
      cached.version === BRIEFING_SCHEMA_VERSION &&
      cached.maxItems === maxItems
    ) {
      return cached;
    }
  }

  // One hour of slack so the SQL pre-filter can never drop an item that
  // generateBriefing would still consider at the 24h boundary.
  const since = new Date(now.getTime() - 25 * 3600000).toISOString();
  const items = listAnalysesSince(since);
  const briefing = generateBriefing(items, now, { maxItems });
  const articleIds = briefing.sections.flatMap((s) => s.items.map((i) => i.articleId));
  saveBriefing(date, briefing, articleIds);
  return briefing;
}
