import { Suspense } from "react";
import { ExploreClient } from "./explore-client";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="h-24 animate-pulse rounded-lg border border-border bg-panel" />
          <div className="h-28 animate-pulse rounded-lg border border-border bg-panel" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-border bg-panel"
              />
            ))}
          </div>
        </div>
      }
    >
      <ExploreClient />
    </Suspense>
  );
}