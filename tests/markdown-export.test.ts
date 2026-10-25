import { describe, it, expect } from "vitest";
import { exportMarkdown } from "@/lib/markdown-export";
describe("research export", () => {
 it("preserves original URLs, summaries, findings and personal notes", () => { const text = exportMarkdown([{ title: "Paper", url: "https://example.com/paper", summary: "Summary", notes: "Reproduce tomorrow", keyChange: "New algorithm" }]); expect(text).toContain("## Paper"); expect(text).toContain("https://example.com/paper"); expect(text).toContain("New algorithm"); expect(text).toContain("Reproduce tomorrow"); });
 it("keeps multiline titles from creating accidental headings", () => { const text = exportMarkdown([{ title: "Paper\n# another heading", url: "https://example.com", summary: "" }]); expect(text).not.toContain("\n# another heading"); expect(text).toContain("暂无摘要"); });
});
