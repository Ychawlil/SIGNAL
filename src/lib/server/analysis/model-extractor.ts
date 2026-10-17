import type { StoredArticle } from "../types";
import { findBenchmarks, containsAny } from "./text";

export interface ExtractedModel {
  family: string;
  name: string;
  version: string | null;
  params: string | null;
  openWeights: boolean | null;
  license: string | null;
  benchmarks: string[];
  claimOrigin: "vendor" | "independent" | "unknown";
  evalNote: string;
}

const MODEL_HINTS = [
  "model",
  "llm",
  "vlm",
  "vla",
  "transformer",
  "diffusion",
  "gpt",
  "bert",
  "llama",
  "mistral",
  "gemma",
  "qwen",
  "deepseek",
  "world model",
];

const KNOWN_MODELS = [
  "gpt",
  "claude",
  "gemini",
  "llama",
  "mistral",
  "qwen",
  "deepseek",
  "gemma",
  "pixtral",
  "grok",
  "phi",
  "falcon",
  "dbrx",
  "jamba",
  "olmo",
  "kimi",
  "glm",
  "vicuna",
  "alpaca",
  "flux",
  "sora",
  "veo",
  "llava",
];

/** Conservative model-name detection; returns null when uncertain. */
function detectFamily(article: StoredArticle): string | null {
  // GitHub release titles carry the repo as the family ("org/repo · tag").
  const releaseMatch = article.title.match(/^([\w.-]+\/[\w.-]+)\s*[·|–-]\s*(.+)$/);
  if (article.sourceName === "GitHub Release" && releaseMatch) {
    return releaseMatch[1];
  }
  if (article.provider === "github" && article.externalId.startsWith("github-repo:")) {
    const repo = article.externalId.replace("github-repo:", "");
    if (containsAny(repo, MODEL_HINTS) || containsAny(article.summary, MODEL_HINTS)) {
      return repo;
    }
    return null;
  }

  // arXiv: only flag when the title looks like a named model release —
  // require a digit, a parameter-size suffix, or a known model family so
  // ordinary paper titles ("English: …", "ARC: …") are not misclassified.
  const namedModel = /(?:^|\s)([A-Z][A-Za-z0-9-]*(?:\s?\d+[Bb])?)(?=\s*[:–-])/.exec(article.title);
  if (namedModel && containsAny(article.title, MODEL_HINTS)) {
    const name = namedModel[1];
    const hasDigit = /\d/.test(name);
    const hasSize = /\d+\s?[Bb]/.test(article.title);
    const known = KNOWN_MODELS.some((k) => name.toLowerCase().includes(k));
    if (hasDigit || hasSize || known) return name;
  }
  return null;
}

function detectVersion(article: StoredArticle): string | null {
  const releaseMatch = article.title.match(/^([\w.-]+\/[\w.-]+)\s*[·|–-]\s*(.+)$/);
  if (article.sourceName === "GitHub Release" && releaseMatch) {
    return releaseMatch[2];
  }
  const v = article.title.match(/\b(v?\d+(?:\.\d+){1,3})\b/);
  return v ? v[1] : null;
}

function detectParams(text: string): string | null {
  const m = text.match(/\b(\d+(?:\.\d+)?)\s?[Bb]\b/);
  return m ? `${m[1]}B` : null;
}

function detectLicense(text: string): string | null {
  const t = text.toLowerCase();
  for (const license of ["apache", "mit", "bsd", "gpl", "cc-by", "openrail", "llama"]) {
    if (t.includes(license)) return license;
  }
  return null;
}

export function extractModelInfo(article: StoredArticle): ExtractedModel | null {
  const family = detectFamily(article);
  if (!family) return null;

  const combined = `${article.title} ${article.summary} ${article.tags.join(" ")}`;
  const benchmarks = findBenchmarks(combined);

  const independent = containsAny(combined, [
    "independent",
    "third-party",
    "community evaluation",
    "reproduc",
  ]);
  const claimOrigin = independent ? "independent" : "vendor";

  return {
    family,
    name: family,
    version: detectVersion(article),
    params: detectParams(combined),
    openWeights: containsAny(combined, ["open weights", "open-source", "open source", "open-weights"])
      ? true
      : containsAny(combined, ["api-only", "closed", "proprietary"])
        ? false
        : null,
    license: detectLicense(combined),
    benchmarks,
    claimOrigin,
    evalNote:
      benchmarks.length > 0
        ? `${claimOrigin === "independent" ? "Independent" : "Vendor"} claim — benchmarks mentioned: ${benchmarks.join(", ")}. No scores were parsed.`
        : "缺乏可直接比较的证据 — no benchmark scores were extracted from the source.",
  };
}
