import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "accent"
  | "outline"
  | "warning"
  | "muted"
  | "subtle";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-panel-secondary text-foreground border border-border",
  accent: "bg-accent-soft text-accent border border-transparent",
  outline: "bg-transparent text-muted-foreground border border-border",
  warning: "bg-warning-soft text-warning border border-transparent",
  muted: "bg-panel-secondary text-muted-foreground border border-transparent",
  subtle: "bg-transparent text-muted-foreground",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-4",
        "whitespace-nowrap",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
