import "server-only";
import { getDb } from "../db";
import type { StoredArticle } from "../types";
import type {
  AnalysisResult,
  DailyBriefing,
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

export function saveAnalysis(result: AnalysisResult, engine = "rule-based"): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO analyses (
         article_id, one_liner, key_change, differences, evidence, limitations,
         impact, personal_relevance, further_reading, importance_score,
         importance_factors, evidence_basis, is_model_release, model_family,
         analyzed_at, engine
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         evidence_basis = excluded.evidence_basis,
         is_model_release = excluded.is_model_release,
         model_family = excluded.model_family,
         analyzed_at = excluded.analyzed_at,
         engine = excluded.engine`,
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
      result.evidenceBasis,
      result.isModelRelease ? 1 : 0,
      result.modelFamily,
      result.analyzedAt,
      engine,
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

export interface AnalyzedArticleRow extends StoredArticle { analysis: AnalysisResult; }

export function listResearchRecords(options: {
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
              an.importance_score, an.importance_factors, an.evidence_basis,
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
 * Every article published at or after `sinceIso`, whether or not it has an
 * analysis yet.
 *
 * Briefing selection must happen *before* the (paid) LLM analysis, so the
 * selection step needs the full candidate set, not just already-analyzed
 * rows.
 */
export interface ArticleRowWithAnalysis {
  article: StoredArticle;
  analysis: AnalysisResult | null;
  /** '' for rows written before the engine marker existed. */
  engine: string;
}

export function listArticleRowsSince(sinceIso: string): ArticleRowWithAnalysis[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT a.*, an.one_liner, an.key_change, an.differences, an.evidence,
              an.limitations, an.impact, an.personal_relevance, an.further_reading,
              an.importance_score, an.importance_factors, an.evidence_basis,
              an.is_model_release, an.model_family, an.analyzed_at, an.engine
       FROM articles a
       LEFT JOIN analyses an ON an.article_id = a.id
       WHERE a.published_at >= ?
       ORDER BY a.published_at DESC`,
    )
    .all(sinceIso) as Record<string, unknown>[];

  return rows.map((row) => {
    const full = rowToAnalyzedArticle(row);
    const hasAnalysis = row.one_liner !== null && row.one_liner !== undefined;
    return {
      article: {
        id: full.id,
        provider: full.provider,
        externalId: full.externalId,
        title: full.title,
        summary: full.summary,
        url: full.url,
        sourceName: full.sourceName,
        category: full.category,
        publishedAt: full.publishedAt,
        fetchedAt: full.fetchedAt,
        authors: full.authors,
        tags: full.tags,
        metrics: full.metrics,
      },
      analysis: hasAnalysis ? full.analysis : null,
      engine: row.engine ? String(row.engine) : "",
    };
  });
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
              an.importance_score, an.importance_factors, an.evidence_basis,
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
