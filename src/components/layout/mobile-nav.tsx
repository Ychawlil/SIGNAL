"use client";

import { Drawer } from "@/components/ui/drawer";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  return (
    <Drawer open={open} onClose={onClose} side="left" title="SIGNAL">
      <div className="flex h-full flex-col">
        <div className="px-5 pb-4 pt-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks onNavigate={onClose} />
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-xs text-muted-foreground">主题外观</span>
          <ThemeToggle />
        </div>
      </div>
    </Drawer>
  );
}
