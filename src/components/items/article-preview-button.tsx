"use client";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Drawer } from "@/components/ui/drawer";
import { toIntelligenceItem, type SignalRecord } from "@/lib/signals";
import type { IntelligenceItem } from "@/lib/types";
const Detail = dynamic(() => import("./item-detail").then(module => module.ItemDetail));
export function ArticlePreviewButton({ id, className, children }: { id: number; className?: string; children: ReactNode }) {
 const [open, setOpen] = useState(false);
 const [item, setItem] = useState<IntelligenceItem | null>(null);
 const [error, setError] = useState(false);
 useEffect(() => {
   if (!open) return;
   const controller = new AbortController();
   void fetch(`/api/signals/${id}`, { signal: controller.signal }).then(async response => {
     if (!response.ok) throw new Error(); return await response.json() as SignalRecord;
   }).then(record => { if (!controller.signal.aborted) setItem(toIntelligenceItem(record)); }).catch(() => { if (!controller.signal.aborted) setError(true); });
   return () => controller.abort();
 }, [open, id]);
 return <><button type="button" className={`${className ?? ""} text-left`} onClick={() => { setItem(null); setError(false); setOpen(true); }}>{children}</button><Drawer open={open} onClose={() => setOpen(false)} title="情报详情">{item ? <Detail key={item.id} item={item}/> : <p className="p-5 text-sm text-muted-foreground" role={error ? "alert" : "status"}>{error ? "详情读取失败，请关闭后重试。" : "正在读取详情…"}</p>}</Drawer></>;
}
