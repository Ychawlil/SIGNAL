import type { StoredArticle } from "../types";

/** null = saved without a specific reading state. */
export type SaveStatus = "later" | "read" | "reproduce";

export interface SavedItemView {
  article: StoredArticle;
  savedAt: string;
  updatedAt: string;
  status: SaveStatus | null;
  notes: string;
  tags: string[];
  importanceScore: number | null;
  confidenceScore: number | null;
  confidenceLevel: string | null;
  modelFamily: string | null;
  keyChange: string | null;
  limitations: string | null;
}

export interface SavedFilters {
  q?: string;
  status?: SaveStatus | "all";
  topicId?: number;
  tag?: string;
}

export interface CustomTopic {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

export interface CustomKeyword {
  id: number;
  keyword: string;
  topicId: number | null;
  createdAt: string;
}

export interface ResearchCollection {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface CollectionItem {
  articleId: number;
  note: string;
  addedAt: string;
  title: string;
  url: string;
  sourceName: string;
  category: string;
  publishedAt: string;
}

export interface RelatedItem {
  articleId: number;
  title: string;
  url: string;
  category: string;
  sourceName: string;
  publishedAt: string;
  saved: boolean;
}

export interface RelatedGroup {
  key: "model" | "topic" | "tag";
  label: string;
  items: RelatedItem[];
}

export interface WeeklyReview {
  weekStart: string;
  generatedAt: string;
  savedCount: number;
  importantChanges: { title: string; keyChange: string; url: string }[];
  techRoutes: { route: string; count: number; titles: string[] }[];
  openQuestions: { title: string; question: string; url: string }[];
  note: string;
}

export interface LearningSuggestion {
  kind: "read" | "reproduce" | "verify" | "track";
  title: string;
  action: string;
  url: string;
}

export interface LearningPlan {
  generatedAt: string;
  disclaimer: string;
  suggestions: LearningSuggestion[];
}
