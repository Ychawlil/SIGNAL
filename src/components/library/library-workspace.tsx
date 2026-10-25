"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UpdatesPanel } from "@/components/library/updates-panel";
import { useLibrary } from "@/components/providers";
import { Bookmark } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { libraryApi } from "@/components/library/api";
import { SavedTab } from "@/components/library/saved";
import { CollectionsTab, WeeklyTab } from "@/components/library/panels";

type LibraryTab = "saved" | "queue" | "updates" | "collections" | "weekly";

function LibraryContent() {
  const params = useSearchParams();
  const { favoriteIds } = useLibrary();
  const [tab, setTab] = useState<LibraryTab>(() => params.get("tab") === "queue" ? "queue" : params.get("tab") === "updates" ? "updates" : "saved");
  const [refreshToken, setRefreshToken] = useState(0);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    libraryApi
      .list({ status: "all" })
      .then((data) => {
        if (active) setSavedCount(data.total);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshToken, favoriteIds]);

  const onMutate = () => setRefreshToken((t) => t + 1);

  return (
    <div className="flex flex-col gap-6">
      <header className="page-header flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            个人空间
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            研究库
          </h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
          <Bookmark className="h-4 w-4 text-accent" />
          <span>
            <span className="text-foreground">{savedCount ?? "—"}</span> 条收藏
          </span>
        </div>
      </header>

      <Segmented<LibraryTab>
        value={tab}
        onChange={setTab}
        size="md"
        options={[
          { value: "saved", label: "已收藏" },
          { value: "queue", label: "稍后阅读" },
          { value: "updates", label: "后续进展" },
          { value: "collections", label: "研究合集" },
          { value: "weekly", label: "每周回顾" },
        ]}
      />

      {tab === "queue" && <SavedTab key="queue" initialStatus="later" refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "updates" && <UpdatesPanel />}
      {tab === "saved" && <SavedTab key="all" refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "collections" && <CollectionsTab refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "weekly" && <WeeklyTab refreshToken={refreshToken} />}
    </div>
  );
}
export default function LibraryPage() { return <Suspense fallback={<p className="text-sm text-muted-foreground">正在加载研究库…</p>}><LibraryContent /></Suspense>; }
