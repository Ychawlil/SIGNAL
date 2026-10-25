"use client";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { PlanetConfig } from "@/lib/universe/planets";
const Library = dynamic(() => import("@/components/library/library-workspace"), { loading: () => <p>正在读取研究库…</p> });
const Briefing = dynamic(() => import("@/components/briefing/briefing-workspace"), { loading: () => <p>正在读取每日简报…</p> });
export function PlanetWorkspace({ planet, onReset }: { planet: PlanetConfig; onReset: () => void }) {
 return <aside className="planet-panel planet-reader planet-workspace dark" data-workspace={planet.id} aria-label={planet.label}>
  <header className="reader-heading"><div><p className="universe-eyebrow">{planet.id === "briefing" ? "太阳 / 今日信号" : "研究库星球 / 个人收藏"}</p><h2 id="planet-panel-heading">{planet.label}</h2></div><button className="universe-icon" aria-label="返回宇宙全景" onClick={onReset}><X size={18}/></button></header>
  <div className="reader-scroll workspace-scroll">{planet.id === "library" ? <Library/> : <Briefing/>}</div>
 </aside>;
}
