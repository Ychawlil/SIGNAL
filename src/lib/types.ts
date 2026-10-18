/* ============================================================
   SIGNAL — Domain types
   Data structures are designed to map 1:1 onto a future API /
   database layer. Keep them framework-agnostic.
   ============================================================ */

export type CategoryId =
  | "ai-models"
  | "ai-research"
  | "ai-math"
  | "ai-cs"
  | "physical-ai"
  | "agents-coding"
  | "open-source"
  | "signals"
  | "other-science";

export type TopicId =
  | "llm-reasoning"
  | "ai-coding"
  | "ai-agents"
  | "world-models"
  | "vla"
  | "robot-learning"
  | "ai-math"
  | "ai-systems";

export type ReadStatus = "unread" | "read";

export type TrackingStatus = "active" | "watching" | "paused";

export type SortKey = "importance" | "newest";

export interface Category {
  id: CategoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface Topic {
  id: TopicId;
  name: string;
  shortName: string;
  description: string;
  /** Signal count for display — derived from a live API in the future. */
  recentSignalCount: number;
  keyDevelopments: string[];
  trackingStatus: TrackingStatus;
  relatedCategories: CategoryId[];
}

export interface IntelligenceItem {
  id: string;
  title: string;
  summary: string;
  category: CategoryId;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string; // ISO 8601
  importanceScore: number; // 0–100
  keyChange: string;
  whyItMatters: string;
  limitations: string;
  personalRelevance: string;
  tags: string[];
  topics: TopicId[];
  readingTimeMinutes: number;
}

export type ResearchKind = "paper" | "report" | "open-source";

export interface ResearchItem {
  id: string;
  title: string;
  kind: ResearchKind;
  category: CategoryId;
  topics: TopicId[];
  researchQuestion: string;
  coreMethod: string;
  innovation: string;
  evidence: string;
  limitations: string;
  relatedWorks: string[];
  readingOrder: string[];
  sourceName: string;
  publishedAt: string;
  importanceScore: number;
  tags: string[];
}

export interface WorthFollowingItem {
  id: string;
  name: string;
  kind: "model" | "paper" | "repo" | "team";
  description: string;
  whyFollow: string;
  referenceUrl: string;
}

export interface WeeklyDirectionItem {
  id: string;
  title: string;
  summary: string;
  openQuestions: string[];
  relatedSignalIds: string[];
}

export interface DailyBriefing {
  date: string; // ISO date
  status: "generated" | "generating" | "stale";
  generatedAt: string;
  signalCount: number;
  intro: string;
  keyThemes: string[];
  signalOfTheDayId: string;
}

export interface FocusArea {
  id: TopicId;
  label: string;
  weight: number; // 0–100
}

export interface AppSettings {
  /** 每日情报数量 */
  dailySignalCount: number;
  defaultSort: SortKey;
  focusAreas: FocusArea[];
  /** 数据更新状态占位（本阶段无真实同步） */
  dataStatus: "never-synced" | "synced";
  lastSyncedAt: string | null;
}

export interface LibraryState {
  favoriteIds: string[];
  notes: Record<string, string>;
  readIds: string[];
}

export interface TopicsState {
  subscribedIds: TopicId[];
}
