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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-accent">
          <span className="tabular-nums text-accent">{index}</span>
          {label}
        </p>
        <h2 className="mt-1.5 text-base font-semibold leading-6 text-foreground">
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
