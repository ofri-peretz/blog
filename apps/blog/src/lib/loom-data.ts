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
 */
export function indexTo100(points: readonly Point[]): Point[] {
  const base = points.find((p) => p.v != null && p.v !== 0)?.v;
  if (base == null) return [...points];
  return points.map((p) => ({
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
