"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export interface ChartMarker {
  /** Same bucket-key vocabulary the series use. */
  t: string;
  label: string;
  kind: "publish" | "adoption" | "engagement";
  weight: 1 | 2 | 3;
}

export interface ChartSeries {
  id: string;
  label: string;
  points: { t: string; v: number }[];
  /** Rendered as bars rather than a line — the "volume" view of a delta. */
  asBars?: boolean;
}

/**
 * The shared time axis.
 *
 * lightweight-charts is TradingView's own library, which is the point: the
 * crosshair, the pan/zoom and the axis are the parts that make a terminal feel
 * like one, and they are also the parts that are miserable to hand-roll. Every
 * other chart in this app is bespoke SVG and none of them can do any of it.
 */

/**
 * Bucket key → a real timestamp.
 *
 * `/api/series` returns display keys for coarse grains — `2026-W32` for a week,
 * `2026-08` for a month — and neither is a time the chart can place. Converting
 * here rather than changing the API keeps the key human-readable everywhere
 * else it is shown.
 */
function toTime(key: string): UTCTimestamp {
  const week = /^(\d{4})-W(\d{2})$/.exec(key);
  if (week) {
    const year = Number(week[1]);
    const w = Number(week[2]);
    // ISO week 1 contains Jan 4th; step back to that week's Monday, then add.
    const jan4 = Date.UTC(year, 0, 4);
    const dow = (new Date(jan4).getUTCDay() + 6) % 7;
    return ((jan4 - dow * 86_400_000 + (w - 1) * 7 * 86_400_000) / 1000) as UTCTimestamp;
  }
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) return (Date.UTC(Number(month[1]), Number(month[2]) - 1, 1) / 1000) as UTCTimestamp;
  return (Date.parse(key + "T00:00:00Z") / 1000) as UTCTimestamp;
}

/**
 * Distinct hues that survive both themes.
 *
 * Not the brand accent for everything: on a comparison chart the colour IS the
 * legend, so two series that read as the same colour make the chart unusable.
 */
export const PALETTE = ["#f4794a", "#0d9460", "#5b8def", "#c9a227", "#a259c4", "#39b8b0"];

const MARKER_COLOUR: Record<string, string> = {
  publish: "#5b8def",
  adoption: "#0d9460",
  engagement: "#8b847a",
};

