import type { CategoryId, Topic, TopicId } from "./types";

/**
 * Static topic taxonomy. Signal counts and key developments are computed
 * from the real article database at render time; they are not hardcoded here.
 */
export const TOPICS: Topic[] = [
  {
    id: "llm-reasoning",
    name: "LLM Reasoning",
    shortName: "Reasoning",
    description:
      "推理能力的来源：测试时计算、搜索、验证器与可解释的思维链。",
    recentSignalCount: 0,
    keyDevelopments: [],
    trackingStatus: "active",
    relatedCategories: ["ai-models", "ai-research", "ai-math"],
  },
  {
    id: "ai-coding",
    name: "AI Coding",
    shortName: "Coding",
    description: "从代码补全到自主修复：编码智能体与软件工程工作流的重构。",
    recentSignalCount: 0,
    keyDevelopments: [],
    trackingStatus: "active",
    relatedCategories: ["agents-coding", "ai-cs", "open-source"],
  },
  {
    id: "ai-agents",
    name: "AI Agents",
    shortName: "Agents",
    description: "自主智能体的规划、记忆、工具使用与多智能体协作。",
    recentSignalCount: 0,
    keyDevelopments: [],
    trackingStatus: "watching",
    relatedCategories: ["agents-coding", "ai-research", "signals"],
  },
  {
    id: "physical-ai",
    name: "Physical AI & Robotics",
    shortName: "Physical AI",
    description:
      "具身智能统一方向：VLA、机器人学习与世界模型，不再拆成多个独立主题。",
    recentSignalCount: 0,
    keyDevelopments: [],
    trackingStatus: "active",
    relatedCategories: ["physical-ai", "ai-research"],
  },
  {
    id: "ai-math",
    name: "AI for Mathematics",
    shortName: "AI × Math",
    description: "定理证明、形式化验证与数学发现的自动化。",
    recentSignalCount: 0,
    keyDevelopments: [],
    trackingStatus: "watching",
    relatedCategories: ["ai-math", "ai-research"],
  },
  {
    id: "ai-systems",
    name: "AI for Systems",
    shortName: "AI × Systems",
    description: "推理系统、训练框架、调度与基础设施的效率革命。",
    recentSignalCount: 0,
    keyDevelopments: [],
    trackingStatus: "watching",
    relatedCategories: ["ai-cs", "open-source"],
  },
];

/**
 * Which article categories feed each tracked topic. Used to count signals
 * and to implement topic filtering over the real article database.
 */
export const TOPIC_CATEGORIES: Record<TopicId, CategoryId[]> = {
  "llm-reasoning": ["ai-models", "ai-research", "ai-math"],
  "ai-coding": ["agents-coding", "ai-cs", "open-source"],
  "ai-agents": ["agents-coding", "ai-research", "signals"],
  "physical-ai": ["physical-ai"],
  "ai-math": ["ai-math"],
  "ai-systems": ["ai-cs", "open-source"],
};

const CATEGORY_TOPICS: Record<CategoryId, TopicId[]> = Object.entries(
  TOPIC_CATEGORIES,
).reduce<Partial<Record<CategoryId, TopicId[]>>>((acc, [topic, categories]) => {
  for (const category of categories) {
    const list = acc[category] ?? [];
    if (!list.includes(topic as TopicId)) list.push(topic as TopicId);
    acc[category] = list;
  }
  return acc;
}, {}) as Record<CategoryId, TopicId[]>;

export function categoryToTopics(category: CategoryId): TopicId[] {
  return CATEGORY_TOPICS[category] ?? [];
}
