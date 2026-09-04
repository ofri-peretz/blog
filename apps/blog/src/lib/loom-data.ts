// The Loom's data vocabulary + pure series math — client-safe.
//
// Split from loom-corpus.ts because that module is `server-only` (it
// holds the Supabase assembly), while the composer runs these same
// transforms in the browser on every recomposition. No I/O, no React —
// everything here is locked by unit tests that run without a DOM.

import type { Point } from "@/components/ui/scale";

export const LOOM_GROUPS = ["npm", "devto", "github", "site"] as const;
export type LoomGroup = (typeof LOOM_GROUPS)[number];

export interface LoomSeries {
  /** Stable id — the URL vocabulary ("npm:total", "github:stars"). */
  id: string;
  group: LoomGroup;
  label: string;
  /** Noun for the values — TimeSeries prints it after each readout. */
  unit: string;
  points: readonly Point[];
  /** Where the numbers come from — rendered under the chart, verbatim. */
  provenance: string;
}

export interface LoomCorpus {
  /** Latest observation date across every series. */
  observedThrough: string;
  series: readonly LoomSeries[];
}

/** ISO Monday of the week containing an ISO date. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily rows → weekly totals, keyed by the week's Monday.
 *
 * A trailing bucket whose week is not fully covered by the data range
 * (its Sunday lands after `observedThrough`) is DROPPED, not shown: a
 * 2-day "week" renders as a cliff, and a cliff that appears every
 * Monday morning is a lie about the trend. Interior gaps do not drop a
 * bucket — a missing daily row is a day the registry reported nothing,
 * and the week's total is still the honest sum of what it reported.
 */
export function weeklyTotals(
  daily: ReadonlyArray<{ day: string; value: number }>,
  observedThrough: string,
): Point[] {
  const sums = new Map<string, number>();
  for (const { day, value } of daily) {
    const monday = mondayOf(day);
    sums.set(monday, (sums.get(monday) ?? 0) + value);
  }
  return [...sums.entries()]
    .filter(([monday]) => addDays(monday, 6) <= observedThrough)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([t, v]) => ({ t, v }));
}

/**
 * The smallest base an index can honestly be built on.
 *
 * An index answers "how much has this grown relative to its start", and the
 * resolution of that answer is `1 / base`. With a base of 1, the smallest
 * possible change — one star — is +100 index points. Such a series is not
 * being scaled, it is being multiplied by 100: 19 GitHub stars drew a line to
 * 1,900 on a chart captioned "GitHub stars", and was read as 1,900 stars,
 * which is exactly what it looked like.
 *
 * At 10 the smallest step is 10 points. Below that the chart is reporting
 * quantization as growth, so it should not draw the series at all.
 */
export const MIN_INDEX_BASE = 10;

/**
 * Index a series to 100 at its first non-null, non-zero point.
 *
 * The normalization that lets threads with different units weave in one plot
 * without a second y axis (which TimeSeries deliberately refuses).
 *
 * Returns an EMPTY series when there is no base, or when the base is below
 * `MIN_INDEX_BASE`. Empty rather than unindexed: silently falling back to
 * absolute would put a raw count on an axis every other thread has scaled,
 * which is the same category error one layer down. The caller names the
 * dropped threads and offers the absolute view.
 *
 * Leading zeros are dropped so the drawn line genuinely starts at 100 — the
 * control says "start = 100", and those points carry no ratio information
 * anyway, every one being 0/base.
 */
export function indexTo100(points: readonly Point[]): Point[] {
  const baseAt = points.findIndex((p) => p.v != null && p.v !== 0);
  if (baseAt === -1) return [];
  const base = points[baseAt].v as number;
  if (base < MIN_INDEX_BASE) return [];
  return points.slice(baseAt).map((p) => ({
    t: p.t,
    v: p.v == null ? null : Math.round((p.v / base) * 1000) / 10,
  }));
}

/** Points on/after a cutoff (inclusive). */
export function windowPoints(
  points: readonly Point[],
  cutoff: string,
): Point[] {
  return points.filter((p) => p.t >= cutoff);
}
