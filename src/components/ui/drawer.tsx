"use client";

import { type ReactNode } from "react";
import { useModal } from "@/lib/use-modal";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Side the panel slides in from. */
  side?: "right" | "left";
  title?: string;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  children,
  side = "right",
  title,
  className,
}: DrawerProps) {
  const modalRef = useModal(open, onClose);

  if (!open) return null;

  return (
    <div ref={modalRef} tabIndex={-1} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title ?? "详情"}>
      <button
        aria-label="关闭遮罩"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-overlay/80 backdrop-blur-[1px]"
      />
      <div
        className={cn(
          "absolute top-0 flex h-full w-full max-w-md flex-col border-border bg-panel shadow-2xl",
          side === "right"
            ? "right-0 border-l drawer-enter-right"
            : "left-0 border-r drawer-enter-left",
          className,
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <button
              onClick={onClose}
              aria-label="关闭"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-panel-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
