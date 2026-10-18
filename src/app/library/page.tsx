"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { libraryApi } from "@/components/library/api";
import { SavedTab } from "@/components/library/saved";
import { DiscoverTab } from "@/components/library/discover";
import { CollectionsTab, TopicsTab, WeeklyTab } from "@/components/library/panels";

type LibraryTab = "saved" | "discover" | "collections" | "topics" | "weekly";

export default function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>("saved");
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
  }, [refreshToken]);

  const onMutate = () => setRefreshToken((t) => t + 1);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            Personal
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            Library
          </h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
          <Bookmark className="h-4 w-4 text-accent" />
          <span>
            <span className="text-foreground">{savedCount ?? "—"}</span> saved
          </span>
        </div>
      </header>

      <Segmented<LibraryTab>
        value={tab}
        onChange={setTab}
        size="md"
        options={[
          { value: "saved", label: "Saved" },
          { value: "discover", label: "Discover" },
          { value: "collections", label: "Collections" },
          { value: "topics", label: "Topics & keywords" },
          { value: "weekly", label: "Weekly review" },
        ]}
      />

      {tab === "saved" && <SavedTab refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "discover" && <DiscoverTab refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "collections" && <CollectionsTab refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "topics" && <TopicsTab refreshToken={refreshToken} onMutate={onMutate} />}
      {tab === "weekly" && <WeeklyTab refreshToken={refreshToken} />}
    </div>
  );
}