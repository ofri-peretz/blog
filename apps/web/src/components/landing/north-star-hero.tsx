"use client";

import { useState } from "react";
import {
  Compass,
  ExternalLink,
  Info,
  Rocket,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

// Below this threshold the linear progress bar is suppressed in favor of a
// "building momentum" message — early-stage projects look broken with a 2%
// progress bar.
const STARS_VISIBILITY_THRESHOLD = 10;

interface NorthStarHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  stars: number;
  /** Stars at the previous measurement window — used to render growth %. */
  previousStars?: number;
  /** Target the user is climbing toward. Defaults to 100. */
  targetStars?: number;
  loading?: boolean;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function NorthStarHero({
  stars,
  previousStars = 0,
  targetStars = 100,
  loading = false,
  className,
  "data-testid": testId,
  ...rest
}: NorthStarHeroProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const isEarlyStage = stars < STARS_VISIBILITY_THRESHOLD;
  const growthPercent =
    previousStars === 0
      ? null
      : (((stars - previousStars) / previousStars) * 100).toFixed(0);
  const progressPercent = Math.min(100, (stars / targetStars) * 100);

  return (
    <div
      data-slot="north-star-hero"
      data-testid={testId}
      className={cn(
        "relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 p-4 sm:rounded-2xl sm:p-6 md:p-8 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-amber-900/20",
        className,
      )}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-3xl sm:h-64 sm:w-64"
      />

      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-center gap-1.5 sm:mb-4 sm:gap-2">
          <Compass
            aria-hidden="true"
            className="h-4 w-4 animate-pulse text-amber-500 sm:h-5 sm:w-5"
          />
          <span className="text-xs font-medium uppercase tracking-wider text-amber-600 sm:text-sm dark:text-amber-400">
            North Star Metric
          </span>
          <button
            type="button"
            aria-label="What is a North Star Metric?"
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <Info
              aria-hidden="true"
              className="h-3.5 w-3.5 cursor-help text-muted-foreground transition-colors hover:text-amber-500 sm:h-4 sm:w-4"
            />
            {showTooltip && (
              <div
                role="tooltip"
                className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg bg-popover p-2.5 text-[11px] text-popover-foreground shadow-xl sm:w-64 sm:p-3 sm:text-xs"
              >
                <p className="mb-1 font-medium">What is a North Star Metric?</p>
                <p className="text-muted-foreground">
                  Following Sequoia&apos;s framework, a North Star Metric is the
                  single metric that best captures the core value you deliver.
                  For open source, GitHub Stars represent peer-recognized
                  technical value.
                </p>
                <a
                  href="https://articles.sequoiacap.com/frameworks-for-product-success"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-amber-500 hover:underline"
                >
                  Learn more
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
              </div>
            )}
          </button>
        </div>

        <div className="mb-4 text-center sm:mb-6">
          <div className="inline-flex items-center gap-2 sm:gap-3">
            <Star
              aria-hidden="true"
              className="h-8 w-8 text-amber-400 drop-shadow-lg sm:h-12 sm:w-12 md:h-16 md:w-16"
            />
            <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-4xl font-bold tabular-nums text-transparent sm:text-5xl md:text-7xl">
              {loading ? (
                <span className="animate-pulse">…</span>
              ) : (
                <NumberTicker value={stars} startValue={0} duration={2.5} />
              )}
            </div>
          </div>
          <div className="mt-1.5 text-sm text-muted-foreground sm:mt-2 sm:text-base md:text-lg">
            GitHub Stars
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs sm:mb-6 sm:gap-6 sm:text-sm">
          {growthPercent && growthPercent !== "0" && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {Number.parseFloat(growthPercent) >= 0 ? (
                <TrendingUp
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4"
                />
              ) : (
                <TrendingDown
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-rose-500 sm:h-4 sm:w-4"
                />
              )}
              <span
                className={cn(
                  "text-[11px] font-medium sm:text-sm",
                  Number.parseFloat(growthPercent) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {Number.parseFloat(growthPercent) >= 0 ? "+" : ""}
                {growthPercent}% this month
              </span>
            </div>
          )}
          <div
            aria-hidden="true"
            className="hidden h-3 w-px bg-border sm:block sm:h-4"
          />
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Target
              aria-hidden="true"
              className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4"
            />
            <span className="text-[11px] text-muted-foreground sm:text-sm">
              Target: <span className="font-medium">{targetStars}</span>
            </span>
          </div>
        </div>

        {isEarlyStage ? (
          <div className="mx-auto max-w-md px-2 sm:px-0">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Rocket aria-hidden="true" className="h-4 w-4 text-amber-500" />
              <span>Building momentum — focused on shipping value</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md px-2 sm:px-0">
            <div className="mb-1 flex justify-between text-[10px] text-muted-foreground sm:text-xs">
              <span>Progress to target</span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress toward ${targetStars} stars`}
              className="h-1.5 overflow-hidden rounded-full bg-muted sm:h-2"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <p className="mx-auto mt-6 max-w-lg text-center text-sm italic text-muted-foreground">
          “GitHub Stars represent peer-recognized technical value — a durable
          signal of quality and utility in the engineering ecosystem.”
        </p>
      </div>
    </div>
  );
}
