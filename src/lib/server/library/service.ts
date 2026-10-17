import "server-only";
import {
  getArticleWithAnalysis,
  getWeeklyReview,
  isSaved,
  listSavedItems,
  queryArticleIdsForRelated,
  saveWeeklyReview,
} from "./store";
import type {
  LearningPlan,
  LearningSuggestion,
  RelatedGroup,
  RelatedItem,
  WeeklyReview,
} from "./types";

function weekStart(now = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay() || 7; // Monday = 1
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function buildRelated(articleId: number): {
  article: { title: string };
  groups: RelatedGroup[];
} {
  const target = getArticleWithAnalysis(articleId);
  if (!target) return { article: { title: "" }, groups: [] };

  const toRelated = (
    rows: { id: number; title: string; url: string; category: string; sourceName: string; publishedAt: string }[],
  ): RelatedItem[] =>
    rows.map((row) => ({
      articleId: row.id,
      title: row.title,
      url: row.url,
      category: row.category,
      sourceName: row.sourceName,
      publishedAt: row.publishedAt,
      saved: isSaved(row.id),
    }));

  const groups: RelatedGroup[] = [];

  if (target.modelFamily) {
    const rows = queryArticleIdsForRelated({
      modelFamily: target.modelFamily,
      excludeId: articleId,
      limit: 10,
    });
    groups.push({
      key: "model",
      label: `同一模型 / 项目：${target.modelFamily}`,
      items: toRelated(rows),
    });
  }

  const topicRows = queryArticleIdsForRelated({
    category: target.category,
    excludeId: articleId,
    limit: 10,
  });
  groups.push({
    key: "topic",
    label: `同一主题：${target.category}`,
    items: toRelated(topicRows),
  });

  return { article: { title: target.article.title }, groups };
}

export function buildWeeklyReview(): WeeklyReview {
  const saved = listSavedItems({});
  const generatedAt = new Date().toISOString();

  if (saved.length < 3) {
    return {
      weekStart: weekStart(),
      generatedAt,
      savedCount: saved.length,
      importantChanges: [],
      techRoutes: [],
      openQuestions: [],
      note: `本周仅收藏 ${saved.length} 条情报（至少 3 条才生成回顾），暂不凑数。`,
    };
  }

  const ranked = [...saved].sort(
    (a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0),
  );

  const importantChanges = ranked
    .filter((item) => item.keyChange)
    .slice(0, 5)
    .map((item) => ({
      title: item.article.title,
      keyChange: item.keyChange ?? "",
      url: item.article.url,
    }));

  const routeMap = new Map<string, { count: number; titles: string[] }>();
  for (const item of saved) {
    const route = item.modelFamily ?? item.article.category;
    const entry = routeMap.get(route) ?? { count: 0, titles: [] };
    entry.count += 1;
    if (entry.titles.length < 3) entry.titles.push(item.article.title);
    routeMap.set(route, entry);
  }
  const techRoutes = [...routeMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([route, value]) => ({ route, count: value.count, titles: value.titles }));

  const openQuestions = saved
    .filter((item) => item.limitations)
    .slice(0, 6)
    .map((item) => ({
      title: item.article.title,
      question: item.limitations ?? "",
      url: item.article.url,
    }));

  const review: WeeklyReview = {
    weekStart: weekStart(),
    generatedAt,
    savedCount: saved.length,
    importantChanges,
    techRoutes,
    openQuestions,
    note: `基于本周收藏的 ${saved.length} 条情报生成。`,
  };

  saveWeeklyReview(review);
  return review;
}

export function getOrBuildWeeklyReview(): WeeklyReview {
  const cached = getWeeklyReview(weekStart());
  if (cached) return cached;
  return buildWeeklyReview();
}

export function buildLearningPlan(): LearningPlan {
  const saved = listSavedItems({});
  const suggestions: LearningSuggestion[] = [];
  const generatedAt = new Date().toISOString();

  const papers = saved.filter(
    (item) => item.article.provider === "arxiv" || item.article.provider === "arxiv-rss",
  );
  const repos = saved.filter((item) => item.article.provider === "github");
  const withLimitations = saved.filter((item) => item.limitations);

  const rankedPapers = [...papers].sort(
    (a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0),
  );

  for (const item of rankedPapers.slice(0, 3)) {
    suggestions.push({
      kind: "read",
      title: item.article.title,
      action: `建议精读：先读方法，再对照证据与局限（${item.article.sourceName}）。`,
      url: item.article.url,
    });
  }

  for (const item of repos.slice(0, 2)) {
    suggestions.push({
      kind: "reproduce",
      title: item.article.title,
      action: "建议复现 / 跑通最小示例：从 README 开始，记录环境与结果。",
      url: item.article.url,
    });
  }

  for (const item of withLimitations.slice(0, 2)) {
    suggestions.push({
      kind: "verify",
      title: item.article.title,
      action: `建议验证一个开放问题：${item.limitations}`,
      url: item.article.url,
    });
  }

  for (const item of saved.filter((s) => s.modelFamily).slice(0, 2)) {
    suggestions.push({
      kind: "track",
      title: `${item.modelFamily}`,
      action: "建议持续追踪该模型 / 项目的版本变化与第三方评测。",
      url: item.article.url,
    });
  }

  return {
    generatedAt,
    disclaimer:
      "以下为基于你收藏情报生成的学习建议，仅代表待办方向，并非已完成的行动记录。",
    suggestions: suggestions.slice(0, 8),
  };
}
