import type {
  Category,
  CategoryId,
  SortKey,
  TopicId,
  TrackingStatus,
} from "./types";

export const APP_NAME = "SIGNAL";
export const APP_TAGLINE = "AI 与前沿科技情报工作台";

export const CATEGORIES: Category[] = [
  { id: "ai-models", label: "AI 模型与发布", shortLabel: "模型", description: "模型发布、检查点与能力进展。" },
  { id: "ai-research", label: "AI 研究", shortLabel: "研究", description: "推动领域发展的论文与技术。" },
  { id: "ai-math", label: "AI 与数学", shortLabel: "数学", description: "形式推理、定理证明与数学发现。" },
  { id: "ai-cs", label: "AI 与计算机科学", shortLabel: "系统", description: "系统、编译器、架构与算法。" },
  { id: "physical-ai", label: "具身智能与机器人", shortLabel: "机器人", description: "具身智能、机器人与物理世界。" },
  { id: "agents-coding", label: "智能体与编程", shortLabel: "智能体", description: "自主智能体与 AI 辅助软件。" },
  { id: "open-source", label: "开源与 GitHub", shortLabel: "开源", description: "代码仓库、开源社区与开放权重动态。" },
  { id: "signals", label: "社区动态", shortLabel: "动态", description: "社区的早期动态、讨论与待验证信号。" },
  { id: "other-science", label: "其他科学", shortLabel: "科学", description: "其他科学领域的相关突破。" },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export const TOPIC_NAMES: Record<TopicId, string> = {
  "llm-reasoning": "大模型推理",
  "ai-coding": "AI 编程",
  "ai-agents": "AI 智能体",
  "physical-ai": "具身智能与机器人",
  "ai-math": "AI 数学",
  "ai-systems": "AI 系统",
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "importance", label: "重要性" },
  { value: "newest", label: "最新优先" },
];

export const TRACKING_META: Record<TrackingStatus, { label: string; hint: string }> = {
  active: { label: "持续追踪", hint: "持续追踪，每日更新" },
  watching: { label: "关注中", hint: "保持关注，低频率追踪" },
  paused: { label: "已暂停", hint: "暂不追踪" },
};

export const STORAGE_KEYS = {
  theme: "signal.theme",
  library: "signal.library",
  topics: "signal.topics",
  settings: "signal.settings",
  sidebar: "signal.sidebar",
} as const;
