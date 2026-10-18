import type {
  Category,
  CategoryId,
  SortKey,
  TopicId,
  TrackingStatus,
} from "./types";

export const APP_NAME = "SIGNAL";
export const APP_TAGLINE = "AI & Frontier Technology Intelligence Hub";

export const CATEGORIES: Category[] = [
  { id: "ai-models", label: "AI Models & Releases", shortLabel: "Models", description: "New model releases, checkpoints, and capability jumps." },
  { id: "ai-research", label: "AI Research", shortLabel: "Research", description: "Papers and techniques advancing the field." },
  { id: "ai-math", label: "AI × Mathematics", shortLabel: "Math", description: "Formal reasoning, theorem proving, and mathematical discovery." },
  { id: "ai-cs", label: "AI × Computer Science", shortLabel: "Systems", description: "Systems, compilers, architectures, and algorithms." },
  { id: "physical-ai", label: "Physical AI & Robotics", shortLabel: "Robotics", description: "Embodied intelligence, robots, and the physical world." },
  { id: "agents-coding", label: "Agents & Coding", shortLabel: "Agents", description: "Autonomous agents and AI-assisted software." },
  { id: "open-source", label: "Open Source & GitHub", shortLabel: "OSS", description: "Repositories, communities, and open weight movements." },
  { id: "signals", label: "Signals & Community", shortLabel: "Signals", description: "Early whispers, debates and weak signals from the community." },
  { id: "other-science", label: "Other Science", shortLabel: "Science", description: "Adjacent breakthroughs in the broader sciences." },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export const TOPIC_NAMES: Record<TopicId, string> = {
  "llm-reasoning": "LLM Reasoning",
  "ai-coding": "AI Coding",
  "ai-agents": "AI Agents",
  "world-models": "World Models",
  vla: "VLA",
  "robot-learning": "Robot Learning",
  "ai-math": "AI for Mathematics",
  "ai-systems": "AI for Systems",
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "importance", label: "Importance" },
  { value: "newest", label: "Newest first" },
];

export const TRACKING_META: Record<TrackingStatus, { label: string; hint: string }> = {
  active: { label: "Actively tracking", hint: "持续追踪，每日更新" },
  watching: { label: "Watching", hint: "保持关注，低频率追踪" },
  paused: { label: "Paused", hint: "暂不追踪" },
};

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide icon key
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Daily Briefing", icon: "newspaper" },
  { href: "/explore", label: "Explore", icon: "compass" },
  { href: "/research", label: "Research", icon: "flask" },
  { href: "/topics", label: "Topics", icon: "layers" },
  { href: "/library", label: "Library", icon: "bookmark" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export const STORAGE_KEYS = {
  theme: "signal.theme",
  library: "signal.library",
  topics: "signal.topics",
  settings: "signal.settings",
} as const;
