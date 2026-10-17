"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-8 w-8 text-warning" />
      <h1 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        页面渲染时出现了问题。你可以尝试重新加载，本地数据不会丢失。
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
