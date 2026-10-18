"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/components/search/search-dialog";
import { DateLabel } from "@/components/live-time";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const { openSearch } = useSearch();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="lg:hidden">
        <Brand compact />
      </div>

      <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
        <DateLabel className="tabular-nums" />
        <span className="text-border-strong">/</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span>Live intelligence</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="hidden w-52 justify-start gap-2 text-muted-foreground sm:inline-flex"
          onClick={openSearch}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search intelligence…</span>
          <kbd className="ml-auto rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">
            Ctrl K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Search"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
