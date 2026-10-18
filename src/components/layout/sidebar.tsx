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
        "fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-background/80 backdrop-blur-md transition-transform duration-200 ease-out lg:flex",
        collapsed && "-translate-x-full",
      )}
    >
      <div className="flex items-start justify-between gap-2 px-5 pb-4 pt-6">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          title="收起侧边栏"
          className="-mr-1.5 mt-0.5 text-muted-foreground hover:text-foreground"
        >
          <PanelLeftClose className="h-[18px] w-[18px]" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-accent">
          Workspace
        </p>
        <NavLinks />
      </div>
    </aside>
  );
}