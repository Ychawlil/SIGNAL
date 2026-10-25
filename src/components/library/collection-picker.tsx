"use client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { libraryApi } from "./api";
import type { ResearchCollection } from "@/lib/server/library/types";
export function CollectionPicker({ articleId, onClose }: { articleId: string | null; onClose: () => void }) {
 const [collections, setCollections] = useState<ResearchCollection[]>([]);
 const [selected, setSelected] = useState(""); const [name, setName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
 useEffect(() => { if (!articleId) return; let active = true; libraryApi.collections().then((data) => { if (active) setCollections(data.collections); }).catch(() => { if (active) setError("合集加载失败，可稍后在研究库归类。"); }); return () => { active = false; }; }, [articleId]);
 const add = async () => { if (!articleId) return; setBusy(true); setError(""); try { let id = Number(selected); if (name.trim()) id = (await libraryApi.createCollection(name.trim(), "")).collection.id; if (!id) return; await libraryApi.addCollectionItem(id, Number(articleId), ""); onClose(); } catch { setError("加入合集失败，收藏已保留，请重试。"); } finally { setBusy(false); } };
 return <Drawer open={articleId !== null} onClose={onClose} title="已收藏 · 归入研究合集"><div className="space-y-4 p-5"><p className="text-sm text-muted-foreground">情报已加入研究库，可选择合集，也可以稍后整理。</p><Select aria-label="选择研究合集" value={selected} onChange={(e) => { setSelected(e.target.value); setName(""); }} className="w-full"><option value="">选择已有合集</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="或输入新合集名称" aria-label="新合集名称" maxLength={120} />{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex gap-2"><Button onClick={add} disabled={busy || (!selected && !name.trim())}>{busy ? "正在保存…" : "保存到合集"}</Button><Button variant="outline" onClick={onClose}>暂不归类</Button></div></div></Drawer>;
}
