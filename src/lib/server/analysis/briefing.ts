import "server-only";
import type { AnalyzedArticleRow } from "./store";
import {
  BRIEFING_SCHEMA_VERSION,
  type BriefingItem,
  type BriefingSection,
  type BriefingSourceMix,
  type BriefingTheme,
  type DailyBriefing,
} from "./types";

const MIN_IMPORTANCE = 45;
/** Selection window: only the last 24 hours of published content. */
const WINDOW_HOURS = 24;
/**
 * Default briefing size when the caller does not specify the user's
 * "daily signal count". Matches the editorial 3–5 rule.
 */
export const DEFAULT_BRIEFING_ITEMS = 5;

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
  };
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

/** Hard ceiling for the briefing size, matching the Settings control. */
export const MAX_BRIEFING_ITEMS = 30;
const MIN_BRIEFING_ITEMS = 1;

export function clampBriefingItems(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    return DEFAULT_BRIEFING_ITEMS;
  }
  return Math.min(
    MAX_BRIEFING_ITEMS,
    Math.max(MIN_BRIEFING_ITEMS, Math.round(parsed)),
  );
}

export interface BriefingOptions {
  /** Maximum number of items across all sections (the daily signal count). */
  maxItems?: number;
}

export function generateBriefing(
  articles: AnalyzedArticleRow[],
  now = new Date(),
  options: BriefingOptions = {},
): DailyBriefing {
  const maxItems = clampBriefingItems(options.maxItems ?? DEFAULT_BRIEFING_ITEMS);
  const cutoff = now.getTime() - WINDOW_HOURS * 3600000;
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
    }))
    .filter((c) => c.section !== null)
    // Inside a single 24h window freshness is no longer a differentiator,
    // so ranking is pure importance, then most recent first.
    .sort(
      (a, b) =>
        b.article.analysis.importanceScore - a.article.analysis.importanceScore ||
        new Date(b.article.publishedAt).getTime() -
          new Date(a.article.publishedAt).getTime(),
    )
    .filter((c) => {
      const key = identityKey(c.article);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const used = new Set<number>();
  const sections: BriefingSection[] = [];
  const titles = new Map(SECTION_DEFS.map((def) => [def.key, def.title]));

  const addToSection = (key: BriefingSection["key"], article: AnalyzedArticleRow) => {
    used.add(article.id);
    const existing = sections.find((section) => section.key === key);
    if (existing) {
      existing.items.push(toItem(article));
      return;
    }
    sections.push({ key, title: titles.get(key) ?? key, items: [toItem(article)] });
  };

  const addFirstFor = (key: BriefingSection["key"]): boolean => {
    const match = candidates.find(
      (c) => c.section === key && !used.has(c.article.id),
    );
    if (!match) return false;
    addToSection(key, match.article);
    return true;
  };

  // "top" is the single highest-scoring item regardless of section.
  if (candidates[0] && maxItems > 0) {
    addToSection("top", candidates[0].article);
  }

  // One representative per main section, as long as the budget allows.
  for (const def of SECTION_DEFS.slice(1, 5)) {
    if (used.size >= maxItems) break;
    addFirstFor(def.key);
  }

  // Optional "other science" only when a slot is free and a section is missing.
  if (used.size < maxItems && sections.length < 5) {
    addFirstFor("other-science");
  }

  // Remaining budget: keep adding the next most important items, even if a
  // section already has one. This is what makes the "daily signal count"
  // setting meaningful for counts above one-per-section.
  if (used.size < maxItems) {
    for (const candidate of candidates) {
      if (used.size >= maxItems) break;
      if (used.has(candidate.article.id)) continue;
      const key = candidate.section;
      if (!key) continue;
      addToSection(key, candidate.article);
    }
  }

  const count = used.size;
  const reduced = count < 3;

  const selected = sections.flatMap((section) =>
    section.items.map((item) => ({ item, section: section.key })),
  );

  const keyThemes = buildKeyThemes(selected);
  const sourceMix = buildSourceMix(selected);

  const date = now.toISOString().slice(0, 10);
  const intro =
    count === 0
      ? "过去 24 小时内没有达到重要性阈值的情报，今日简报不凑数。"
      : `仅统计过去 24 小时内发布、重要性 ≥ ${MIN_IMPORTANCE} 的情报，共精选 ${count} 条。`;
  const digest = buildDigest(sections, selected.length, sourceMix);

  return {
    version: BRIEFING_SCHEMA_VERSION,
    date,
    generatedAt: now.toISOString(),
    count,
    intro,
    sections,
    reduced,
    keyThemes,
    digest,
    sourceMix,
    windowHours: WINDOW_HOURS,
    maxItems,
  };
}

function buildSourceMix(
  selected: { item: BriefingItem; section: string }[],
): BriefingSourceMix[] {
  const counts = new Map<string, number>();
  for (const { item } of selected) {
    counts.set(item.sourceName, (counts.get(item.sourceName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([sourceName, count]) => ({ sourceName, count }))
    .sort((a, b) => b.count - a.count || a.sourceName.localeCompare(b.sourceName));
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
  sourceMix: BriefingSourceMix[],
): string {
  if (count === 0) {
    return "过去 24 小时内没有达到重要性阈值的情报。为避免用低质量内容填满版面，本节保持为空；可稍后在设置页重新同步数据源。";
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

  if (sourceMix.length > 0) {
    sentences.push(
      `来源构成：${sourceMix
        .map((entry) => `${entry.sourceName} ${entry.count} 条`)
        .join("、")}。`,
    );
  }

  return joinSentences(sentences);}
