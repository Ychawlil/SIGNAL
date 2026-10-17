import "server-only";
import type { AnalyzedArticleRow } from "./store";
import type {
  BriefingItem,
  BriefingSection,
  DailyBriefing,
} from "./types";

const MIN_IMPORTANCE = 45;

const SECTION_DEFS: { key: BriefingSection["key"]; title: string }[] = [
  { key: "top", title: "今日最值得关注的进展" },
  { key: "models", title: "主要 AI 模型与技术变化" },
  { key: "math-cs", title: "AI × 数学 / 计算机科学" },
  { key: "embodied", title: "具身智能高价值进展" },
  { key: "open-research", title: "值得追踪的开源 / 研究信号" },
  { key: "other-science", title: "其他科学突破（可选）" },
];

function sectionFor(article: AnalyzedArticleRow): BriefingSection["key"] | null {
  if (article.analysis.isModelRelease || article.category === "ai-models") {
    return "models";
  }
  if (article.category === "ai-math" || article.category === "ai-cs") {
    return "math-cs";
  }
  if (article.category === "physical-ai") return "embodied";
  if (article.category === "open-source" || article.category === "ai-research") {
    return "open-research";
  }
  if (article.category === "other-science") return "other-science";
  if (article.category === "agents-coding") return "open-research";
  return null;
}

function toItem(article: AnalyzedArticleRow): BriefingItem {
  return {
    articleId: article.id,
    title: article.title,
    url: article.url,
    category: article.category,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    oneLineSummary: article.analysis.oneLineSummary,
    keyChange: article.analysis.keyChange,
    importanceScore: article.analysis.importanceScore,
    confidenceScore: article.analysis.confidenceScore,
    confidenceLevel: article.analysis.confidenceLevel,
  };
}

function freshnessBonus(publishedAt: string, now: Date): number {
  const ageHours = (now.getTime() - new Date(publishedAt).getTime()) / 3600000;
  if (ageHours >= 0 && ageHours <= 24) return 12;
  if (ageHours <= 72) return 6;
  return 0;
}

export function generateBriefing(
  articles: AnalyzedArticleRow[],
  now = new Date(),
): DailyBriefing {
  const cutoff = now.getTime() - 7 * 86400000;

  const candidates = articles
    .filter((article) => {
      const published = new Date(article.publishedAt).getTime();
      return (
        published >= cutoff &&
        published <= now.getTime() &&
        article.analysis.importanceScore >= MIN_IMPORTANCE
      );
    })
    .map((article) => ({
      article,
      section: sectionFor(article),
      score:
        article.analysis.importanceScore +
        freshnessBonus(article.publishedAt, now),
    }))
    .filter((c) => c.section !== null)
    .sort((a, b) => b.score - a.score);

  const used = new Set<number>();
  const sections: BriefingSection[] = [];

  // "top" is the single highest-scoring item regardless of section.
  const top = candidates[0];
  if (top) {
    used.add(top.article.id);
    sections.push({
      key: "top",
      title: SECTION_DEFS[0].title,
      items: [toItem(top.article)],
    });
  }

  for (const def of SECTION_DEFS.slice(1, 5)) {
    const match = candidates.find(
      (c) => c.section === def.key && !used.has(c.article.id),
    );
    if (match) {
      used.add(match.article.id);
      sections.push({ key: def.key, title: def.title, items: [toItem(match.article)] });
    }
  }

  // Optional "other science" only when there is still room and quality.
  if (sections.length < 5) {
    const match = candidates.find(
      (c) => c.section === "other-science" && !used.has(c.article.id),
    );
    if (match) {
      used.add(match.article.id);
      sections.push({ key: "other-science", title: SECTION_DEFS[5].title, items: [toItem(match.article)] });
    }
  }

  const count = sections.reduce((sum, s) => sum + s.items.length, 0);
  const reduced = count < 3;

  const date = now.toISOString().slice(0, 10);
  const intro = count === 0
    ? "过去 7 天内没有达到质量阈值的情报，今日简报不凑数。"
    : `基于过去 24 小时的新进展并回补 7 天内的重要成果，共精选 ${count} 条。`;

  return {
    date,
    generatedAt: now.toISOString(),
    count,
    intro,
    sections,
    reduced,
  };
}