export function SeriesChart({
  series,
  markers = [],
  height = 340,
}: {
  series: ChartSeries[];
  markers?: ChartMarker[];
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const drawn = useRef<ISeriesApi<"Line" | "Histogram">[]>([]);
  /** Whether the container has ever reported a non-zero width. */
  const sized = useRef(false);
  /**
   * The latest series, readable from the mount effect.
   *
   * Without it the two effects can disagree: changing `height` tears the chart
   * down and builds an empty one, while the data effect — keyed on `series` —
   * does not re-run, so the chart stays blank until the next selection change.
   */
  const latest = useRef(series);
  latest.current = series;
  const latestMarkers = useRef(markers);
  latestMarkers.current = markers;

  useEffect(() => {
    if (!box.current) return;
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const ink = dark ? "#a9a29a" : "#57524b";
    const line = dark ? "#262320" : "#e6e2dd";

    const c = createChart(box.current, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: ink,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 11,
      },
      grid: { vertLines: { color: line }, horzLines: { color: line } },
      rightPriceScale: { borderColor: line },
      timeScale: { borderColor: line, timeVisible: false },
      crosshair: { mode: 0 }, // free crosshair: read any series at any instant
      localization: { locale: "en-US" },
    });
    chart.current = c;

    // The container can measure 0 on the first observation, and fitContent()
    // against a zero width leaves the visible range anchored so the data draws
    // as a sliver at the right edge until something else forces a redraw. Fit
    // again the first time a real width arrives.
    const ro = new ResizeObserver(() => {
      const w = box.current?.clientWidth ?? 0;
      if (!w) return;
      c.applyOptions({ width: w });
      if (!sized.current) {
        sized.current = true;
        c.timeScale().fitContent();
      }
    });
    ro.observe(box.current);
    const initial = box.current.clientWidth;
    if (initial) {
      c.applyOptions({ width: initial });
      sized.current = true;
    }

    // Recreating the chart (a height change) must re-draw; the data effect will
    // not fire if `series` has not changed identity.
    draw.current();

    return () => {
      ro.disconnect();
      c.remove();
      chart.current = null;
      drawn.current = [];
      sized.current = false;
    };
  }, [height]);

  const draw = useRef<() => void>(() => {});
  draw.current = () => {
    const c = chart.current;
    if (!c) return;

    for (const s of drawn.current) c.removeSeries(s);
    drawn.current = [];
    const series = latest.current;

    // A ratio (0.01) and a view count (7,066) on one price scale renders the
    // ratio as a flat line welded to the axis — technically plotted, actually
    // unreadable. Anything two orders of magnitude below the largest series
    // gets its own scale, which is what a terminal does with a second symbol.
    const peak = (pts: { v: number }[]) =>
      pts.reduce((m, p) => Math.max(m, Math.abs(p.v)), 0);
    const biggest = Math.max(...series.map((s) => peak(s.points)), 0);
    const needsLeft = series.some(
      (s) => biggest > 0 && peak(s.points) > 0 && peak(s.points) < biggest / 100,
    );
    // Set every draw, not only when it becomes true: turning it on and never
    // off leaves an empty left axis floating after the small-magnitude series
    // is removed, until something recreates the chart.
    c.priceScale("left").applyOptions({ visible: needsLeft });

    series.forEach((s, i) => {
      const colour = PALETTE[i % PALETTE.length];
      const mine = peak(s.points);
      const scaleId = biggest > 0 && mine > 0 && mine < biggest / 100 ? "left" : "right";
      const opts = { color: colour, priceLineVisible: false, priceScaleId: scaleId };
      const api = s.asBars
        ? c.addSeries(HistogramSeries, opts)
        : c.addSeries(LineSeries, { ...opts, lineWidth: 2, lastValueVisible: true });

      // Sort and de-duplicate: lightweight-charts throws on unordered or
      // repeated timestamps, and a month bucket can repeat a key if the window
      // straddles a boundary.
      const seen = new Map<number, number>();
      for (const p of s.points) {
        const t = toTime(p.t);
        if (Number.isFinite(t) && Number.isFinite(p.v)) seen.set(t, p.v);
      }
      api.setData(
        [...seen.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({ time: time as UTCTimestamp, value })),
      );
      drawn.current.push(api);
    });

    // Markers hang off one series because lightweight-charts anchors them to a
    // series' time scale. The first drawn one is the anchor; which one it is
    // does not matter, since every series shares the axis.
    const anchor = drawn.current[0];
    const ms = latestMarkers.current;
    if (anchor && ms.length) {
      const byTime = new Map<number, ChartMarker[]>();
      for (const m of ms) {
        const t = toTime(m.t);
        if (!Number.isFinite(t)) continue;
        (byTime.get(t) ?? byTime.set(t, []).get(t)!).push(m);
      }
      // One marker per timestamp. Three articles on one day is one pin reading
      // "3 events", not three pins fighting for the same pixel.
      // Text is rationed. lightweight-charts draws every marker's label, so 81
      // publishes over eight months rendered as a solid wall of overlapping
      // strings across the bottom of the chart — every event labelled is the
      // same as none of them labelled.
      //
      // So: the arrow is the event, and the label is reserved for the ones
      // worth reading at a glance. A merge (weight 3) always gets its text; a
      // publish only does when the whole chart is sparse enough to fit them.
      const sparse = byTime.size <= 12;
      createSeriesMarkers(
        anchor,
        [...byTime.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([time, group]) => {
            const top = group.reduce((m, g) => (g.weight > m.weight ? g : m), group[0]);
            const worthLabelling = top.weight >= 3 || sparse;
            return {
              time: time as UTCTimestamp,
              position: "belowBar" as const,
              color: MARKER_COLOUR[top.kind] ?? "#8b847a",
              shape: "arrowUp" as const,
              text: worthLabelling
                ? group.length > 1
                  ? `${top.label} +${group.length - 1}`
                  : top.label
                : "",
            };
          }),
      );
    }

    if (series.length) c.timeScale().fitContent();
  };

  useEffect(() => {
    draw.current();
  }, [series, markers]);

  return <div ref={box} className="w-full" />;
}
