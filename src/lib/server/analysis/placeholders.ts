/**
 * Text the deterministic rule engine produces when it cannot extract
 * something better.
 *
 * These strings are also the marker for "this field was never actually
 * analyzed": the LLM engine refuses to persist them, and the re-analysis pass
 * looks for them so a stored template does not masquerade as analysis in the
 * daily briefing. Keep the wording stable — it is matched against DB rows.
 */

export const RULE_BASED_LIMITATIONS_PLACEHOLDER =
  "已知局限与未解决问题未在摘要中明确说明；需阅读原文进一步确认。";

/** Fallback "why it matters" per category (stored as analyses.impact). */
export const RULE_BASED_IMPACT: Record<string, string> = {
  "physical-ai":
    "具身智能与机器人方向：可能影响操作策略、数据管线或世界模型的技术路线。",
  "ai-math":
    "AI × 数学：可能推动定理证明与形式化验证的自动化与可信度。",
  "ai-cs":
    "AI × 计算机系统：可能影响推理/训练基础设施的效率、成本与软件工程实践。",
  "ai-research":
    "AI 研究：可能影响后续方法演进、社区复现与评估方式。",
  "ai-models":
    "模型发布：可能改变能力边界、推理成本与开放生态格局。",
  "agents-coding":
    "智能体与编码：可能改变软件开发工作流与自主系统能力。",
  "open-source":
    "开源生态：可能影响可复现性、社区协作与工具链演进。",
  signals:
    "社区信号：作为早期信号，影响尚待验证，值得持续观察。",
  "other-science":
    "跨学科前沿：方法迁移价值较高，值得关注其对 AI 的间接影响。",
};

/** Fallback "personal relevance" per category (analyses.personal_relevance). */
export const RULE_BASED_LEARNING: Record<string, string> = {
  "physical-ai":
    "与重点方向「具身智能」直接相关，适合跟踪数据规模与泛化实验设计。",
  "ai-math":
    "与「AI × 数学」方向相关，适合学习「生成—验证」循环与形式化方法。",
  "ai-cs":
    "与「AI × 计算机」方向相关，适合理解模型能力如何落地为系统。",
  "ai-research":
    "适合作为精读材料，理解方法创新与证据结构。",
  "ai-models":
    "适合本地复现或跟踪能力边界，建立对模型发布的第一手判断。",
  "agents-coding":
    "可直接用于日常学习与项目开发，观察智能体的规划与失败模式。",
  "open-source":
    "适合动手复现或阅读源码，理解真实工程的取舍。",
  signals:
    "作为待验证问题观察，训练自己分辨信号与噪声。",
  "other-science":
    "作为跨领域样本，保持对方法迁移的敏感。",
};

/** Every rule-engine placeholder, for stale-analysis detection in SQL. */
export const RULE_BASED_PLACEHOLDERS: string[] = [
  RULE_BASED_LIMITATIONS_PLACEHOLDER,
  ...Object.values(RULE_BASED_IMPACT),
  ...Object.values(RULE_BASED_LEARNING),
];
