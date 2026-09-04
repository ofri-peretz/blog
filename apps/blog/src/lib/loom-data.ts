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
 * Index a series to 100 at its first non-null, non-zero point — the
 * normalization that lets threads with different units weave in one
 * plot without a second y axis (which TimeSeries deliberately refuses).
 *
 * **The leading zeros are dropped, and that is the whole point.** The control
 * promises "Indexed (start = 100)". A metric that spent its first months at
 * zero — GitHub stars did — used to be rebased on a later day while the
 * drawn line still began at 0, so the series did not start at 100 and the
 * label was simply false. Worse, the values it produced were count-shaped:
 * 19 stars against a base of 1 drew a line running to 1,900, on a chart
 * captioned "GitHub stars". It was read as 1,900 stars, which is exactly what
 * it looks like.
 *
 * Those leading points carry no ratio information anyway — every one of them
 * is 0/base. Dropping them makes the line begin where the metric began, which
 * is the only day an index can honestly be based on.
 */
export function indexTo100(points: readonly Point[]): Point[] {
  const baseAt = points.findIndex((p) => p.v != null && p.v !== 0);
  if (baseAt === -1) return [...points];
  const base = points[baseAt].v as number;
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
