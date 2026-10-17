"use client";

import { useEffect, useState } from "react";
import { currentDateLabel, relativeTime } from "@/lib/utils";

/**
 * Current-time reads must happen only on the client, so these components
 * compute the label after mount (deferred so it never runs during static
 * prerender or as a synchronous in-effect state update).
 */

export function DateLabel({ className }: { className?: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setLabel(currentDateLabel()), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}

export function TimeAgo({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setLabel(relativeTime(iso)), 0);
    return () => clearTimeout(t);
  }, [iso]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}