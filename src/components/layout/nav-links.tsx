"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  BrainCircuit,
  Compass,
  FlaskConical,
  Layers,
  Newspaper,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_LINKS: NavLinkItem[] = [
  { href: "/", label: "Daily Briefing", icon: Newspaper },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/analysis", label: "Analysis", icon: BrainCircuit },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/topics", label: "Topics", icon: Layers },
  { href: "/library", label: "Library", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_LINKS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-panel-secondary hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active ? "text-accent" : "text-muted-accent group-hover:text-foreground",
              )}
            />
            <span className="truncate">{item.label}</span>
            {active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
