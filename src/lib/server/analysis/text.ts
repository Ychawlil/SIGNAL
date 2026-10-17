/** Lightweight NLP helpers for the rule-based analyzer (no external deps). */

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function firstSentence(text: string, max = 200): string {
  const sentence = splitSentences(text)[0] ?? "";
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trimEnd()}…`;
}

export function containsAny(text: string, terms: string[]): boolean {
  const t = text.toLowerCase();
  return terms.some((term) => t.includes(term.toLowerCase()));
}

export function countNumbers(text: string): number {
  const matches = text.match(/\d+(?:\.\d+)?\s?%/g) ?? [];
  return matches.length;
}

const BENCHMARKS = [
  "MMLU",
  "MMLU-Pro",
  "GSM8K",
  "MATH",
  "HumanEval",
  "MBPP",
  "SWE-bench",
  "SWE-bench Verified",
  "AIME",
  "GPQA",
  "ARC",
  "ARC-AGI",
  "HellaSwag",
  "TruthfulQA",
  "LiveCodeBench",
  "Codeforces",
  "IMO",
  "OmniBench",
  "MMMU",
  "VQAv2",
  "Ego4D",
  "LIBERO",
  "CALVIN",
  "EmbodiedEval",
  "Matterport3D",
];

export function findBenchmarks(text: string): string[] {
  const found = new Set<string>();
  for (const name of BENCHMARKS) {
    if (text.includes(name)) found.add(name);
  }
  return [...found];
}

/** Extract arXiv IDs referenced in a text. */
export function findArxivRefs(text: string): string[] {
  const ids = new Set<string>();
  const re = /arXiv[:#]?\s*(\d{4}\.\d{4,5})(?:v\d+)?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    ids.add(match[1]);
  }
  return [...ids].slice(0, 8);
}

/** Extract plain URLs referenced in a text. */
export function findUrls(text: string): string[] {
  const urls = new Set<string>();
  const re = /https?:\/\/[^\s)"'<>]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:]+$/, "");
    if (!/^https?:\/\//i.test(url)) continue;
    urls.add(url);
  }
  return [...urls].slice(0, 8);
}

export function clampScore(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
