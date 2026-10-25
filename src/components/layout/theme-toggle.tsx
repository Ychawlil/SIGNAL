"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "切换浅色主题" : "切换深色主题"}
      title={dark ? "切换浅色主题" : "切换深色主题"}
      onClick={toggleTheme}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
