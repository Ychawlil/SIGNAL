import "server-only";
import type { AnalyzedArticleRow } from "./store";
import type {
  BriefingEvidenceSummary,
  BriefingItem,
  BriefingSection,
  BriefingTheme,
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

/**
 * Stable identity for "the same story". arXiv serves one paper as both
 * `/abs/<id>` and `/abs/<id>vN`, so the two providers produce distinct rows
 * and URLs but an identical title; deduplicating on the normalized title
 * keeps a refresh from listing (or double-counting) the same signal twice.
 */
function identityKey(article: AnalyzedArticleRow): string {
  const title = article.title.toLowerCase().replace(/\s+/g, " ").trim();
  return title || article.url.toLowerCase();
}

export function generateBriefing(
  articles: AnalyzedArticleRow[],
  now = new Date(),
): DailyBriefing {
  const cutoff = now.getTime() - 7 * 86400000;
  const seen = new Set<string>();

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
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = identityKey(c.article);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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

  const selected = sections.flatMap((section) =>
    section.items.map((item) => ({ item, section: section.key })),
  );

  const keyThemes = buildKeyThemes(selected);
  const evidence = {
    high: selected.filter((entry) => entry.item.confidenceLevel === "high").length,
    medium: selected.filter((entry) => entry.item.confidenceLevel === "medium").length,
    low: selected.filter((entry) => entry.item.confidenceLevel === "low").length,
  };

  const date = now.toISOString().slice(0, 10);
  const intro = count === 0
    ? "过去 7 天内没有达到质量阈值的情报，今日简报不凑数。"
    : `基于过去 24 小时的新进展并回补 7 天内的重要成果，共精选 ${count} 条。`;
  const digest = buildDigest(sections, selected.length, evidence);

  return {
    date,
    generatedAt: now.toISOString(),
    count,
    intro,
    sections,
    reduced,
    keyThemes,
    digest,
    evidence,
    window: { freshHours: 24, backfillDays: 7 },
  };
}

/* ------------------------------------------------------------------ */
/* Section A helpers — all derived from the selected items             */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  "ai-models": "AI Models & Releases",
  "ai-research": "AI Research",
  "ai-math": "AI × Mathematics",
  "ai-cs": "AI × Computer Science",
  "physical-ai": "Physical AI & Robotics",
  "agents-coding": "Agents & Coding",
  "open-source": "Open Source & GitHub",
  signals: "Signals & Community",
  "other-science": "Other Science",
};

/** Which tracked topic each category feeds (mirrors lib/topics). */
const CATEGORY_TOPICS: Record<string, { id: string; label: string }[]> = {
  "ai-models": [
    { id: "llm-reasoning", label: "LLM Reasoning" },
    { id: "ai-agents", label: "AI Agents" },
  ],
  "ai-research": [
    { id: "llm-reasoning", label: "LLM Reasoning" },
    { id: "world-models", label: "World Models" },
  ],
  "ai-math": [{ id: "ai-math", label: "AI for Mathematics" }],
  "ai-cs": [{ id: "ai-systems", label: "AI for Systems" }],
  "physical-ai": [
    { id: "vla", label: "VLA" },
    { id: "robot-learning", label: "Robot Learning" },
  ],
  "agents-coding": [{ id: "ai-agents", label: "AI Agents" }, { id: "ai-coding", label: "AI Coding" }],
  "open-source": [{ id: "ai-coding", label: "AI Coding" }],
  signals: [{ id: "ai-agents", label: "AI Agents" }],
  "other-science": [],
};

function buildKeyThemes(
  selected: { item: BriefingItem; section: string }[],
): BriefingTheme[] {
  const themes = new Map<string, BriefingTheme>();

  for (const { item } of selected) {
    const topics = CATEGORY_TOPICS[item.category] ?? [];

    // Prefer the tracked topic (filterable and specific). Only fall back to a
    // category chip when the category has no topic mapping, so the same signal
    // never shows up twice under two similar labels.
    if (topics.length > 0) {
      for (const topic of topics) {
        const existing = themes.get(`topic:${topic.id}`);
        if (existing) existing.count += 1;
        else
          themes.set(`topic:${topic.id}`, {
            label: topic.label,
            topic: topic.id,
            category: null,
            count: 1,
          });
      }
      continue;
    }

    const label = CATEGORY_LABELS[item.category] ?? item.category;
    const existing = themes.get(`category:${item.category}`);
    if (existing) existing.count += 1;
    else
      themes.set(`category:${item.category}`, {
        label,
        topic: null,
        category: item.category,
        count: 1,
      });
  }

  return [...themes.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function trimSentence(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return `${(boundary > max * 0.5 ? cut.slice(0, boundary) : cut).trim()}…`;
}

/** Join sentences, inserting a space only after Latin-ending sentences. */
function joinSentences(list: string[]): string {
  return list.reduce((acc, sentence) => {
    if (!acc) return sentence;
    return acc + (/[A-Za-z0-9.)\]]$/.test(acc) ? " " : "") + sentence;
  }, "");
}

function buildDigest(
  sections: BriefingSection[],
  count: number,
  evidence: BriefingEvidenceSummary,
): string {
  if (count === 0) {
    return "今日没有达到精选阈值的情报。为避免用低质量内容填满版面，本节保持为空；可稍后在设置页重新同步数据源。";
  }

  const sentences: string[] = [];

  const covered = sections
    .filter((section) => section.key !== "top")
    .map((section) => section.title.replace(/[（(].*$/, ""));
  sentences.push(
    covered.length > 0
      ? `本期共 ${count} 条精选，覆盖 ${covered.length + 1} 个板块：今日重点，以及${covered.join("、")}。`
      : `本期共 ${count} 条精选。`,
  );

  const top = sections.find((section) => section.key === "top")?.items[0];
  if (top) {
    const change = trimSentence(top.keyChange || top.oneLineSummary, 120);
    const title = trimSentence(top.title, 90);
    sentences.push(
      change
        ? `核心看点是「${title}」，关键变化：${/[.。!?！？…]$/.test(change) ? change : `${change}。`}`
        : `核心看点是「${title}」。`,
    );
  }

  const untrusted = evidence.low;
  sentences.push(
    evidence.high + evidence.medium + untrusted === 0
      ? "证据状态尚未评估，阅读时请回到原始来源核对。"
      : `证据状态：${evidence.high} 条高可信、${evidence.medium} 条部分验证${
          untrusted > 0 ? `、${untrusted} 条待验证` : ""
        }；重要性与可信度独立评估，热度不等于可信。`,
  );

  return joinSentences(sentences);}
