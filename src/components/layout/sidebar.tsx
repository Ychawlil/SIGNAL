import { PanelLeftClose } from "lucide-react";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      // `inert` keeps the off-screen links out of the tab order when hidden.
      inert={collapsed ? true : undefined}
      aria-hidden={collapsed || undefined}
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border editorial-sidebar backdrop-blur-md transition-transform duration-200 ease-out lg:flex",
        collapsed && "-translate-x-full",
      )}
    >
      <div className="flex items-start justify-between gap-2 px-5 pb-8 pt-8">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="收起侧栏"
          title="收起侧边栏"
          className="-mr-1.5 mt-0.5 text-muted-foreground hover:text-foreground"
        >
          <PanelLeftClose className="h-[18px] w-[18px]" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <p className="px-3 pb-3 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-accent">
          工作台
        </p>
        <NavLinks />
      </div>
      <div className="mx-6 mb-6 border-t border-border pt-4">
        <p className="text-xs font-medium text-foreground">让值得关注的进展，沉淀下来。</p>
        <p className="mt-1 text-[11px] text-muted-foreground">你的个人科技情报工作台</p>
      </div>
    </aside>
  );
}