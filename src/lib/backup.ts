import type { LibraryState } from "./types";
export interface BackupPreferences { dailySignalCount: number; defaultSort: "importance" | "newest"; theme: "dark" | "light"; }
export interface PersonalBackup { preferences?: BackupPreferences; format: "signal-personal"; version: 1; exportedAt: string; library: LibraryState; }
export function parsePersonalBackup(raw: unknown): PersonalBackup {
  if (!raw || typeof raw !== "object") throw new Error("备份格式无效");
  const b = raw as Partial<PersonalBackup>;
  if (b.format !== "signal-personal" || b.version !== 1 || !b.library || typeof b.library !== "object") throw new Error("不支持的备份格式或版本");
  const { favoriteIds, readIds, notes } = b.library;
  const validIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length <= 100000 && ids.every((id) => typeof id === "string" && /^\d+$/.test(id));
  if (!validIds(favoriteIds) || !validIds(readIds) || !notes || typeof notes !== "object" || Array.isArray(notes) || !Object.entries(notes).every(([id, note]) => /^\d+$/.test(id) && typeof note === "string" && note.length <= 100000)) throw new Error("备份中的收藏或笔记数据无效");
  const p = b.preferences;
  if (p && (typeof p !== "object" || !Number.isInteger(p.dailySignalCount) || p.dailySignalCount < 1 || p.dailySignalCount > 30 || !["importance", "newest"].includes(p.defaultSort) || !["dark", "light"].includes(p.theme))) throw new Error("备份偏好设置无效");
  return { preferences: p ? { dailySignalCount: p.dailySignalCount, defaultSort: p.defaultSort, theme: p.theme } : undefined, format: "signal-personal", version: 1, exportedAt: typeof b.exportedAt === "string" ? b.exportedAt : "", library: { favoriteIds: [...new Set(favoriteIds)], readIds: [...new Set(readIds)], notes: { ...notes } } };
}
export function mergeLibrary(current: LibraryState, incoming: LibraryState): LibraryState {
  return { favoriteIds: [...new Set([...current.favoriteIds, ...incoming.favoriteIds])], readIds: [...new Set([...current.readIds, ...incoming.readIds])], notes: { ...incoming.notes, ...current.notes } };
}
