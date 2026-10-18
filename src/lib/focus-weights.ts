import type { CategoryId, TopicId } from "./types";
import { TOPIC_CATEGORIES } from "./topics";

/**
 * Default关注权重 — mirrors the Settings defaults. Kept framework-agnostic so
 * both the client (Settings UI) and the server (importance scoring) agree on
 * one source of truth.
 */
export const DEFAULT_FOCUS_WEIGHTS: Record<TopicId, number> = {
  "llm-reasoning": 85,
  "ai-coding": 80,
  "ai-agents": 75,
  "world-models": 80,
  vla: 90,
  "robot-learning": 85,
  "ai-math": 80,
  "ai-systems": 70,
};

export const TOPIC_IDS = Object.keys(TOPIC_CATEGORIES) as TopicId[];

/** Relevance can never exceed this share of the importance score. */
export const MAX_RELEVANCE = 30;

/**
 * Categories no tracked topic covers (e.g. other-science) still need a
 * relevance value; using a fixed low baseline keeps them rankable without
 * pretending the user follows them.
 */
const FALLBACK_RELEVANCE = 14;

/** category → topics that feed it (inverse of TOPIC_CATEGORIES). */
const CATEGORY_TOPICS: Record<string, TopicId[]> = (() => {
  const map: Record<string, TopicId[]> = {};
  for (const [topic, categories] of Object.entries(TOPIC_CATEGORIES)) {
    for (const category of categories as CategoryId[]) {
      (map[category] ??= []).push(topic as TopicId);
    }
  }
  return map;
})();

export function topicsForCategory(category: CategoryId): TopicId[] {
  return CATEGORY_TOPICS[category] ?? [];
}

/**
 * Relevance factor (0–30) derived from the user's weights.
 *
 * An article's category can feed several tracked topics; the strongest
 * interest among them wins, so following VLA closely raises every
 * physical-ai item instead of averaging the interest away.
 */
export function relevanceForCategory(
  category: CategoryId,
  weights: Record<TopicId, number> = DEFAULT_FOCUS_WEIGHTS,
): number {
  const topics = topicsForCategory(category);
  if (topics.length === 0) return FALLBACK_RELEVANCE;

  let best = 0;
  for (const topic of topics) {
    const weight = weights[topic];
    if (typeof weight === "number" && Number.isFinite(weight)) {
      best = Math.max(best, weight);
    }
  }
  const clamped = Math.min(100, Math.max(0, best));
  return Math.round((clamped / 100) * MAX_RELEVANCE);
}

/** Clamp an arbitrary input to a valid weight (integer 0–100). */
export function clampWeight(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

/** Merge a partial patch over the defaults, dropping unknown topic ids. */
export function normalizeWeights(
  patch: Record<string, unknown> | null | undefined,
): Record<TopicId, number> {
  const next: Record<TopicId, number> = { ...DEFAULT_FOCUS_WEIGHTS };
  if (!patch) return next;
  for (const topic of TOPIC_IDS) {
    const value = clampWeight(patch[topic]);
    if (value !== null) next[topic] = value;
  }
  return next;
}
