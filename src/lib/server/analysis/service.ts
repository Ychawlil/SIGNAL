import "server-only";
import { getDb } from "../db";
import { getFocusWeights } from "../settings";
import { analyzeArticle, getAnalysisEngine } from "./analyzer";
import {
  DEFAULT_BRIEFING_ITEMS,
  clampBriefingItems,
  generateBriefing,
} from "./briefing";
import { extractModelInfo } from "./model-extractor";
import { RULE_BASED_PLACEHOLDERS } from "./placeholders";
import {
  countAnalyzed,
  getBriefing,
  listAnalysesSince,
  listArticleRowsSince,
  listModelFamilies,
  listStaleAnalysisArticleIds,
  listUnanalyzedArticleIds,
  saveAnalysis,
  saveBriefing,
  saveModelVersion,
  type AnalyzedArticleRow,
} from "./store";
import type { StoredArticle } from "../types";
import type { AnalysisResult, DailyBriefing, ModelFamily } from "./types";
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
  /** Items re-analyzed because the stored text came from another engine. */
  refreshed: number;
  /** Items the engine failed on; they keep their previous analysis. */
  failed: number;
  failedSample: string | null;
  models: number;
  totalAnalyzed: number;
}

/**
 * Upper bound on the per-run upgrade pass. The briefing window is small
 * (24h) but each LLM call costs seconds and tokens, so the cap keeps a manual
 * refresh bounded; repeated updates converge on the whole window.
 */
const REFRESH_LIMIT = 20;

/** Analyze anything missing, then upgrade stale analyses inside the window. */
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

  const run = {
    analyzed: 0,
    refreshed: 0,
    failed: 0,
    failedSample: null as string | null,
    models: 0,
  };

  const analyzeOne = async (id: number): Promise<boolean> => {
    const article = getArticleById(id);
    if (!article) return false;

    const result = await engine.analyze(article, weights);
    saveAnalysis(result, engine.id);

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
      run.models += 1;
    }
    return true;
  };

  const attempt = async (id: number, bucket: "analyzed" | "refreshed") => {
    try {
      if (await analyzeOne(id)) run[bucket] += 1;
    } catch (error) {
      // One bad article must not abort the run: keep the previous analysis
      // (the briefing simply will not show it) and report the failure.
      run.failed += 1;
      if (!run.failedSample) {
        run.failedSample = error instanceof Error ? error.message : String(error);
      }
    }
  };

  for (const id of ids) {
    await attempt(id, "analyzed");
  }

  // The briefing only renders the last 24h, so that is the only set worth
  // paying model calls for on every manual update. Rule-engine rows written
  // before an API key existed get upgraded here.
  if (engine.id !== "rule-based") {
    const since = new Date(Date.now() - 25 * 3600000).toISOString();
    const stale = listStaleAnalysisArticleIds(since, engine.id, REFRESH_LIMIT);
    for (const id of stale) {
      await attempt(id, "refreshed");
    }
  }

  return {
    engine: engine.id,
    engineMessage: engine.availabilityMessage(),
    ...run,
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

/* ============================================================
   Briefing-first pipeline

   Order matters: the briefing is *selected* first (importance is a
   deterministic score, it does not need the model), and only the selected
   items are sent to the LLM. Articles that already hold a real analysis are
   skipped, so a refresh costs at most `maxItems` model calls.
   ============================================================ */

function hasPlaceholderText(analysis: AnalysisResult): boolean {
  const fields = [analysis.impact, analysis.limitations, analysis.personalRelevance];
  if (fields.some((field) => !field.trim())) return true;
  return fields.some((field) => RULE_BASED_PLACEHOLDERS.includes(field));
}

/** True when the stored text is only the rule-based baseline. */
export function needsRealAnalysis(row: {
  analysis: AnalysisResult | null;
  engine: string;
}): boolean {
  if (!row.analysis) return true;
  // Rows that predate the engine marker may already hold real model text;
  // only treat them as needing work when the text is a placeholder.
  if (row.engine === "" || row.engine === undefined) return hasPlaceholderText(row.analysis);
  if (row.engine === "llm") return false;
  return true;
}

/**
 * Give every stored article a deterministic baseline analysis.
 *
 * This is the rule engine, run in-process with no network calls. It keeps
 * the archive browsable (Explore joins `analyses`) while making sure the
 * expensive analysis stays reserved for what the briefing actually shows.
 */
export function ensureBaselineAnalysis(
  weights = getFocusWeights(),
): number {
  let written = 0;
  for (const id of listUnanalyzedArticleIds()) {
    const article = getArticleById(id);
    if (!article) continue;
    saveAnalysis(analyzeArticle(article, weights), "rule-based");
    written += 1;
  }
  return written;
}

export interface BriefingAnalysisSummary {
  engine: string;
  engineMessage: string;
  /** Items selected into today's briefing. */
  selected: number;
  /** Articles that received the deterministic baseline in this run. */
  baseline: number;
  /** Selected items that were sent to the analysis engine. */
  analyzed: number;
  /** Selected items skipped because a real analysis already existed. */
  skipped: number;
  failed: number;
  failedSample: string | null;
  briefingCount: number;
}

/**
 * Select the daily briefing, then analyze only its items.
 *
 * 1. baseline: rule-based analysis for anything still unanalyzed (free);
 * 2. select: run the briefing selection over the 24h window;
 * 3. analyze: LLM only for the selected items that have no real analysis;
 * 4. rebuild: regenerate the payload so the page shows the final text.
 */
export async function analyzeBriefingWindow(
  options: { maxItems?: number } = {},
): Promise<BriefingAnalysisSummary> {
  const engine = getAnalysisEngine();
  const weights = getFocusWeights();
  const now = new Date();
  const since = new Date(now.getTime() - 25 * 3600000).toISOString();
  const baseline = ensureBaselineAnalysis(weights);

  const rows = listArticleRowsSince(since).map((row) => ({
    row,
    candidate: {
      ...row.article,
      analysis: row.analysis ?? analyzeArticle(row.article, weights),
    } satisfies AnalyzedArticleRow,
  }));

  const selection = generateBriefing(
    rows.map((entry) => entry.candidate),
    now,
    { maxItems: options.maxItems },
  );
  const selectedIds = [
    ...new Set(selection.sections.flatMap((s) => s.items.map((i) => i.articleId))),
  ];
  const byId = new Map(rows.map((entry) => [entry.row.article.id, entry]));

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  let failedSample: string | null = null;

  for (const id of selectedIds) {
    const entry = byId.get(id);
    if (!entry) continue;
    if (!needsRealAnalysis(entry.row)) {
      skipped += 1;
      continue;
    }
    try {
      // Re-use the freshly loaded article; the LLM engine scores it with the
      // same weights, so importance stays identical to the selection pass.
      const result = await engine.analyze(entry.row.article, weights);
      saveAnalysis(result, engine.id);
      analyzed += 1;
    } catch (error) {
      failed += 1;
      if (!failedSample) {
        failedSample = error instanceof Error ? error.message : String(error);
      }
    }
  }

  const briefing = getDailyBriefing({ force: true, maxItems: options.maxItems });

  return {
    engine: engine.id,
    engineMessage: engine.availabilityMessage(),
    selected: selectedIds.length,
    baseline,
    analyzed,
    skipped,
    failed,
    failedSample,
    briefingCount: briefing.count,
  };
}
