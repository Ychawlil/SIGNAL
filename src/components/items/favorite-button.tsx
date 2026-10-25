"use client";

import { Bookmark } from "lucide-react";
import { useLibrary } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  id: string;
  className?: string;
  size?: "sm" | "icon-sm";
}

export function FavoriteButton({ id, className, size = "icon-sm" }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useLibrary();
  const active = isFavorite(id);

  return (
    <Button
      variant="ghost"
      size={size}
      aria-label={active ? "取消收藏" : "加入收藏"}
      title={active ? "取消收藏" : "加入收藏"}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(id);
      }}
      className={cn(
        "shrink-0",
        active ? "text-accent hover:text-accent" : "text-muted-foreground",
        className,
      )}
    >
      <Bookmark className={cn("h-4 w-4", active && "fill-current")} />
    </Button>
  );
}
