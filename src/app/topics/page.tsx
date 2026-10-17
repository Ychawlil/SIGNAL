"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { useTopics } from "@/components/providers";
import { CATEGORY_MAP, TRACKING_META } from "@/lib/constants";
import { TOPICS } from "@/lib/mock-data";
import type { TrackingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<TrackingStatus, string> = {
  active: "bg-accent-soft text-accent",
  watching: "bg-panel-secondary text-muted-foreground",
  paused: "bg-warning-soft text-warning",
};

export default function TopicsPage() {
  const { isSubscribed, toggleSubscribed } = useTopics();
  const [onlyFollowing, setOnlyFollowing] = useState(false);

  const topics = useMemo(
    () => (onlyFollowing ? TOPICS.filter((t) => isSubscribed(t.id)) : TOPICS),
    [onlyFollowing, isSubscribed],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
            Tracking
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            Topics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            选择要持续追踪的主题，订阅状态会保存在本地。
          </p>
        </div>
        <button
          onClick={() => setOnlyFollowing((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
            onlyFollowing
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          Following only
          <span className="font-mono tabular-nums">
            {TOPICS.filter((t) => isSubscribed(t.id)).length}
          </span>
        </button>
      </header>

      {topics.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="You are not following any topic"
          description="开启至少一个主题的追踪，情报工作台会围绕它组织内容。"
        />
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {topics.map((topic) => {
            const subscribed = isSubscribed(topic.id);
            const statusMeta = TRACKING_META[topic.trackingStatus];
            return (
              <article
                key={topic.id}
                className={cn(
                  "rounded-lg border bg-panel p-5 transition-colors",
                  subscribed ? "border-accent/60" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold leading-6 text-foreground">
                        {topic.name}
                      </h2>
                      <Badge
                        className={cn("font-mono uppercase tracking-wide", STATUS_STYLE[topic.trackingStatus])}
                      >
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {topic.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Switch
                      checked={subscribed}
                      onCheckedChange={() => toggleSubscribed(topic.id)}
                      label={`Follow ${topic.name}`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {subscribed ? "Following" : "Not following"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
                  <div className="rounded-md border border-border bg-panel-secondary px-3 py-2 text-center sm:w-24">
                    <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                      {topic.recentSignalCount}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-accent">
                      signals
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-accent">
                      Key developments
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {topic.keyDevelopments.map((d) => (
                        <li key={d} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                  <span className="text-muted-accent">Related · </span>
                  {topic.relatedCategories
                    .map((c) => CATEGORY_MAP[c]?.label)
                    .join(" · ")}
                  <span className="ml-2 text-muted-accent">· {statusMeta.hint}</span>
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
