"use client";
import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Orbit, Pause, Play, Radio, Search, Settings2 } from "lucide-react";
import { useLibrary } from "@/components/providers";
import { useSearch } from "@/components/search/search-dialog";
import { DateLabel } from "@/components/live-time";
import { useHydrated, usePersistentState } from "@/lib/hooks";
import { PLANETS, getPlanet, type PlanetId, type UniverseReport } from "@/lib/universe/planets";
import { PlanetWorkspace } from "./planet-workspace";
import { PlanetReader } from "./planet-reader";
import { PlainWorldNavigation } from "./universe-fallback";
import type { UniverseSceneApi } from "./universe-canvas";
import "./universe.css";
const UniverseCanvas = dynamic(() => import("./universe-canvas"), { ssr: false });
const DEFAULT_PREFERENCES = { paused: false, signals: true, plain: false };
const subscribeMotion = (callback: () => void) => { const query = window.matchMedia("(prefers-reduced-motion: reduce)"); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
class CanvasBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
 state = { failed: false };
 static getDerivedStateFromError() { return { failed: true }; }
 componentDidCatch() { this.props.onFailure(); }
 render() { return this.state.failed ? null : this.props.children; }
}
export default function UniverseHome() {
 const router = useRouter(); const params = useSearchParams();
 const selected = getPlanet(params.get("world")); const selectedId = selected?.id ?? null;
 const { openSearch } = useSearch(); const { readIds } = useLibrary(); const hydrated = useHydrated();
 const [preferences, setPreferences] = usePersistentState("signal.universe.preferences", DEFAULT_PREFERENCES, (raw) => ({ paused: raw?.paused === true, signals: raw?.signals !== false, plain: raw?.plain === true }));
 const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
 const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading"); const [attempt, setAttempt] = useState(0);
 const [report, setReport] = useState<UniverseReport | null>(null); const [dataError, setDataError] = useState(false);
 const scene = useRef<UniverseSceneApi | null>(null);
 const [arrivedId, setArrivedId] = useState<PlanetId | null>(null);
 const onFlightChange = useCallback((id: PlanetId | null, arrived: boolean) => { if (arrived) setArrivedId(id); }, []);
 useEffect(() => {
   const controller = new AbortController(); let loading = false;
   const load = async () => { if (loading || document.hidden) return; loading = true; try { const response = await fetch("/api/universe", { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(); const data = await response.json() as UniverseReport; if (!controller.signal.aborted) { setReport(data); setDataError(false); } } catch { if (!controller.signal.aborted) setDataError(true); } finally { loading = false; } };
   void load(); const timer = setInterval(() => void load(), 60000); const focus = () => void load(); window.addEventListener("focus", focus); window.addEventListener("signal-data-updated", focus);
   return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("signal-data-updated", focus); };
 }, []);
 useEffect(() => { if (status === "ready" && !preferences.plain) scene.current?.focus(selectedId); }, [status, selectedId, preferences.plain]);
 const choose = useCallback((id: PlanetId) => { if (!selectedId) { setArrivedId(null); router.replace(`/?world=${id}`, { scroll: false }); } }, [router, selectedId]);
 const reset = useCallback(() => { setArrivedId(null); router.replace("/", { scroll: false }); }, [router]);
 const onKey = useCallback((key: string) => {
   if (selectedId && key !== "Escape" && key !== "Home") return;
   if (key === "0") choose("briefing");
   else if (/^[1-6]$/.test(key)) choose(PLANETS[Number(key) - 1].id);
   else if (key === "Escape" || key === "Home") reset();
   else if (key === "ArrowLeft" || key === "ArrowRight") { const index = PLANETS.findIndex((p) => p.id === selectedId); choose(PLANETS[(index + (key === "ArrowLeft" ? -1 : 1) + PLANETS.length) % PLANETS.length].id); }
 }, [choose, reset, selectedId]);
 const updateStatus = useCallback((next: "ready" | "unavailable") => setStatus(next), []);
 const failure = useCallback(() => setStatus("unavailable"), []);
 const updated = useMemo(() => report ? PLANETS.filter((planet) => report.planets[planet.id]?.new24h > 0).map((planet) => planet.id) : [], [report]);
 const plain = preferences.plain || status === "unavailable";
 const showReader = !!selected && (plain || arrivedId === selectedId);
 const stats = selected ? report?.planets[selected.id] : undefined;
 const readSet = useMemo(() => new Set(readIds), [readIds]);
 const unread = stats && hydrated ? stats.articleIds.filter((id) => !readSet.has(id)).length : null;
 return <div className={`universe-home ${selected ? "has-focus" : "is-overview"} ${plain ? "is-plain" : ""}`}>
   <a className="universe-skip" href={showReader ? "#planet-panel-heading" : "#universe-scene"}>跳到主要内容</a>
   <div className="universe-atmosphere" aria-hidden="true" />
   {!plain && <CanvasBoundary key={attempt} onFailure={failure}><UniverseCanvas apiRef={scene} selected={selectedId} paused={preferences.paused || reduced} signals={preferences.signals} updated={updated} onSelect={choose} onFlightChange={onFlightChange} onStatus={updateStatus} onKey={onKey} /></CanvasBoundary>}
   <header className="universe-header"><button className="universe-brand" onClick={reset} aria-label="SIGNAL，返回宇宙全景"><span className="universe-wordmark">SIGNAL<span className="signal-brand-dot" /></span><span className="universe-brand-subtitle">个人科技信息宇宙</span></button><div className="universe-top-actions"><span className="universe-date"><DateLabel /></span>{!selected && <button className="universe-search" onClick={openSearch}><Search size={16} /><span>搜索整个宇宙</span><kbd>Ctrl K</kbd></button>}{!selected && <Link href="/settings" className="universe-icon" aria-label="打开设置"><Settings2 size={18} /></Link>}</div></header>
   {plain && !selected && <section className="universe-plain"><p className="universe-eyebrow">SIGNAL / 导航目录</p><h1>选择你的下一个世界。</h1><p>{status === "unavailable" ? "三维场景暂时不可用，所有内容仍可直接访问。" : "安静地浏览，也是一种探索。"}</p><PlainWorldNavigation />{status === "unavailable" && <button className="universe-text-button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); setPreferences((current) => ({ ...current, plain: false })); }}>重新尝试三维场景</button>}</section>}
   {selected && showReader && (selected.id === "library" || selected.id === "briefing" ? <PlanetWorkspace key={selected.id} planet={selected} onReset={reset}/> : <PlanetReader key={selected.id} planet={selected} stats={stats} unread={unread} error={dataError} onReset={reset}/>)}
   <div className="universe-scene-tools"><button className="universe-icon" onClick={reset} aria-label="返回全景" title="返回全景"><Orbit size={17} /></button><button className="universe-icon" aria-pressed={preferences.paused || reduced} aria-label={reduced ? "自转已暂停" : preferences.paused ? "继续星球自转" : "暂停星球自转"} title={reduced ? "系统已启用减少动态效果" : preferences.paused ? "继续自转" : "暂停自转"} disabled={reduced} onClick={() => setPreferences((current) => ({ ...current, paused: !current.paused }))}>{preferences.paused || reduced ? <Play size={16} /> : <Pause size={16} />}</button><button className="universe-icon" aria-pressed={preferences.signals} aria-label={preferences.signals ? "关闭真实更新信号" : "显示真实更新信号"} title="24 小时真实更新信号" onClick={() => setPreferences((current) => ({ ...current, signals: !current.signals }))}><Radio size={17} /></button>{!selected && <button className="universe-icon" aria-pressed={preferences.plain} aria-label={preferences.plain ? "切换三维导航" : "切换普通导航"} title={preferences.plain ? "三维导航" : "普通导航"} onClick={() => { if (status === "unavailable") { setStatus("loading"); setAttempt((value) => value + 1); } setPreferences((current) => ({ ...current, plain: !plain })); }}><LayoutGrid size={16} /></button>}</div>
   <span className="sr-only universe-status" role="status" aria-live="polite">{status === "loading" && !plain ? "正在准备三维场景…" : selected ? showReader ? `正在阅读${selected.label}` : `正在飞向${selected.label}` : "选择星球，开始探索"}</span>
 </div>;
}
