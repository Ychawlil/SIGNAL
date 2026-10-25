import { describe, it, expect } from "vitest";
import { sameEvent, sameProject, isFollowup, groupEvents, type EventArticle } from "@/lib/event-matching";
const base: EventArticle = { id: 1, title: "A new algorithm for robot motion planning", url: "https://example.com/story", publishedAt: "2026-10-22T00:00:00Z" };
describe("conservative event matching", () => {
 it("groups an arXiv paper and its versioned PDF", () => { expect(sameEvent({ ...base, url: "https://arxiv.org/abs/2610.12345" }, { ...base, id: 2, url: "https://arxiv.org/pdf/2610.12345v2.pdf", title: "Different publisher title" })).toBe(true); });
 it("preserves meaningful query parameters", () => { expect(sameEvent({ ...base, url: "https://example.com/read?article=1" }, { ...base, id: 2, url: "https://example.com/read?article=2", title: "Unrelated finding" })).toBe(false); });
 it("strips only tracking parameters", () => { expect(sameEvent(base, { ...base, url: base.url + "?utm_source=feed", title: "Short title" })).toBe(true); });
 it("does not merge separate model versions", () => { expect(sameEvent({ ...base, title: "Qwen 2.5 model release", url: "https://one.com/a" }, { ...base, title: "Qwen 3.0 model release", url: "https://two.com/a" })).toBe(false); });
 it("tracks the same GitHub repository but not arbitrary website paths", () => { expect(sameProject({ ...base, url: "https://github.com/org/tool" }, { ...base, url: "https://github.com/org/tool/releases/tag/v2" })).toBe(true); expect(sameProject(base, { ...base, url: "https://example.com/story/other" })).toBe(false); });
 it("does not match a model name inside unrelated words", () => { expect(sameProject({ ...base, title: "Phi model" }, { ...base, title: "Philosophy of robot learning" })).toBe(false); });
 it("recognizes a newer paper revision as a follow-up while keeping source aggregation", () => {
  const paper = { ...base, url: "https://arxiv.org/abs/2610.12345v1" };
  const revision = { ...base, id: 2, url: "https://arxiv.org/abs/2610.12345v2", publishedAt: "2026-10-23T00:00:00Z" };
  expect(sameEvent(paper, revision)).toBe(true); expect(isFollowup(paper, revision)).toBe(true); expect(isFollowup(revision, paper)).toBe(false);
 });
 it("does not collapse distinct major release versions", () => { expect(sameEvent({ ...base, title: "Project tool v1 new benchmark release report", url: "https://one.com/" }, { ...base, title: "Project tool v2 new benchmark release report", url: "https://two.com/" })).toBe(false); });
 it("groups repeated stories without dropping their sources", () => { expect(groupEvents([base, { ...base, id: 2 }, { ...base, id: 3, title: "Unrelated result", url: "https://other.com/" }]).map((group) => group.length)).toEqual([2, 1]); });
});
