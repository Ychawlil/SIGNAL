import { describe, it, expect } from "vitest";
import { mergeLibrary, parsePersonalBackup } from "@/lib/backup";
describe("personal backup", () => {
 const valid = { format: "signal-personal", version: 1, library: { favoriteIds: ["1", "1"], readIds: ["2"], notes: { "1": "note" } } };
 it("validates and deduplicates imported data", () => { expect(parsePersonalBackup(valid).library.favoriteIds).toEqual(["1"]); });
 it("rejects unsupported versions, malformed notes, and unsafe identifiers", () => {
  expect(() => parsePersonalBackup({ ...valid, version: 2 })).toThrow();
  expect(() => parsePersonalBackup({ ...valid, library: { ...valid.library, notes: { "1": 123 } } })).toThrow();
  expect(() => parsePersonalBackup({ ...valid, library: { ...valid.library, favoriteIds: ["1) OR 1=1"] } })).toThrow();
 });
 it("merges without dropping records or overwriting existing notes", () => {
  expect(mergeLibrary({ favoriteIds: ["1"], readIds: [], notes: { "1": "current" } }, { favoriteIds: ["1", "2"], readIds: ["2"], notes: { "1": "old", "2": "new" } })).toEqual({ favoriteIds: ["1", "2"], readIds: ["2"], notes: { "1": "current", "2": "new" } });
 });
 it("rejects preferences outside supported ranges", () => { expect(() => parsePersonalBackup({ ...valid, preferences: { dailySignalCount: 999, defaultSort: "newest", theme: "dark" } })).toThrow(); });
});
