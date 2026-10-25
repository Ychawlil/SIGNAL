"use client";
import { useState } from "react";
import { useLibrary, useSettings, useTheme } from "@/components/providers";
import { parsePersonalBackup, type PersonalBackup } from "@/lib/backup";
import { Button } from "@/components/ui/button";
export function BackupPanel() {
  const { favoriteIds, readIds, notes, importLibrary } = useLibrary();
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [restorePreferences, setRestorePreferences] = useState(false);
  const [pending, setPending] = useState<PersonalBackup | null>(null);
  const [notice, setNotice] = useState("");
  const download = () => {
    const data: PersonalBackup = { format: "signal-personal", version: 1, preferences: { dailySignalCount: settings.dailySignalCount, defaultSort: settings.defaultSort, theme }, exportedAt: new Date().toISOString(), library: { favoriteIds, readIds, notes } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `signal-personal-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("个人数据备份已生成。");
  };
  return <div className="space-y-3">
    <p className="text-sm leading-6 text-muted-foreground">备份当前收藏清单及此浏览器的笔记、已读状态和阅读偏好。导入时合并记录，保留当前已有笔记。请在连接同一情报数据库时恢复，记录编号依赖该数据库。收藏导入后会同步到研究库。研究合集、研究库笔记和情报正文保存在本机数据库中，不包含在此文件内。</p>
    <div className="flex flex-wrap items-center gap-3"><Button onClick={download}>导出个人备份</Button><label className="text-sm">选择备份文件<input className="ml-2 max-w-full text-sm" type="file" accept=".json,application/json" onChange={async (event) => {
      const file = event.target.files?.[0]; event.target.value = ""; setPending(null); if (!file) return;
      try { if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MB"); setPending(parsePersonalBackup(JSON.parse(await file.text()))); setNotice(""); }
      catch (error) { setNotice(error instanceof Error ? error.message : "无法读取备份"); }
    }} /></label></div>
    {pending && <div className="rounded-md border border-border p-3 text-sm"><p>待导入：{pending.library.favoriteIds.length} 条收藏、{pending.library.readIds.length} 条已读、{Object.keys(pending.library.notes).length} 条笔记。</p>{pending.preferences && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={restorePreferences} onChange={(event) => setRestorePreferences(event.target.checked)} />同时恢复外观、简报条数和排序偏好</label>}<div className="mt-3 flex gap-2"><Button onClick={async () => { try { await importLibrary(pending.library); if (restorePreferences && pending.preferences) { updateSettings({ dailySignalCount: pending.preferences.dailySignalCount, defaultSort: pending.preferences.defaultSort }); setTheme(pending.preferences.theme); } setPending(null); setNotice("导入完成，已合并个人数据。"); } catch (error) { setNotice(error instanceof Error ? error.message : "导入失败，请重试"); } }}>确认合并</Button><Button variant="outline" onClick={() => setPending(null)}>取消</Button></div></div>}
    <p role="status" className="text-sm text-muted-foreground">{notice}</p>
  </div>;
}
