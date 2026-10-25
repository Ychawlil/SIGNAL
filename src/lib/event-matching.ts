export interface EventArticle { id: number; title: string; url: string; publishedAt: string; modelFamily?: string | null; summary?: string; }
const STOP = new Set("a an the for of to in and with on new introducing introduce announces announce release released model models ai show hn paper research official".split(" "));
function canonical(url: string): string {
 try {
  const u = new URL(url); const path = u.pathname.replace(/\/$/, "");
  if (/(^|\.)arxiv.org$/.test(u.hostname)) return `arxiv:${path.replace(/^\/(abs|pdf)\//, "").replace(/\.pdf$/, "").replace(/v\d+$/, "")}`;
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return `${u.hostname.replace(/^www\./, "")}${path}${u.search}`;
 } catch { return url; }
}
function words(title: string): Set<string> { return new Set(title.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").split(/\s+/).filter((word) => word.length > 1 && !STOP.has(word))); }
function versions(title: string): string { return (title.toLowerCase().match(/\b(?:v\d+(?:\.\d+)*|\d+(?:\.\d+)+|(?:gpt|claude|gemini|llama|qwen|deepseek)[- ]?\d[\w.-]*)\b/g) ?? []).sort().join("|"); }
export function sameEvent(a: EventArticle, b: EventArticle): boolean {
 if (canonical(a.url) === canonical(b.url)) return true;
 if (versions(a.title) !== versions(b.title)) return false;
 const aw = words(a.title), bw = words(b.title);
 if (aw.size < 3 || bw.size < 3) return a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
 const overlap = [...aw].filter((word) => bw.has(word)).length;
 return overlap >= 3 && overlap / new Set([...aw, ...bw]).size >= .72 && Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) <= 7 * 86400000;
}
export function projectKeys(article: EventArticle): string[] {
 const keys = [...article.url.matchAll(/https?:\/\/(?:www\.)?github\.com\/([a-z0-9_.-]+\/[a-z0-9_.-]+)/gi)].map((match) => `repo:${match[1].toLowerCase().replace(/\.git$/, "")}`);
 const repoTitle = article.title.match(/^([a-z0-9_.-]+\/[a-z0-9_.-]+)(?:\s*[·:|–-]|\s*$)/i);
 if (repoTitle) keys.push(`repo:${repoTitle[1].toLowerCase()}`);
 const paperRefs = `${article.url} ${article.summary ?? ""}`.matchAll(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/gi);
 for (const match of paperRefs) keys.push(`paper:${match[1]}`);
 const models = `${article.title} ${article.modelFamily ?? ""}`.match(/\b(?:gpt|claude|gemini|llama|qwen|deepseek|mistral|gemma|grok|phi)(?:[- .]?\d[\w.-]*)?\b/gi) ?? [];
 return [...new Set([...keys, ...models.map((model) => `model:${model.toLowerCase().replace(/[- .]?\d.*$/, "")}`)])];
}
export function sameProject(a: EventArticle, b: EventArticle): boolean { const keys = projectKeys(a); return keys.some((key) => projectKeys(b).includes(key)); }
export function isFollowup(a: EventArticle, b: EventArticle): boolean {
 if (Date.parse(b.publishedAt) <= Date.parse(a.publishedAt) || !sameProject(a, b)) return false;
 if (!sameEvent(a, b)) return true;
 const revision = (article: EventArticle) => Number(article.url.match(/arxiv\.org\/(?:abs|pdf)\/\d{4}\.\d{4,5}v(\d+)/i)?.[1] ?? 1);
 return projectKeys(a).some((key) => key.startsWith("paper:")) && revision(b) > revision(a);
}
export function groupEvents<T extends EventArticle>(items: T[]): T[][] {
 const groups: T[][] = [];
 for (const item of items) { const group = groups.find((entries) => sameEvent(entries[0], item)); if (group) group.push(item); else groups.push([item]); }
 return groups;
}
