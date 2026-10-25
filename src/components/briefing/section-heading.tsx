import type { ReactNode } from "react";

interface SectionHeadingProps {
  index: string;
  label: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}

export function SectionHeading({
  index,
  label,
  title,
  description,
  aside,
}: SectionHeadingProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted-accent">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft font-mono text-[10px] tabular-nums text-accent">{index}</span>
          {label}
        </p>
        <h2 className="mt-2.5 text-lg font-semibold leading-7 tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
