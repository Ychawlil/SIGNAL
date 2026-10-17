import type { ReactNode } from "react";
import { BookOpen, Box, GitBranch, Users } from "lucide-react";
import type { WorthFollowingItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

const KIND_META: Record<
  WorthFollowingItem["kind"],
  { label: string; icon: ReactNode }
> = {
  model: { label: "Model", icon: <Box className="h-3.5 w-3.5" /> },
  paper: { label: "Paper", icon: <BookOpen className="h-3.5 w-3.5" /> },
  repo: { label: "Repo", icon: <GitBranch className="h-3.5 w-3.5" /> },
  team: { label: "Team", icon: <Users className="h-3.5 w-3.5" /> },
};

export function WorthFollowing({ items }: { items: WorthFollowingItem[] }) {
  return (
    <section>
      <SectionHeading
        index="E"
        label="Watchlist"
        title="Worth Following"
        description="近期值得持续追踪的模型与开源项目，来自真实仓库与模型版本数据。"
      />
      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-panel p-5 text-sm text-muted-foreground">
          暂无足够的数据生成追踪清单，待采集更多仓库与模型版本后展示。
        </p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <Card key={item.id} className="transition-colors hover:border-border-strong">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="gap-1">
                      {meta.icon}
                      {meta.label}
                    </Badge>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold leading-6 text-foreground">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-2 border-t border-border pt-2 text-xs leading-5 text-muted-foreground">
                    <span className="text-muted-accent">Why follow · </span>
                    {item.whyFollow}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
