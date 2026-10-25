import type { CategoryId } from "@/lib/types";
export type PlanetId = "ai-frontier" | "research" | "open-source" | "community" | "science" | "library" | "briefing";
export interface PlanetConfig {
  id: PlanetId;
  name: string;
  label: string;
  subtitle: string;
  description: string;
  color: string;
  terrainColor: string;
  accentColor: string;
  position: [number, number, number];
  radius: number;
  seed: number;
  orbit?: { radius: number; phase: number; inclination: number };
  categories: CategoryId[];
  href: string;
  secondary?: { href: string; label: string };
  landform: "crystal" | "ruins" | "machines" | "desert" | "ice" | "archive" | "sun";
  // A future GLB renderer can replace createPlanetModel without changing navigation.
  modelUrl?: string;
}
const WORLDS: PlanetConfig[] = [
 { id: "ai-frontier", name: "AI Frontier", label: "AI 前沿", subtitle: "在智能的边界，发现下一步。", description: "模型发布、智能体与能力变化。从原始信息出发，辨认真正值得关注的技术进展。", color: "#76949e", terrainColor: "#adc2c0", accentColor: "#b7d6dc", position: [-4.2, 1.5, 1.7], radius: 1.72, seed: 11, categories: ["ai-models", "agents-coding"], href: "/explore?planet=ai-frontier", landform: "crystal" },
 { id: "research", name: "Research", label: "研究", subtitle: "沿着问题，走向更深的地方。", description: "数学、计算机科学与 AI 论文。追踪方法、实验、证明，以及仍未解决的问题。", color: "#9b9485", terrainColor: "#c9bda2", accentColor: "#dbd0b7", position: [-1.4, 3.8, -5.6], radius: 1.25, seed: 29, categories: ["ai-research", "ai-math", "ai-cs"], href: "/explore?planet=research", secondary: { href: "/research", label: "打开深度研究" }, landform: "ruins" },
 { id: "open-source", name: "Open Source", label: "开源", subtitle: "让想法，成为可以运行的东西。", description: "开源仓库、开发工具与社区项目。收藏值得动手尝试的实现，继续追踪它们的演进。", color: "#667b66", terrainColor: "#9bab80", accentColor: "#c0d4ac", position: [4.3, -.9, .2], radius: 1.46, seed: 43, categories: ["open-source"], href: "/explore?planet=open-source", secondary: { href: "/trends", label: "查看项目趋势" }, landform: "machines" },
 { id: "community", name: "Community", label: "社区", subtitle: "听见技术世界里的不同声音。", description: "Hacker News 与已接入 RSS 的技术讨论、工具分享与早期信号。当前未接入 X 数据源。", color: "#ad805d", terrainColor: "#d2b78b", accentColor: "#e8c49b", position: [-7.2, -1.8, -2.1], radius: 1.08, seed: 67, categories: ["signals"], href: "/explore?planet=community", landform: "desert" },
 { id: "science", name: "Science", label: "科学", subtitle: "把视线，投向更辽阔的未知。", description: "具身智能、机器人与其他科学进展。从物理世界到新的发现，保留好奇，也保留证据。", color: "#91abb3", terrainColor: "#d7e1dc", accentColor: "#d5e8e8", position: [.5, -1.5, 5.7], radius: 1.34, seed: 83, categories: ["physical-ai", "other-science"], href: "/explore?planet=science", landform: "ice" },
 { id: "library", name: "Library", label: "研究库", subtitle: "把值得保留的信号，收进自己的世界。", description: "统一管理收藏、稍后阅读、研究合集、收藏项目的后续进展与每周回顾。这里保存来自所有星球的个人研究资料。", color: "#82798f", terrainColor: "#b6aabd", accentColor: "#d8c6df", position: [7.2, 2.7, -5.3], radius: 1.12, seed: 101, categories: [], href: "/library", landform: "archive" },
];
// Different phases and inclinations prevent a rigid arrangement.
const ORBITS = [
 { radius: 4.2, phase: 3.65, inclination: .08 },
 { radius: 6.4, phase: 5.0, inclination: -.10 },
 { radius: 8.5, phase: .25, inclination: .055 },
 { radius: 10.5, phase: 2.9, inclination: -.065 },
 { radius: 12.2, phase: 1.4, inclination: .07 },
 { radius: 14.1, phase: 5.6, inclination: -.04 },
];
export const PLANETS: readonly PlanetConfig[] = WORLDS.map((planet, index) => ({ ...planet, radius: planet.radius * .72, orbit: ORBITS[index] }));
export const SUN: PlanetConfig = { id: "briefing", name: "Sun", label: "每日简报", subtitle: "今日信号，从这里开始。", description: "汇总今天值得关注的科技资讯、核心变化与阅读重点。", color: "#c18b45", terrainColor: "#f0cf85", accentColor: "#efd2a0", position: [0, 0, 0], radius: 1.85, seed: 173, categories: [], href: "/briefing", landform: "sun" };
export const CELESTIAL_BODIES: readonly PlanetConfig[] = [...PLANETS, SUN];
/** Kepler-style angular speed: distant worlds take longer to complete an orbit. */
export function orbitalSpeed(radius: number): number { return Math.PI * 2 / 85 * Math.pow(4.2 / radius, 1.5); }
export function orbitPosition(planet: PlanetConfig, elapsed: number): [number, number, number] {
 if (!planet.orbit) return [...planet.position];
 const { radius, phase, inclination } = planet.orbit;
 const angle = phase + elapsed * orbitalSpeed(radius);
 return [Math.cos(angle) * radius, Math.sin(angle) * Math.sin(inclination) * radius, Math.sin(angle) * Math.cos(inclination) * radius];
}
export function getPlanet(id: string | null | undefined): PlanetConfig | undefined { return CELESTIAL_BODIES.find((planet) => planet.id === id); }
export interface PlanetStats { total: number; new24h: number; lastUpdatedAt: string | null; articleIds: string[]; kind: "article" | "saved" | "briefing"; }
export interface UniverseReport { sampledAt: string; totalArticles: number; planets: Record<PlanetId, PlanetStats>; }
