import { CATEGORY_MAP } from "@/lib/constants";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function CategoryBadge({ category }: { category: CategoryId }) {
  const meta = CATEGORY_MAP[category];
  return (
    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
      {meta?.shortLabel ?? category}
    </Badge>
  );
}

export function ImportanceMeter({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title={`Importance ${score}/100`}
    >
      <span className="h-1 w-14 overflow-hidden rounded-full bg-panel-secondary">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {score}
      </span>
    </span>
  );
}
