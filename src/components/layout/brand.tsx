import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent font-mono text-sm font-bold text-accent-foreground">
        S
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-[0.22em] text-foreground">
            {APP_NAME}
          </span>
          <span className="mt-1.5 max-w-32 text-[10px] font-medium leading-4 tracking-wide text-muted-foreground">
            {APP_TAGLINE}
          </span>
        </span>
      )}
    </Link>
  );
}
