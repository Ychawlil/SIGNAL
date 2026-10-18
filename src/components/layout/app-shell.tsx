"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearch } from "@/components/search/search-dialog";
import { usePersistentState } from "@/lib/hooks";
import { STORAGE_KEYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Per-browser preference, like the theme: no account system yet.
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    STORAGE_KEYS.sidebar,
    false,
  );
  const { openSearch } = useSearch();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "lg:pl-0" : "lg:pl-[240px]",
        )}
      >
        <Topbar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  );
}
