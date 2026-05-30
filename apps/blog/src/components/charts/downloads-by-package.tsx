"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface PackageDatum {
  name: string;
  downloads: number;
}

interface DownloadsByPackageProps extends React.HTMLAttributes<HTMLElement> {
  packages: PackageDatum[];
  /** Top-N to show. Defaults to 10. */
  limit?: number;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function DownloadsByPackage({
  packages,
  limit = 10,
  className,
  "data-testid": testId,
  ...rest
}: DownloadsByPackageProps) {
  const data = [...packages]
    .filter((p) => p.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, limit)
    .map((p) => ({
      name: p.name.replace(/^eslint-plugin-/, ""),
      downloads: p.downloads,
    }));

  if (data.length === 0) {
    return (
      <p
        data-slot="downloads-by-package-empty"
        className="text-sm text-muted-foreground"
      >
        No package data yet.
      </p>
    );
  }

  const top = data[0];
  const total = data.reduce((sum, d) => sum + d.downloads, 0);
  const ariaLabel = `Bar chart of npm downloads by package. Top ${data.length} packages, ${fmt(total)} downloads total. Leader: ${top.name} with ${fmt(top.downloads)}.`;

  return (
    <figure
      data-slot="downloads-by-package"
      data-testid={testId}
      className={cn("h-80 w-full", className)}
      {...rest}
    >
      <div role="img" aria-label={ariaLabel} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={fmt}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 12 }}
              stroke="currentColor"
            />
            <Tooltip
              cursor={{ fillOpacity: 0.04 }}
              formatter={(v) =>
                [fmt(Number(v)), "Downloads"] as [string, string]
              }
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-foreground)" }}
            />
            <Bar
              dataKey="downloads"
              fill="var(--color-chart-1)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Show data as table
        </summary>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Tabular form of the bar chart above.
            </caption>
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-2">
                  Package
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Downloads
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.name}
                  className="border-t border-border tabular-nums"
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {d.name}
                  </th>
                  <td className="px-4 py-2 text-right">{fmt(d.downloads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
