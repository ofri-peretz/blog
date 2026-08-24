"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * CorpusMap — the writing as an explorable territory.
 *
 * Every published article is a dot on a shared time axis, one labeled
 * strip per series. Identity is carried SPATIALLY (strip position + HTML
 * lane labels), so a single brand hue suffices — no 8-way categorical
 * palette to keep colorblind-safe. Dots are real links: hover or
 * keyboard-focus previews the article in a fixed detail strip below
 * (reserved height — no floating tooltip, no layout shift), click
 * navigates. The card grid below the map is the accessible table view.
 *
 * Layout learned the hard way (2026-08-24 visual pass):
 * - Lane labels are sticky HTML OUTSIDE the svg — labels inside the
 *   scrolling chart scrolled away with the data on mobile.
 * - Same-day same-series bursts fan into a 3-row beeswarm; before the
 *   fan, 43 of 89 dots were perfectly stacked and invisible.
 * - Dot diameter floors at 10px in viewBox units so the ~0.8 mobile
 *   scale keeps marks at or above the 8px mark-size floor.
 */

export interface CorpusPoint {
  slug: string;
  title: string;
  /** Series name, or null for standalone pieces. */
  series: string | null;
  /** ISO date (published_at, falling back to date). */
  date: string;
  minutes: number;
}

interface CorpusMapProps extends React.HTMLAttributes<HTMLElement> {
  points: readonly CorpusPoint[];
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

const STANDALONE = "Standalone";
const VW = 560; // strip width — rendered 1:1, so viewBox units ARE pixels
const LANE_H = 44;

function laneOrder(
  points: readonly CorpusPoint[],
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of points) {
    const key = p.series ?? STANDALONE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) =>
      a[0] === STANDALONE ? 1 : b[0] === STANDALONE ? -1 : b[1] - a[1],
    )
    .map(([name, count]) => ({ name, count }));
}

const fmtDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

interface Dot {
  p: CorpusPoint;
  cx: number;
  cy: number;
  r: number;
  key: string;
}

