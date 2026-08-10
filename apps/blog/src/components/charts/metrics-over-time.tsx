"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface MetricsSnapshot {
  date: string;
  npm: { totalDownloads: number };
  github: { stars: number };
  devto: { views: number };
}

interface MetricsOverTimeProps extends React.HTMLAttributes<HTMLDivElement> {
  snapshots: MetricsSnapshot[];
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    // Pinned: this is a client component, so the label is built once during
    // SSR (UTC) and again at hydration (the reader's zone). Unpinned, a
    // snapshot taken near midnight UTC renders a different day on each pass
    // and React throws a #418 hydration mismatch.
    timeZone: "UTC",
  });

export function MetricsOverTime({
  snapshots,
  className,
  "data-testid": testId,
  ...rest
}: MetricsOverTimeProps) {
  const data = snapshots.map((s) => ({
    date: s.date,
    npm: s.npm.totalDownloads,
    stars: s.github.stars,
    views: s.devto.views,
  }));

  if (data.length === 0) {
    return (
      <p
        data-slot="metrics-over-time-empty"
        className="text-sm text-muted-foreground"
      >
        No historical data yet. Check back after the first snapshot lands.
      </p>
    );
  }

  const first = data[0];
  const last = data[data.length - 1];
  const ariaLabel = `Line chart of npm downloads, GitHub stars, and Dev.to views from ${fmtDate(first.date)} to ${fmtDate(last.date)}. Most recent: ${fmt(last.npm)} downloads, ${fmt(last.stars)} stars, ${fmt(last.views)} Dev.to views.`;

  return (
    <figure
      data-slot="metrics-over-time"
      data-testid={testId}
      className={cn("h-96 w-full", className)}
      {...rest}
    >
      <div role="img" aria-label={ariaLabel} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 16, left: 12, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              yAxisId="left"
              tickFormatter={fmt}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmt}
              className="text-xs"
              stroke="currentColor"
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border)" }}
              labelFormatter={(label) => fmtDate(String(label))}
              formatter={(v) => fmt(Number(v))}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-foreground)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="npm"
              name="npm downloads"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="stars"
              name="GitHub stars"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="views"
              name="Dev.to views"
              stroke="var(--color-chart-3)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Show data as table
        </summary>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Tabular form of the line chart above.
            </caption>
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-2">
                  Date
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  npm
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Stars
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Views
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.date}
                  className="border-t border-border tabular-nums"
                >
                  <th
                    scope="row"
                    className="px-4 py-2 text-left font-normal text-muted-foreground"
                  >
                    {fmtDate(d.date)}
                  </th>
                  <td className="px-4 py-2 text-right">{fmt(d.npm)}</td>
                  <td className="px-4 py-2 text-right">{fmt(d.stars)}</td>
                  <td className="px-4 py-2 text-right">{fmt(d.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
