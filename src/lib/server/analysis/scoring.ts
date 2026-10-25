import type { StoredArticle } from "../types";
import type { TopicId } from "@/lib/types";
import type { AnalysisFactors } from "./types";
import { relevanceForCategory, DEFAULT_FOCUS_WEIGHTS } from "@/lib/focus-weights";
import { findBenchmarks } from "./text";
export const SCORING_VERSION = 2;
export function scoreImportance(article: StoredArticle, weights: Record<TopicId, number> = DEFAULT_FOCUS_WEIGHTS, now = Date.now()) {
  const text = `${article.title} ${article.summary}`;
  const method = /\b(?:propos(?:e|es|ed)|introduc(?:e|es|ed)|algorithm|architecture|framework|theorem|proof|dataset|training method)\b|提出|新方法|新架构|定理|证明|数据集/i.test(text);
  const comparison = /\b(?:compared (?:to|with)|baseline|ablation|versus|outperform(?:s|ed)?|reduces?|improves?)\b|相比|基线|消融|降低|提升/i.test(text);
  const experiment = /\b(?:evaluat(?:e|es|ed|ion)|experiment|benchmark|measur(?:e|ed|ement)|test(?:ed|s)?)\b|评测|实验|测试|测量/i.test(text);
  // A model version, publication date or star count is not a quantitative result.
  const quantitative = /\b\d+(?:\.\d+)?\s*(?:%|ms\b|seconds?\b|tokens?\/s|times faster|[x×]\s+(?:faster|speedup))|百分之|提升\s*\d+|降低\s*\d+/i.test(text);
  const benchmark = findBenchmarks(text).length > 0;
  const artifact = /https?:\/\/(?:www\.)?(?:github\.com|huggingface\.co|zenodo\.org)\/\S+/i.test(text) || /https?:\/\/(?:www\.)?(?:github\.com|huggingface\.co)\//i.test(article.url);
  const reusable = /\b(?:tutorial|documentation|implementation|code|open[- ]source|open weights|reproducible|notebook|dataset)\b|教程|文档|代码|开源|开放权重|可复现|数据集/i.test(text);
  const release = article.sourceName === "GitHub Release" || /\b(?:releases?|released|launches?|available)\b|发布|上线/i.test(text);
  const age = (now - Date.parse(article.publishedAt)) / 86400000;
  const freshness = Number.isFinite(age) && age >= 0 ? age <= 2 ? 4 : age <= 7 ? 3 : age <= 30 ? 1 : 0 : 0;
  const relevance = relevanceForCategory(article.category, weights);
  const novelty = Math.min(20, (method ? 8 : 0) + (comparison ? 6 : 0) + (release ? 2 : 0) + freshness);
  const impact = Math.min(20, (method || release ? 5 : 2) + (comparison && experiment ? 6 : 0) + (quantitative && experiment ? 5 : 0) + (artifact ? 4 : 0));
  const verifiability = Math.min(15, (article.url ? 1 : 0) + (experiment ? 3 : 0) + (quantitative && experiment ? 4 : 0) + (benchmark && experiment ? 3 : 0) + (artifact ? 4 : 0));
  const learning = Math.min(15, (method ? 5 : 1) + (reusable ? 5 : 0) + (artifact ? 3 : 0) + (comparison && experiment ? 2 : 0));
  const reasons = {
    relevance: `按设置中的关注领域权重计算：${relevance}/30。`,
    novelty: `方法变化 ${method ? 8 : 0}，基线对比 ${comparison ? 6 : 0}，发布 ${release ? 2 : 0}，时效 ${freshness}（合计上限 20）。`,
    impact: `具体技术变化 ${method || release ? 5 : 2}，对比实验 ${comparison && experiment ? 6 : 0}，定量实验 ${quantitative && experiment ? 5 : 0}，开放材料 ${artifact ? 4 : 0}。`,
    verifiability: `原文链接 ${article.url ? 1 : 0}，实验描述 ${experiment ? 3 : 0}，定量结果 ${quantitative && experiment ? 4 : 0}，命名基准 ${benchmark && experiment ? 3 : 0}，开放材料 ${artifact ? 4 : 0}（上限 15）。`,
    learning: `方法内容 ${method ? 5 : 1}，可复用材料描述 ${reusable ? 5 : 0}，材料链接 ${artifact ? 3 : 0}，对比实验 ${comparison && experiment ? 2 : 0}。`,
  };
  const factors: AnalysisFactors = { relevance, novelty, impact, verifiability, learning, reasons, version: SCORING_VERSION };
  return { score: relevance + novelty + impact + verifiability + learning, factors };
}
