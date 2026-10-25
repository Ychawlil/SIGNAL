"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Compass,
  FlaskConical,
  Layers,
  Orbit,
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
  { href: "/", label: "信息宇宙", icon: Orbit },
  { href: "/briefing", label: "每日简报", icon: Newspaper },
  { href: "/explore", label: "探索", icon: Compass },
  { href: "/research", label: "研究", icon: FlaskConical },
  { href: "/trends", label: "趋势", icon: TrendingUp },
  { href: "/topics", label: "主题", icon: Layers },
  { href: "/library", label: "研究库", icon: Bookmark },
  { href: "/settings", label: "设置", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1.5">
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
              "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-full before:bg-accent"
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
