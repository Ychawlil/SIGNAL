"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRow } from "@/components/items/item-row";
import { toIntelligenceItem, type SignalRecord } from "@/lib/signals";
import type { IntelligenceItem } from "@/lib/types";
import type { PlanetConfig, PlanetStats } from "@/lib/universe/planets";

/** Content stays in the universe; existing library actions share the global provider. */
export function PlanetReader({ planet, stats, unread, error, onReset }: {
 planet: PlanetConfig; stats?: PlanetStats; unread: number | null; error: boolean; onReset: () => void;
}) {
 const [items, setItems] = useState<IntelligenceItem[]>([]);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [draft, setDraft] = useState("");
 const [query, setQuery] = useState("");
 const [sort, setSort] = useState("newest");
 const [loading, setLoading] = useState(true);
 const [failed, setFailed] = useState(false);
 const [retry, setRetry] = useState(0);
 const [article, setArticle] = useState<IntelligenceItem | null>(null);
 const scroll = useRef<HTMLDivElement>(null);
 useEffect(() => {
   const controller = new AbortController();
   const params = new URLSearchParams({ planet: planet.id, page: String(page), pageSize: "15", q: query, sort });
   void fetch(`/api/signals?${params}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
     if (!response.ok) throw new Error();
     return await response.json() as { items: SignalRecord[]; total: number };
   }).then(data => {
     if (controller.signal.aborted) return;
     setItems(data.items.map(toIntelligenceItem)); setTotal(data.total); setFailed(false); setLoading(false);
   }).catch(() => { if (!controller.signal.aborted) { setFailed(true); setLoading(false); } });
   return () => controller.abort();
 }, [planet.id, page, query, sort, retry]);
 const top = () => scroll.current?.scrollTo({ top: 0 });
 const pages = Math.max(1, Math.ceil(total / 15));
 return <aside className="planet-panel planet-reader dark" aria-labelledby="planet-panel-heading" style={{ "--world-color": planet.accentColor } as React.CSSProperties}>
   <header className="reader-heading">
     <div><p className="universe-eyebrow">正在探索 / 星球档案</p><h2 id="planet-panel-heading">{planet.label}</h2></div>
     <button className="universe-icon" aria-label="返回宇宙全景" onClick={onReset}><X size={18}/></button>
   </header>
   <p className="reader-subtitle">{planet.subtitle}</p>
   <details className="reader-world-description"><summary>这颗星球收录什么？</summary><p>{planet.description}</p></details>
   <dl className="planet-stat-grid reader-stats"><div><dt>已收录{"情报"}</dt><dd>{stats ? stats.total.toLocaleString("zh-CN") : "—"}</dd></div><div><dt>24 小时新增</dt><dd>{stats ? stats.new24h : "—"}</dd></div><div><dt>未读</dt><dd>{unread === null ? "—" : unread.toLocaleString("zh-CN")}</dd></div></dl>
   {error && <p className="reader-warning">统计暂时不可用，仍可阅读下方资讯。</p>}
   {article ? <div className="reader-detail-toolbar"><button className="reader-text-button" onClick={() => { setArticle(null); top(); }}><ArrowLeft size={14}/>返回资讯列表</button></div> : <form className="reader-filters" role="search" aria-label="搜索当前星球" onSubmit={event => { event.preventDefault(); if (query === draft.trim() && page === 1) return; setLoading(true); setPage(1); setQuery(draft.trim()); top(); }}>
     <div className="reader-search"><Search size={15}/><input aria-label="搜索当前星球资讯" placeholder="搜索这颗星球的资讯…" value={draft} onChange={event => setDraft(event.target.value)}/><button type="submit">搜索</button></div>
     <select aria-label="资讯排序" value={sort} onChange={event => { setLoading(true); setPage(1); setSort(event.target.value); top(); }}><option value="newest">最新发布</option><option value="importance">重要性优先</option></select>
   </form>}
   <div ref={scroll} className="reader-scroll" aria-busy={loading && !article}>
     {article ? <ItemDetail key={article.id} item={article}/> : loading ? <p className="reader-empty" role="status">正在读取星球档案…</p> : failed ? <div className="reader-empty" role="alert"><p>资讯读取失败，请重试。</p><button className="reader-text-button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>重新读取</button></div> : !items.length ? <div className="reader-empty"><p>{query ? "没有找到匹配的资讯" : "这颗星球还没有收录内容"}</p><p>{query ? "试试其他关键词。" : "新的信号抵达后，会出现在这里。"}</p></div> : <div className="reader-items">{items.map(item => <ItemRow key={item.id} item={item} onOpen={item => { setArticle(item); top(); }}/>)}</div>}
   </div>
   {!article && !loading && !failed && total > 0 && <nav className="reader-pagination" aria-label="星球资讯分页"><button disabled={page <= 1} aria-label="上一页" onClick={() => { setLoading(true); setPage(value => value - 1); top(); }}><ArrowLeft size={14}/></button><span>第 {page} / {pages} 页 · {total.toLocaleString("zh-CN")} 条</span><button disabled={page >= pages} aria-label="下一页" onClick={() => { setLoading(true); setPage(value => value + 1); top(); }}><ArrowRight size={14}/></button></nav>}
 </aside>;
}
