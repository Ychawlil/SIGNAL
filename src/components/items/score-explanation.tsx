"use client";
import { useEffect, useState } from "react";
import type { SignalRecord } from "@/lib/signals";
const FACTORS = [{ key: "relevance", label: "个人相关性", max: 30 }, { key: "novelty", label: "技术变化与时效", max: 20 }, { key: "impact", label: "潜在影响", max: 20 }, { key: "verifiability", label: "证据可核查性", max: 15 }, { key: "learning", label: "学习与复用价值", max: 15 }] as const;
export function ScoreExplanation({ id }: { id: string }) {
 const [record, setRecord] = useState<SignalRecord | null>(null); const [error, setError] = useState("");
 useEffect(() => { const controller = new AbortController(); fetch(`/api/signals/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async (r) => { if (!r.ok) throw new Error("评分加载失败"); return r.json() as Promise<SignalRecord>; }).then((data) => { if (!controller.signal.aborted) setRecord(data); }).catch(() => { if (!controller.signal.aborted) setError("评分加载失败，请重新打开。"); }); return () => controller.abort(); }, [id]);
 if (!record) return <p className="p-5 text-sm" role="status">{error || "正在加载评分依据…"}</p>;
 const f = record.importanceFactors;
 return <div className="space-y-5 p-5"><p className="text-xs font-medium text-muted-foreground">当前重要性评分</p><p className="text-3xl font-semibold text-accent">{record.importanceScore}<span className="text-sm text-muted-foreground"> / 100</span></p><p className="text-sm text-muted-foreground">{record.title}</p>{f ? FACTORS.map(({ key, label, max }) => <div key={key}><p className="flex justify-between text-sm font-medium"><span>{label}</span><span>{f[key]} / {max}</span></p><div className="my-2 h-1.5 overflow-hidden rounded bg-panel-secondary"><div className="h-full bg-accent" style={{ width: `${f[key] / max * 100}%` }} /></div><p className="text-xs leading-6 text-muted-foreground">{f.reasons?.[key] ?? "旧版分项记录，重算后提供详细说明。"}</p></div>) : <p>该条目尚未分析。</p>}<p className="border-t border-border pt-4 text-xs leading-6 text-muted-foreground">评分规则 v{f?.version ?? 1}。依据已采集标题、摘要和链接的可观察信号排序，不代表真实性或独立验证结论。星标数、宣传措辞、日期和版本号均不会直接提高证据得分。时效仅占 0–4 分；高分仍需核对原文。</p></div>;
}
