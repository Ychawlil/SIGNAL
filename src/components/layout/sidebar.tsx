import { Database } from "lucide-react";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-background/80 backdrop-blur-md lg:flex">
      <div className="px-5 pb-4 pt-6">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-accent">
          Workspace
        </p>
        <NavLinks />
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-start gap-2.5 rounded-md border border-border bg-panel p-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-accent" />
          <div className="text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">Live intelligence</p>
            <p className="mt-0.5">数据来自 arXiv、GitHub、Hacker News 与 RSS 订阅源。</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
