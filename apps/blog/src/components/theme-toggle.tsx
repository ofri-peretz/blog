"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function ThemeToggle({
  className,
  "data-testid": testId,
  ...rest
}: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    // SSR-safe mount-flag. Standard next-themes / hydration pattern; the lint
    // rule's preferred refactor (useSyncExternalStore) doesn't help here because
    // we need the resolved theme AFTER `next-themes` has hydrated.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        data-slot="theme-toggle"
        data-testid={testId}
        aria-label="Toggle color mode"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border",
          className,
        )}
        {...rest}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      data-slot="theme-toggle"
      data-testid={testId}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted",
        className,
      )}
      {...rest}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
