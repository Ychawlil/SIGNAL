import "server-only";
import type { StoredArticle } from "../types";
import { extractModelInfo } from "./model-extractor";
import {
  clampScore,
  containsAny,
  countNumbers,
  findArxivRefs,
  findBenchmarks,
  findUrls,
  firstSentence,
  splitSentences,
} from "./text";
import type {
  AnalysisEngine,
  AnalysisFactors,
  AnalysisResult,
  ConfidenceFactors,
  EvidenceBasis,
  FurtherReadingRef,
} from "./types";

/* ============================================================
   Focus profile — mirrors the user's stated interests (AI,
   embodied intelligence, math, CS, open source).
   ============================================================ */

const CATEGORY_RELEVANCE: Record<StoredArticle["category"], number> = {
  "physical-ai": 30,
  "ai-math": 28,
  "ai-research": 28,
  "ai-cs": 26,
  "ai-models": 26,
  "agents-coding": 24,
  "open-source": 20,
  signals: 14,
  "other-science": 16,
};

const CATEGORY_IMPACT: Record<StoredArticle["category"], string> = {
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

const CATEGORY_LEARNING: Record<StoredArticle["category"], string> = {
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

/* ============================================================
   Sentence-level extraction helpers
   ============================================================ */

function sentenceContaining(text: string, terms: string[], max = 260): string {
  const sentences = splitSentences(text);
  const hit = sentences.find((s) => containsAny(s, terms));
  if (!hit) return "";
  return hit.length <= max ? hit : `${hit.slice(0, max - 1).trimEnd()}…`;
}

function pickKeyChange(article: StoredArticle): string {
  const releaseMatch = article.title.match(/^([\w.-]+\/[\w.-]+)\s*[·|–-]\s*(.+)$/);
  if (article.sourceName === "GitHub Release" && releaseMatch) {
    return `发布版本 ${releaseMatch[2]}（${releaseMatch[1]}）：${firstSentence(article.summary, 160)}`;
  }
  const method = sentenceContaining(article.summary, [
    "propose",
    "introduce",
    "present",
    "we show",
    "we present",
    "we propose",
  ]);
  return method || firstSentence(article.summary, 200);
}

function pickDifferences(article: StoredArticle): string {
  const diff = sentenceContaining(article.summary, [
    "unlike",
    "compared to",
    "outperform",
    "surpass",
    "superior to",
    "better than",
    "state-of-the-art",
    "prior work",
    "previous work",
  ]);
  if (diff) return diff;
  return "缺乏可直接比较的证据 — the source does not state how this compares with prior work.";
}

function pickEvidence(article: StoredArticle): string {
  const benchmarks = findBenchmarks(article.summary);
  const numbers = countNumbers(article.summary);
  if (benchmarks.length > 0) {
    return `Source mentions benchmarks: ${benchmarks.join(", ")}${numbers > 0 ? `；包含 ${numbers} 处数值结果` : ""}（具体分数未解析）。`;
  }
  if (numbers > 0) {
    return "摘要包含定量结果，但未提取到命名基准；需阅读原文核对实验设置。";
  }
  return "摘要未提供可核实的实验、基准或证据细节。";
}

function pickLimitations(article: StoredArticle): string {
  const lim = sentenceContaining(article.summary, [
    "limitation",
    "we do not",
    "does not",
    "cannot",
    "fail",
    "future work",
    "open question",
    "remains",
    "we leave",
  ]);
  if (lim) return lim;
  return "已知局限与未解决问题未在摘要中明确说明；需阅读原文进一步确认。";
}

function pickEvidenceBasis(article: StoredArticle): EvidenceBasis {
  const text = `${article.summary} ${article.title}`;
  const hasEvidence = countNumbers(text) > 0 || findBenchmarks(text).length > 0;
  if (!hasEvidence) return "none";
  const independent = containsAny(text, [
    "independent",
    "third-party",
    "community evaluation",
    "reproduc",
  ]);
  return independent ? "independent" : "vendor";
}

function buildFurtherReading(article: StoredArticle): FurtherReadingRef[] {
  const refs: FurtherReadingRef[] = [];
  const seen = new Set<string>();

  const push = (label: string, url: string) => {
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    refs.push({ label, url });
  };

  push("Source", article.url);
  for (const id of findArxivRefs(article.summary)) {
    push(`arXiv:${id}`, `https://arxiv.org/abs/${id}`);
  }
  for (const url of findUrls(article.summary)) {
    let label = url;
    try {
      label = new URL(url).hostname;
    } catch {
      // keep raw
    }
    push(label, url);
  }
  return refs.slice(0, 8);
}

/* ============================================================
   Scoring — importance and confidence are computed independently.
   ============================================================ */

function scoreImportance(article: StoredArticle): {
  score: number;
  factors: AnalysisFactors;
} {
  const text = `${article.title} ${article.summary}`;
  const ageDays =
    (Date.now() - new Date(article.publishedAt).getTime()) / 86400000;

  const relevance = clampScore(CATEGORY_RELEVANCE[article.category], 0, 30);

  const novelty = clampScore(
    (ageDays >= 0 && ageDays <= 7 ? 8 : ageDays <= 30 ? 4 : 0) +
      (containsAny(text, ["novel", "first", "new method", "new approach", "we introduce"]) ? 6 : 0) +
      (article.sourceName === "GitHub Release" ? 2 : 0),
    0,
    20,
  );

  const impact = clampScore(
    (article.provider === "github"
      ? 12
      : article.provider === "arxiv" || article.provider === "arxiv-rss"
        ? 11
        : 7) +
      ((article.metrics?.stars ?? 0) >= 1000 ? 4 : (article.metrics?.stars ?? 0) >= 100 ? 2 : 0) +
      (containsAny(text, ["breakthrough", "significant", "state-of-the-art", "first"]) ? 3 : 0),
    0,
    20,
  );

  const verifiability = clampScore(
    (countNumbers(text) > 0 ? 7 : 0) +
      (article.url ? 3 : 0) +
      (article.authors.length > 0 ? 2 : 0) +
      (article.tags.length > 0 ? 2 : 0),
    0,
    15,
  );

  const learning = clampScore(
    (["physical-ai", "ai-math", "ai-cs", "ai-research", "ai-models"].includes(article.category) ? 12 : 8) +
      (article.summary.length > 400 ? 3 : 0),
    0,
    15,
  );

  const factors: AnalysisFactors = { relevance, novelty, impact, verifiability, learning };
  return { score: relevance + novelty + impact + verifiability + learning, factors };
}

function scoreConfidence(article: StoredArticle): {
  score: number;
  level: "high" | "medium" | "low";
  factors: ConfidenceFactors;
} {
  const text = `${article.title} ${article.summary}`;

  const sourceType =
    article.provider === "github"
      ? 28
      : article.provider === "arxiv"
        ? 18
        : article.provider === "arxiv-rss"
          ? 17
          : article.provider === "rss"
            ? 12
            : 6;

  const methodTransparency = clampScore(
    (article.summary.length > 200 ? 10 : 4) +
      (containsAny(text, ["propose", "introduce", "method", "architecture", "training", "we present"]) ? 10 : 0) +
      (article.authors.length > 0 ? 5 : 0),
    0,
    25,
  );

  const experimentQuality = clampScore(
    (countNumbers(text) >= 2 ? 15 : countNumbers(text) === 1 ? 8 : 0) +
      (findBenchmarks(text).length >= 1 ? 10 : 0),
    0,
    25,
  );

  const independentReproduction = clampScore(
    containsAny(text, ["independent", "third-party", "reproduc", "community evaluation"])
      ? 8
      : 2,
    0,
    10,
  );

  const evidenceCompleteness = clampScore(
    (article.url ? 4 : 0) + (article.authors.length > 0 ? 3 : 0) + (article.tags.length > 0 ? 3 : 0),
    0,
    10,
  );

  const factors: ConfidenceFactors = {
    sourceType,
    methodTransparency,
    experimentQuality,
    independentReproduction,
    evidenceCompleteness,
  };
  const score = sourceType + methodTransparency + experimentQuality + independentReproduction + evidenceCompleteness;
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  return { score, level, factors };
}

/* ============================================================
   Analyze
   ============================================================ */

export function analyzeArticle(article: StoredArticle): AnalysisResult {
  const importance = scoreImportance(article);
  const confidence = scoreConfidence(article);
  const model = extractModelInfo(article);

  return {
    articleId: article.id,
    oneLineSummary: firstSentence(article.summary, 200),
    keyChange: pickKeyChange(article),
    differences: pickDifferences(article),
    evidence: pickEvidence(article),
    limitations: pickLimitations(article),
    impact: CATEGORY_IMPACT[article.category],
    personalRelevance: CATEGORY_LEARNING[article.category],
    furtherReading: buildFurtherReading(article),
    importanceScore: importance.score,
    importanceFactors: importance.factors,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    confidenceFactors: confidence.factors,
    evidenceBasis: pickEvidenceBasis(article),
    isModelRelease: model !== null,
    modelFamily: model?.family ?? null,
    analyzedAt: new Date().toISOString(),
  };
}

/* ============================================================
   Engines — rule-based now; LLM engine behind an env-config gate.
   ============================================================ */

export const ruleBasedEngine: AnalysisEngine = {
  id: "rule-based",
  available: () => true,
  availabilityMessage: () => "Deterministic rule-based analyzer (always available).",
  analyze: async (article) => analyzeArticle(article),
};

export const llmAnalysisEngine: AnalysisEngine = {
  id: "llm",
  available: () => Boolean(process.env.LLM_ANALYZER_API_KEY),
  availabilityMessage: () =>
    process.env.LLM_ANALYZER_API_KEY
      ? "LLM analyzer configured."
      : "LLM analyzer not configured (LLM_ANALYZER_API_KEY missing). Falling back to rule-based.",
  async analyze(article) {
    if (!process.env.LLM_ANALYZER_API_KEY) {
      return ruleBasedEngine.analyze(article);
    }
    // Untested here (no key configured): OpenAI-compatible chat completion.
    const baseUrl = process.env.LLM_ANALYZER_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.LLM_ANALYZER_MODEL ?? "gpt-4o-mini";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.LLM_ANALYZER_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a technical intelligence analyst. Return JSON with fields: " +
              "oneLineSummary, keyChange, differences, evidence, limitations, impact, " +
              "personalRelevance. Be factual; never invent benchmark numbers.",
          },
          {
            role: "user",
            content: `Title: ${article.title}\n\nSummary: ${article.summary}\n\nSource: ${article.sourceName}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM analyzer request failed (${response.status})`);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";

    // LLM output is untrusted: parse defensively and only accept known
    // string fields, falling back to the rule-based result for everything
    // else. Never spread arbitrary keys onto the stored analysis.
    const base = analyzeArticle(article);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return base;
    }
    const pick = (key: keyof AnalysisResult): string => {
      const value = parsed[key];
      return typeof value === "string" ? value.slice(0, 20000) : (base[key] as string);
    };

    return {
      ...base,
      oneLineSummary: pick("oneLineSummary"),
      keyChange: pick("keyChange"),
      differences: pick("differences"),
      evidence: pick("evidence"),
      limitations: pick("limitations"),
      impact: pick("impact"),
      personalRelevance: pick("personalRelevance"),
    } as AnalysisResult;
  },
};

export function getAnalysisEngine(): AnalysisEngine {
  return llmAnalysisEngine.available() ? llmAnalysisEngine : ruleBasedEngine;
}
