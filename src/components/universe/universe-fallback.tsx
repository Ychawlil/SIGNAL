import Link from "next/link";
import { CELESTIAL_BODIES } from "@/lib/universe/planets";
export function PlainWorldNavigation() {
 return <nav className="universe-plain-nav" aria-label="普通板块导航">{CELESTIAL_BODIES.map((planet, index) => <Link href={planet.href} key={planet.id}><span className="plain-world-token" style={{ background: planet.color }} /><span><small>0{index + 1} / {planet.name}</small><strong>{planet.label}</strong><p>{planet.subtitle}</p></span><span aria-hidden>↗</span></Link>)}</nav>;
}
export function UniverseLoading() {
 return <div className="universe-home universe-loading"><div className="universe-loading-title"><p className="universe-wordmark">SIGNAL<span className="signal-brand-dot" /></p><p className="universe-eyebrow">太阳与六颗信息星球</p><h1>一个由好奇连接的宇宙。</h1><p>正在准备三维场景，也可以直接选择板块。</p></div><PlainWorldNavigation /><Link href="/briefing" className="loading-briefing">直接阅读每日简报 →</Link></div>;
}
