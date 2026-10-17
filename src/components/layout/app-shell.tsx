"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearch } from "@/components/search/search-dialog";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
    <div className="grid-backdrop min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[240px]">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
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
