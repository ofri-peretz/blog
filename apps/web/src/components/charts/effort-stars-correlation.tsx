"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface EffortStarsDatum {
  /** Commits (effort) */
  x: number;
  /** Stars (outcome) */
  y: number;
  /** Repo / package name for the tooltip */
  name?: string;
  /** Optional bubble size proxy (downloads, e.g.) */
  z?: number;
}

interface EffortStarsCorrelationProps extends React.HTMLAttributes<HTMLElement> {
  points: EffortStarsDatum[];
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function EffortStarsCorrelation({
  points,
  className,
  "data-testid": testId,
  ...rest
}: EffortStarsCorrelationProps) {
  if (points.length === 0) {
    return (
      <p
        data-slot="effort-stars-empty"
        className="text-sm text-muted-foreground"
      >
        Not enough data points yet to draw the correlation.
      </p>
    );
  }

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const ariaLabel = `Scatter plot of effort versus stars. ${points.length} points. Effort range: ${fmt(minX)} to ${fmt(maxX)}. Stars range: ${fmt(minY)} to ${fmt(maxY)}.`;

  return (
    <figure
      data-slot="effort-stars-correlation"
      data-testid={testId}
      className={cn("h-80 w-full", className)}
      {...rest}
    >
      <div role="img" aria-label={ariaLabel} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, left: 12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              dataKey="x"
              name="Effort (commits)"
              tickFormatter={fmt}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Stars"
              tickFormatter={fmt}
              className="text-xs"
              stroke="currentColor"
            />
            <ZAxis
              type="number"
              dataKey="z"
              range={[40, 240]}
              name="Downloads"
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(v) => fmt(Number(v))}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-foreground)" }}
            />
            <Scatter
              name="Repos"
              data={points}
              fill="var(--color-chart-1)"
              fillOpacity={0.7}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
