import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-sm tabular-nums text-accent">404</p>
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        这个页面不存在，或已经被移动。
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-md border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-panel-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Daily Briefing
      </Link>
    </div>
  );
}
