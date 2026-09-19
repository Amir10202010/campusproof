"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * One button, one job: switch to the other theme. The label names the destination, so it reads the
 * same to a screen reader as the icon looks to an eye.
 *
 * Which icon and which label to show is decided in CSS from the `dark` class on <html>, not from
 * React state. The server cannot know the visitor's theme, and a mounted flag would mean one frame
 * of the wrong icon on every load; a `dark:` variant is simply correct at first paint. The hidden
 * label is display:none, so it is left out of the accessible name too.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn("text-muted-foreground hover:text-foreground", className)}
        >
          <Sun className="dark:hidden" aria-hidden="true" />
          <Moon className="hidden dark:block" aria-hidden="true" />
          <span className="sr-only dark:hidden">Включить тёмную тему</span>
          <span className="sr-only hidden dark:inline">Включить светлую тему</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="dark:hidden">Тёмная тема</span>
        <span className="hidden dark:inline">Светлая тема</span>
      </TooltipContent>
    </Tooltip>
  );
}
