"use client";

import { useSyncExternalStore } from "react";
import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full border border-[#d6e7ff] bg-white text-[#2f63a7] hover:bg-[#eef5ff]"
        aria-label="Toggle theme"
      >
        <SunMedium className="h-4 w-4" />
      </Button>
    );
  }

  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full border border-[#d6e7ff] bg-white text-[#2f63a7] hover:bg-[#eef5ff]"
      onClick={() => setTheme(nextTheme)}
      aria-label="Toggle theme"
    >
      <SunMedium className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </Button>
  );
}
