import { describe, it, expect } from "vitest";
import { relativeTime, formatDate, currentDateLabel } from "@/lib/utils";
describe("Chinese interface dates", () => {
 it("uses Chinese relative times", () => { const now = Date.parse("2026-10-22T12:00:00Z"); expect(relativeTime(new Date(now).toISOString(), now)).toBe("刚刚"); expect(relativeTime(new Date(now - 120000).toISOString(), now)).toBe("2 分钟前"); expect(relativeTime(new Date(now - 7200000).toISOString(), now)).toBe("2 小时前"); expect(relativeTime(new Date(now - 172800000).toISOString(), now)).toBe("2 天前"); });
 it("uses Chinese calendar labels", () => { expect(formatDate("2026-10-22T12:00:00Z")).toContain("2026年"); expect(currentDateLabel()).toMatch(/星期/); });
});
