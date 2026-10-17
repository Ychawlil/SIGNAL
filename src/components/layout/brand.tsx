import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent font-mono text-sm font-bold text-accent-foreground">
        S
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-[0.22em] text-foreground">
            {APP_NAME}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {APP_TAGLINE}
          </span>
        </span>
      )}
    </Link>
  );
}
