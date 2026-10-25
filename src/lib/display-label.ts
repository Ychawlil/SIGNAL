const LABELS: Record<string, string> = {
 independent: "独立验证", vendor: "官方声明", unknown: "未知", community: "社区信息", preprint: "预印本", "peer-reviewed": "同行评审", model: "模型", tool: "工具", paper: "论文", repo: "代码仓库", release: "发布", researcher: "研究者", collecting: "采集中", paused: "已暂停", new: "新增", vla: "视觉语言动作模型", "robot-learning": "机器人学习", "world-model": "世界模型", llm: "大语言模型", "ai-agents": "AI 智能体", "ai-coding": "AI 编程", "theorem-proving": "定理证明", "llm-inference": "大模型推理服务"
};
export function displayLabel(value: string): string { return LABELS[value] ?? value; }
