export interface ExportArticle { title: string; url: string; summary: string; notes?: string; sourceName?: string; publishedAt?: string; keyChange?: string | null; }
const heading = (text: string) => text.replace(/[\r\n]+/g, " ").replace(/^#+\s*/, "");
export function exportMarkdown(items: ExportArticle[], title = "研究资料") {
 return `# ${heading(title)}\n\n` + items.map((item) => `## ${heading(item.title)}\n\n来源：${item.sourceName ?? ""} · ${item.publishedAt?.slice(0, 10) ?? ""}\n\n原文：${item.url}\n\n### 摘要\n\n${item.summary || "暂无摘要"}\n\n${item.keyChange ? `### 关键变化\n\n${item.keyChange}\n\n` : ""}${item.notes ? `### 个人笔记\n\n${item.notes}\n\n` : ""}`).join("---\n\n");
}
export function downloadMarkdown(content: string, filename = "signal-research.md") {
 const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