export function CorpusMap({
  points,
  className,
  "data-testid": testId,
  ...rest
}: CorpusMapProps) {
  const [active, setActive] = useState<CorpusPoint | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Start scrolled to the recent end: the timeline's left edge is its
  // sparsest region, and a narrow viewport otherwise opens on empty
  // strips. No smooth behavior — this is initial state, not motion.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const { lanes, dotsByLane, ticks } = useMemo(() => {
    if (points.length === 0) {
      // Guarded here, not only at render: Math.min() of an empty spread is
      // Infinity and the tick fallback would build an Invalid Date.
      return { lanes: [], dotsByLane: new Map<string, Dot[]>(), ticks: [] };
    }
    const lanes = laneOrder(points);
    const laneNames = lanes.map((l) => l.name);
    const times = points.map((p) => new Date(`${p.date}T00:00:00Z`).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(max - min, 1);
    const x = (t: number): number => 14 + ((t - min) / span) * (VW - 46);

    // Same-(lane,day) beeswarm fan: rows 9/22/35 inside the 44px strip,
    // columns spilling right in 10px steps. The x-drift trades sub-week
    // precision for actually showing every article in a burst.
    const groups = new Map<string, number>();
    const dotsByLane = new Map<string, Dot[]>(laneNames.map((l) => [l, []]));
    points.forEach((p, i) => {
      const lane = p.series ?? STANDALONE;
      const key = `${lane}|${p.date}`;
      const n = groups.get(key) ?? 0;
      groups.set(key, n + 1);
      // Center-first fan order: a solo dot sits centered in its lane —
      // the naive row-0-first order parked every un-bursted article at
      // the lane's top edge. Off-center rows cap at r6 so burst dots
      // keep ≥3px clearance from the lane borders.
      const dy = [0, -13, 13][n % 3];
      const rBase = 5 + Math.min(Math.max((p.minutes - 4) / 8, 0), 1) * 3;
      dotsByLane.get(lane)?.push({
        p,
        cx: x(new Date(`${p.date}T00:00:00Z`).getTime()) + Math.floor(n / 3) * 10,
        cy: 22 + dy,
        r: dy === 0 ? rBase : Math.min(rBase, 6),
        key: `${p.slug}-${i}`,
      });
    });

    // Quarter-start ticks inside [min, max]; a corpus too narrow to
    // contain one falls back to labeled endpoints, so the axis is never
    // empty (review catch: a same-year fixture produced zero ticks).
    const ticks: { x: number; label: string }[] = [];
    const cursor = new Date(min);
    let year = cursor.getUTCFullYear();
    let quarter = Math.ceil((cursor.getUTCMonth() + 1) / 3) * 3 % 12;
    for (let guard = 0; guard < 40; guard++) {
      if (quarter === 0) year += 1;
      const t = Date.UTC(year, quarter, 1);
      if (t > max) break;
      if (t >= min) {
        const label =
          quarter === 0
            ? String(year)
            : new Date(t).toLocaleDateString("en-US", {
                month: "short",
                timeZone: "UTC",
              });
        ticks.push({ x: x(t), label });
      }
      quarter = (quarter + 3) % 12;
    }
    if (ticks.length === 0) {
      ticks.push(
        { x: x(min), label: fmtDate(new Date(min).toISOString().slice(0, 10)) },
        { x: x(max), label: fmtDate(new Date(max).toISOString().slice(0, 10)) },
      );
    }

    return { lanes, dotsByLane, ticks };
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
        <span className="text-foreground">Every article, mapped.</span> Left
        to right: publication date · row: series · dot size: reading time.
        Hover to preview, click to read.
      </figcaption>
      <div ref={scrollerRef} className="overflow-x-auto">
        <div className="grid w-max grid-cols-[10rem_560px]">
          {/* Time axis as the header row — the first thing read, so the
              left-to-right = time encoding is announced before any dots. */}
          <div className="sticky left-0 z-10 border-b border-border bg-card" />
          <svg
            data-slot="corpus-map-axis"
            viewBox={`0 0 ${VW} 20`}
            width={VW}
            height={20}
            aria-hidden
            className="h-5 w-[560px] border-b border-border"
          >
            <g className="text-muted-foreground">
              {ticks.map((t) => (
                <g key={t.x}>
                  <line
                    x1={t.x}
                    x2={t.x}
                    y1={14}
                    y2={20}
                    className="stroke-border"
                  />
                  <text
                    x={t.x}
                    y={11}
                    textAnchor="middle"
                    className="fill-current text-[10px]"
                  >
                    {t.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
          {lanes.map((lane, i) => (
            <div key={lane.name} className="contents">
              {/* Sticky HTML label: stays put while the strips scroll.
                  Zebra rows + the article count make "row = one series"
                  readable at a glance. */}
              <div
                className={cn(
                  "sticky left-0 z-10 flex h-11 items-baseline gap-1.5 border-b border-border/60 pr-3 pt-3 text-[11px] font-medium leading-tight text-foreground",
                  // Opaque tokens only: the sticky label must cover dots
                  // scrolling beneath it, and stacking bg-card with a
                  // translucent zebra overlay leaves the winner to
                  // stylesheet order.
                  i % 2 === 1 ? "bg-muted" : "bg-card",
                )}
              >
                <span>{lane.name}</span>
                <span className="text-[10px] font-normal tabular-nums text-muted-foreground">
                  {lane.count}
                </span>
              </div>
              <svg
                viewBox={`0 0 ${VW} ${LANE_H}`}
                width={VW}
                height={LANE_H}
                role="group"
                aria-label={`${lane.name} — ${lane.count} articles`}
                className={cn(
                  "h-11 w-[560px] border-b border-border/60",
                  i % 2 === 1 && "bg-muted",
                )}
              >
                <g className="text-muted-foreground/60">
                  {ticks.map((t) => (
                    <line
                      key={t.x}
                      x1={t.x}
                      x2={t.x}
                      y1={0}
                      y2={LANE_H}
                      className="stroke-border"
                      strokeDasharray="2 4"
                    />
                  ))}
                </g>
                <g className="text-[var(--chart-1)]">
                  {(dotsByLane.get(lane.name) ?? []).map(({ p, cx, cy, r, key }) => (
                    <a
                      key={key}
                      href={`/articles/${p.slug}`}
                      aria-label={`${p.title} — ${p.series ?? STANDALONE}, ${fmtDate(p.date)}, ${p.minutes} min`}
                      onMouseEnter={() => setActive(p)}
                      onFocus={() => setActive(p)}
                      // Native <a href> — Enter activates and focus works by
                      // definition; the a11y rules below don't credit SVG
                      // anchors as native links. Adding onKeyDown would
                      // double-fire activation, not improve access.
                      // eslint-disable-next-line react-a11y/click-events-have-key-events
                      onClick={() =>
                        track("corpus_map:dot_click", {
                          slug: p.slug,
                          series: p.series,
                        })
                      }
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
          ))}
        </div>
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
