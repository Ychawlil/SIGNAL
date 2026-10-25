"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useSearch } from "@/components/search/search-dialog";
import { DateLabel } from "@/components/live-time";

export function AppShell({ children }: { children: ReactNode }) {
 const pathname = usePathname();
 const { openSearch } = useSearch();
 useEffect(() => {
   const onKey = (event: KeyboardEvent) => {
     // Global search belongs to the panorama; an open section has its own controls.
     if (pathname !== "/" || new URL(window.location.href).searchParams.has("world")) return;
     if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
   };
   document.addEventListener("keydown", onKey);
   return () => document.removeEventListener("keydown", onKey);
 }, [pathname, openSearch]);
 if (pathname === "/") return <main id="main-content">{children}</main>;
 return <div className="relative min-h-screen">
   <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur-md sm:px-10">
     <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/>返回全景</Link>
     <span className="text-sm tracking-[.2em] text-muted-foreground">SIGNAL</span>
     <span className="hidden text-xs text-muted-foreground sm:block"><DateLabel/></span>
   </header>
   <main id="main-content" className="editorial-main mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">{children}</main>
 </div>;
}
