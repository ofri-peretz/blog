"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * CorpusMap — the writing as an explorable territory.
 *
 * Every published article is a dot on a time axis, grouped into labeled
 * series lanes. Identity is carried SPATIALLY (lane position + direct lane
 * labels), so a single brand hue suffices — no 8-way categorical palette
 * to keep colorblind-safe. Dots are real links: hover or keyboard-focus
 * previews the article in a fixed detail strip below the chart (reserved
 * height, so no layout shift and no floating-tooltip positioning), click
 * navigates. The card grid below the map is the accessible table view of
 * the same data.
 *
 * Dot radius encodes reading time (8–14px diameter, per mark-size floor);
 * the strip spells the number out, so size is never the only carrier.
 */

export interface CorpusPoint {
  slug: string;
  title: string;
  /** Series name, or null for standalone pieces. */
  series: string | null;
  /** ISO date (published_at). */
  date: string;
  minutes: number;
}

interface CorpusMapProps extends React.HTMLAttributes<HTMLElement> {
  points: readonly CorpusPoint[];
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const STANDALONE = "Standalone";
const W = 760;
const LANE_H = 44;
const LABEL_W = 168;
const TOP_PAD = 8;
const AXIS_H = 26;

function laneOrder(points: readonly CorpusPoint[]): string[] {
  const counts = new Map<string, number>();
  for (const p of points) {
    const key = p.series ?? STANDALONE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) =>
      a[0] === STANDALONE ? 1 : b[0] === STANDALONE ? -1 : b[1] - a[1],
    )
    .map(([name]) => name);
}

const fmtDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export function CorpusMap({
  points,
  className,
  "data-testid": testId,
  ...rest
}: CorpusMapProps) {
  const [active, setActive] = useState<CorpusPoint | null>(null);

  const { lanes, dots, ticks, height } = useMemo(() => {
    const lanes = laneOrder(points);
    const times = points.map((p) => new Date(`${p.date}T00:00:00Z`).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(max - min, 1);
    const x = (t: number): number =>
      LABEL_W + 14 + ((t - min) / span) * (W - LABEL_W - 34);

    const dots = points.map((p, i) => ({
      p,
      cx: x(new Date(`${p.date}T00:00:00Z`).getTime()),
      cy: TOP_PAD + lanes.indexOf(p.series ?? STANDALONE) * LANE_H + LANE_H / 2,
      // 8–14px diameter across the corpus's 4–12 minute range.
      r: 4 + Math.min(Math.max((p.minutes - 4) / 8, 0), 1) * 3,
      key: `${p.slug}-${i}`,
    }));

    const ticks: { x: number; label: string }[] = [];
    const first = new Date(min);
    for (
      let year = first.getUTCFullYear() + (first.getUTCMonth() === 0 ? 0 : 1);
      year <= new Date(max).getUTCFullYear();
      year++
    ) {
      const t = Date.UTC(year, 0, 1);
      if (t >= min && t <= max) ticks.push({ x: x(t), label: String(year) });
    }

    return { lanes, dots, ticks, height: TOP_PAD + lanes.length * LANE_H + AXIS_H };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <figure
      data-slot="corpus-map"
      data-testid={testId}
      className={cn("rounded-lg border border-border bg-card p-4", className)}
      {...rest}
    >
      <figcaption className="mb-3 text-sm text-muted-foreground">
        Every article, by series and publication date — hover to preview,
        click to read.
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          role="group"
          aria-label="Timeline map of all articles by series"
          className="min-w-[640px] w-full"
        >
          {/* Recessive year gridlines + labels */}
          <g className="text-muted-foreground/60">
            {ticks.map((t) => (
              <g key={t.label}>
                <line
                  x1={t.x}
                  x2={t.x}
                  y1={TOP_PAD}
                  y2={height - AXIS_H + 6}
                  className="stroke-border"
                  strokeDasharray="2 4"
                />
                <text
                  x={t.x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-current text-[10px]"
                >
                  {t.label}
                </text>
              </g>
            ))}
          </g>

          {/* Direct lane labels — the legend, spelled out in place */}
          <g className="text-foreground">
            {lanes.map((name, i) => (
              <text
                key={name}
                x={0}
                y={TOP_PAD + i * LANE_H + LANE_H / 2 + 4}
                className="fill-current text-[11px] font-medium"
              >
                {name.length > 24 ? `${name.slice(0, 23)}…` : name}
              </text>
            ))}
          </g>

          {/* Lane separators */}
          <g>
            {lanes.slice(1).map((name, i) => (
              <line
                key={name}
                x1={LABEL_W}
                x2={W}
                y1={TOP_PAD + (i + 1) * LANE_H}
                y2={TOP_PAD + (i + 1) * LANE_H}
                className="stroke-border/60"
              />
            ))}
          </g>

          {/* Article dots — real links with a 2px surface ring for overlap */}
          <g className="text-[var(--chart-1)]">
            {dots.map(({ p, cx, cy, r, key }) => (
              <a
                key={key}
                href={`/articles/${p.slug}`}
                aria-label={`${p.title} — ${p.series ?? STANDALONE}, ${fmtDate(p.date)}, ${p.minutes} min`}
                onMouseEnter={() => setActive(p)}
                onFocus={() => setActive(p)}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  className="fill-current stroke-card stroke-2 opacity-80 transition-opacity hover:opacity-100"
                />
              </a>
            ))}
          </g>
        </svg>
      </div>
      {/* Fixed-height detail strip — the hover layer without a floating
          tooltip: no positioning math, no clipping, no layout shift. */}
      <div
        aria-live="polite"
        className="mt-3 flex min-h-12 items-center rounded-md bg-muted/40 px-4 text-sm"
      >
        {active ? (
          <span className="truncate">
            <span className="font-medium text-foreground">{active.title}</span>{" "}
            <span className="text-muted-foreground">
              · {active.series ?? STANDALONE} · {fmtDate(active.date)} ·{" "}
              {active.minutes} min
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Hover a dot to preview an article.
          </span>
        )}
      </div>
    </figure>
  );
}
