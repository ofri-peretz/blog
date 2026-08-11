import * as React from 'react';

import { cn } from '@/lib/utils';
import { day, type Point } from '@/components/ui/charts/scale';

export const MIN_VIEWPORT = 320 as const;

export interface SeriesTableProps extends React.ComponentProps<'div'> {
  /** One entry per series. A single-series chart passes one. */
  series: readonly { label: string; points: readonly Point[] }[];
  /** The `<caption>`. Required — an unnamed table is a wall of numbers. */
  caption: string;
  /** Render `sr-only` (default) or visibly. */
  hidden?: boolean;
  /** Column header for the x axis. */
  keyLabel?: string;
}

export const SeriesTable = React.forwardRef<HTMLDivElement, SeriesTableProps>(
  function SeriesTable(
    { series, caption, hidden = true, keyLabel = 'Date', className, ...props },
    ref,
  ) {
    // Union of every timestamp across every series, so a series with a gap
    // still lines up column-for-column with one that has none.
    const rows = React.useMemo(() => {
      const keys = new Set<string>();
      for (const s of series) for (const p of s.points) keys.add(day(p.t));
      return [...keys].sort();
    }, [series]);

    const byKey = React.useMemo(
      () => series.map((s) => new Map(s.points.map((p) => [day(p.t), p.v]))),
      [series],
    );

    return (
      <div
        ref={ref}
        data-slot="series-table"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(hidden ? 'sr-only' : 'w-full overflow-x-auto', className)}
        {...props}
      >
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="mb-2 text-left text-xs text-muted-foreground">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-3 py-2 text-left font-medium">
                {keyLabel}
              </th>
              {series.map((s) => (
                <th
                  key={s.label}
                  scope="col"
                  className="border-b border-border px-3 py-2 text-right font-medium"
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => (
              <tr key={key}>
                <th
                  scope="row"
                  className="border-b border-border px-3 py-1.5 text-left font-normal"
                >
                  {key}
                </th>
                {byKey.map((map, i) => {
                  const value = map.get(key);
                  return (
                    <td
                      key={series[i].label}
                      className="border-b border-border px-3 py-1.5 text-right"
                    >
                      {/* "No data" spelled out, not an em dash — a screen
                          reader announces "—" as nothing at all. */}
                      {value == null ? (
                        <span className="text-muted-foreground">No data</span>
                      ) : (
                        value.toLocaleString()
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
