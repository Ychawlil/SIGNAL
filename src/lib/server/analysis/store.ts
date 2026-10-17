import "server-only";
import { getDb } from "../db";
import type { StoredArticle } from "../types";
import type {
  AnalysisResult,
  DailyBriefing,
  ModelFamily,
  ModelVersion,
} from "./types";

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ============================================================
   Analyses
   ============================================================ */

export function saveAnalysis(result: AnalysisResult): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO analyses (
         article_id, one_liner, key_change, differences, evidence, limitations,
         impact, personal_relevance, further_reading, importance_score,
         importance_factors, confidence_score, confidence_factors, confidence_level,
         evidence_basis, is_model_release, model_family, analyzed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(article_id) DO UPDATE SET
         one_liner = excluded.one_liner,
         key_change = excluded.key_change,
         differences = excluded.differences,
         evidence = excluded.evidence,
         limitations = excluded.limitations,
         impact = excluded.impact,
         personal_relevance = excluded.personal_relevance,
         further_reading = excluded.further_reading,
         importance_score = excluded.importance_score,
         importance_factors = excluded.importance_factors,
         confidence_score = excluded.confidence_score,
         confidence_factors = excluded.confidence_factors,
         confidence_level = excluded.confidence_level,
         evidence_basis = excluded.evidence_basis,
         is_model_release = excluded.is_model_release,
         model_family = excluded.model_family,
         analyzed_at = excluded.analyzed_at`,
    )
    .run(
      result.articleId,
      result.oneLineSummary,
      result.keyChange,
      result.differences,
      result.evidence,
      result.limitations,
      result.impact,
      result.personalRelevance,
      JSON.stringify(result.furtherReading),
      result.importanceScore,
      JSON.stringify(result.importanceFactors),
      result.confidenceScore,
      JSON.stringify(result.confidenceFactors),
      result.confidenceLevel,
      result.evidenceBasis,
      result.isModelRelease ? 1 : 0,
      result.modelFamily,
      result.analyzedAt,
    );
}

export function listUnanalyzedArticleIds(limit = 500): number[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT a.id FROM articles a
       LEFT JOIN analyses an ON an.article_id = a.id
       WHERE an.article_id IS NULL
       ORDER BY a.published_at DESC
       LIMIT ?`,
    )
    .all(limit) as { id: number }[];
  return rows.map((r) => Number(r.id));
}

export function countAnalyzed(): number {
  const database = getDb();
  const row = database
    .prepare(`SELECT COUNT(*) AS c FROM analyses`)
    .get() as { c: number };
  return Number(row.c);
}

export interface AnalyzedArticleRow extends StoredArticle {
  analysis: AnalysisResult;
}

export function listAnalyses(options: {
  page: number;
  pageSize: number;
  minImportance?: number;
}): { items: AnalyzedArticleRow[]; total: number } {
  const database = getDb();
  const conditions: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (options.minImportance !== undefined) {
    conditions.push("an.importance_score >= ?");
    params.push(options.minImportance);
  }

  const where = conditions.join(" AND ");
  const totalRow = database
    .prepare(
      `SELECT COUNT(*) AS c FROM analyses an
       JOIN articles a ON a.id = an.article_id WHERE ${where}`,
    )
    .get(...params) as { c: number };

  const page = Math.max(1, options.page);
  const pageSize = Math.min(100, Math.max(1, options.pageSize));
  const offset = (page - 1) * pageSize;

  const rows = database
    .prepare(
      `SELECT a.*, an.one_liner, an.key_change, an.differences, an.evidence,
              an.limitations, an.impact, an.personal_relevance, an.further_reading,
              an.importance_score, an.importance_factors, an.confidence_score,
              an.confidence_factors, an.confidence_level, an.evidence_basis,
              an.is_model_release, an.model_family, an.analyzed_at
       FROM analyses an
       JOIN articles a ON a.id = an.article_id
       WHERE ${where}
       ORDER BY an.importance_score DESC, a.published_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  return {
    items: rows.map(rowToAnalyzedArticle),
    total: Number(totalRow.c),
  };
}

/**
 * Every analyzed article published at or after `sinceIso`.
 *
 * The briefing needs the full freshness window, not a capped page: a fixed
 * top-100 slice silently hides newer items once enough high-scoring history
 * exists, so a manual refresh would appear to do nothing.
 */
export function listAnalysesSince(sinceIso: string): AnalyzedArticleRow[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT a.*, an.one_liner, an.key_change, an.differences, an.evidence,
              an.limitations, an.impact, an.personal_relevance, an.further_reading,
              an.importance_score, an.importance_factors, an.confidence_score,
              an.confidence_factors, an.confidence_level, an.evidence_basis,
              an.is_model_release, an.model_family, an.analyzed_at
       FROM analyses an
       JOIN articles a ON a.id = an.article_id
       WHERE a.published_at >= ?
       ORDER BY an.importance_score DESC, a.published_at DESC`,
    )
    .all(sinceIso) as Record<string, unknown>[];

  return rows.map(rowToAnalyzedArticle);
}

function rowToAnalyzedArticle(row: Record<string, unknown>): AnalyzedArticleRow {
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
    analysis: {
      articleId: Number(row.id),
      oneLineSummary: String(row.one_liner),
      keyChange: String(row.key_change),
      differences: String(row.differences),
      evidence: String(row.evidence),
      limitations: String(row.limitations),
      impact: String(row.impact),
      personalRelevance: String(row.personal_relevance),
      furtherReading: parseJson(String(row.further_reading ?? "[]"), []),
      importanceScore: Number(row.importance_score),
      importanceFactors: parseJson(String(row.importance_factors ?? "{}"), {
        relevance: 0,
        novelty: 0,
        impact: 0,
        verifiability: 0,
        learning: 0,
      }),
      confidenceScore: Number(row.confidence_score),
      confidenceLevel: row.confidence_level as AnalysisResult["confidenceLevel"],
      confidenceFactors: parseJson(String(row.confidence_factors ?? "{}"), {
        sourceType: 0,
        methodTransparency: 0,
        experimentQuality: 0,
        independentReproduction: 0,
        evidenceCompleteness: 0,
      }),
      evidenceBasis: row.evidence_basis as AnalysisResult["evidenceBasis"],
      isModelRelease: Number(row.is_model_release) === 1,
      modelFamily: row.model_family ? String(row.model_family) : null,
      analyzedAt: String(row.analyzed_at),
    },
  };
}

/* ============================================================
   Model versions
   ============================================================ */

export function saveModelVersion(model: ModelVersion): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO model_versions (
         family, name, version, source_article_id, reasoning, math, coding,
         multimodal, agent, params, context_length, latency, cost, open_weights,
         api_available, license, deployment, benchmarks, eval_note, claim_origin, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(family, version) DO UPDATE SET
         name = excluded.name,
         source_article_id = excluded.source_article_id,
         params = COALESCE(excluded.params, model_versions.params),
         open_weights = COALESCE(excluded.open_weights, model_versions.open_weights),
         license = COALESCE(excluded.license, model_versions.license),
         benchmarks = excluded.benchmarks,
         eval_note = excluded.eval_note,
         claim_origin = excluded.claim_origin,
         updated_at = excluded.updated_at`,
    )
    .run(
      model.family,
      model.name,
      model.version,
      model.sourceArticleId,
      model.reasoning,
      model.math,
      model.coding,
      model.multimodal,
      model.agent,
      model.params,
      model.contextLength,
      model.latency,
      model.cost,
      model.openWeights === null ? null : model.openWeights ? 1 : 0,
      model.apiAvailable === null ? null : model.apiAvailable ? 1 : 0,
      model.license,
      model.deployment,
      JSON.stringify(model.benchmarks),
      model.evalNote,
      model.claimOrigin,
      model.updatedAt,
    );
}

export function listModelFamilies(): ModelFamily[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT * FROM model_versions ORDER BY family, updated_at DESC`,
    )
    .all() as Record<string, unknown>[];

  const grouped = new Map<string, ModelVersion[]>();
  for (const row of rows) {
    const version: ModelVersion = {
      family: String(row.family),
      name: String(row.name),
      version: row.version ? String(row.version) : null,
      sourceArticleId: row.source_article_id ? Number(row.source_article_id) : null,
      reasoning: row.reasoning ? String(row.reasoning) : null,
      math: row.math ? String(row.math) : null,
      coding: row.coding ? String(row.coding) : null,
      multimodal: row.multimodal ? String(row.multimodal) : null,
      agent: row.agent ? String(row.agent) : null,
      params: row.params ? String(row.params) : null,
      contextLength: row.context_length ? String(row.context_length) : null,
      latency: row.latency ? String(row.latency) : null,
      cost: row.cost ? String(row.cost) : null,
      openWeights: row.open_weights === null ? null : Number(row.open_weights) === 1,
      apiAvailable: row.api_available === null ? null : Number(row.api_available) === 1,
      license: row.license ? String(row.license) : null,
      deployment: row.deployment ? String(row.deployment) : null,
      benchmarks: parseJson(String(row.benchmarks ?? "[]"), [] as string[]),
      evalNote: String(row.eval_note),
      claimOrigin: row.claim_origin as ModelVersion["claimOrigin"],
      updatedAt: String(row.updated_at),
    };
    const list = grouped.get(version.family) ?? [];
    list.push(version);
    grouped.set(version.family, list);
  }

  return [...grouped.entries()].map(([family, versions]) => ({
    family,
    versions,
    comparisonNote: buildComparisonNote(versions),
  }));
}

function buildComparisonNote(versions: ModelVersion[]): string {
  if (versions.length < 2) {
    return "仅记录到一个版本，暂无版本间比较。";
  }
  const hasAnyCapability = versions.some(
    (v) =>
      v.reasoning || v.math || v.coding || v.multimodal || v.agent || v.params,
  );
  if (!hasAnyCapability) {
    return "缺乏可直接比较的证据 — 未从来源中提取到可比较的能力分数、参数规模或上下文长度。";
  }
  return "已记录部分版本字段；能力分数的横向比较仍缺乏可直接比较的独立评测证据。";
}

/* ============================================================
   Briefings
   ============================================================ */

export function saveBriefing(
  date: string,
  payload: DailyBriefing,
  articleIds: number[],
): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO briefings (date, generated_at, payload, article_ids)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         generated_at = excluded.generated_at,
         payload = excluded.payload,
         article_ids = excluded.article_ids`,
    )
    .run(date, payload.generatedAt, JSON.stringify(payload), JSON.stringify(articleIds));
}

export function getBriefing(date: string): DailyBriefing | null {
  const database = getDb();
  const row = database
    .prepare(`SELECT payload FROM briefings WHERE date = ?`)
    .get(date) as { payload: string } | undefined;
  return row ? (parseJson(row.payload, null) as DailyBriefing | null) : null;
}
