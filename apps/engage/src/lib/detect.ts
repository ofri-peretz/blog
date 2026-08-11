/**
 * Trend, correlation and divergence detection over the series spine.
 *
 * Two traps govern every choice in this file, and both of them produce
 * confident-looking nonsense rather than an obvious error:
 *
 * 1. **Almost every metric we own is CUMULATIVE.** Followers, views, downloads,
 *    stars — they only go up. Fitting a trend to the level therefore reports
 *    "rising" for everything, forever, including a metric that has been dead
 *    for a month. The meaningful trend for a cumulative series lives in its
 *    FIRST DIFFERENCE (the daily gain), which is why `trend()` differences by
 *    default and the caller has to opt out for a series that is already a rate.
 *
 * 2. **Correlating two cumulative series returns ~0.99 for every pair.** Both
 *    climb monotonically, so Pearson on the levels measures "do these both go
 *    up" — which we already know. It is the textbook spurious-correlation
 *    result and it would make the feature actively misleading. `correlate()`
 *    differences both sides before doing anything.
 *
 * The statistics are deliberately robust rather than clever: Mann-Kendall for
 * whether a trend exists, Theil-Sen for how steep it is. Both are rank-based,
 * so a single spike (a Hacker News day) cannot manufacture a trend the way it
 * can with ordinary least squares.
 */

export type Point = { t: string; v: number };

export type TrendDirection = "rising" | "falling" | "flat";

export interface Trend {
  direction: TrendDirection;
  /** Median change per bucket (Theil-Sen), in the series' own units. */
  slope: number;
  /** Kendall's tau, -1..1. Strength, independent of magnitude. */
  tau: number;
  /** Two-sided p-value from the Mann-Kendall normal approximation. */
  p: number;
  /** Points actually used after differencing and dropping non-finite values. */
  n: number;
  /** Set when the answer is "we cannot tell", so the UI can say so. */
  insufficient?: string;
}

/** Φ(z) for the standard normal, via an Abramowitz-Stegun erf approximation. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

/** First difference — the daily gain of a cumulative series. */
export function diff(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(values[i] - values[i - 1]);
  return out;
}

/**
 * Median of the pairwise slopes (Theil-Sen).
 *
 * O(n²), and n here is a few hundred buckets at most, so the robustness is
 * free. Preferred over least squares because one outlier day cannot drag it.
 */
function theilSen(values: number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      slopes.push((values[j] - values[i]) / (j - i));
  if (!slopes.length) return 0;
  slopes.sort((a, b) => a - b);
  const m = slopes.length >> 1;
  return slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2;
}

/**
 * Mann-Kendall S statistic and its tie-corrected variance.
 *
 * Ties matter here more than in most datasets: a stalled metric produces long
 * runs of identical daily gains (often zero), and the uncorrected variance
 * would understate p and call a flat line a trend.
 */
function mannKendall(values: number[]): { s: number; varS: number } {
  const n = values.length;
  let s = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) s += Math.sign(values[j] - values[i]);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tieAdj = 0;
  for (const c of counts.values()) if (c > 1) tieAdj += c * (c - 1) * (2 * c + 5);

  return { s, varS: (n * (n - 1) * (2 * n + 5) - tieAdj) / 18 };
}

export interface TrendOptions {
  /**
   * Treat the input as already a rate (exceptions per day, a ratio) and skip
   * differencing. Leave false for anything cumulative.
   */
  isRate?: boolean;
  /** Below this p-value a direction is claimed; above it the answer is flat. */
  alpha?: number;
  /** Fewer usable points than this and we refuse to answer. */
  minPoints?: number;
}

/**
 * Is this series rising, falling, or going nowhere?
 *
 * Returns `flat` for "no statistically detectable direction", which is a
 * different statement from "slope is zero" and the one that matters: a metric
 * wandering with no trend is exactly the thing a cumulative chart hides.
 */
export function trend(points: Point[], opts: TrendOptions = {}): Trend {
  const { isRate = false, alpha = 0.05, minPoints = 8 } = opts;
  const raw = points.map((p) => p.v).filter((v) => Number.isFinite(v));
  const values = isRate ? raw : diff(raw);
  const n = values.length;

  if (n < minPoints) {
    return {
      direction: "flat",
      slope: 0,
      tau: 0,
      p: 1,
      n,
      insufficient: `needs ${minPoints} points, has ${n}`,
    };
  }

  const { s, varS } = mannKendall(values);
  // Every value identical: no variance, no trend, and dividing by zero here
  // would hand the UI a NaN it would happily render.
  if (varS <= 0) return { direction: "flat", slope: 0, tau: 0, p: 1, n };

  const z = s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const tau = s / ((n * (n - 1)) / 2);
  const slope = theilSen(values);

  const direction: TrendDirection =
    p >= alpha || s === 0 ? "flat" : s > 0 ? "rising" : "falling";

  return { direction, slope, tau, p, n };
}

export interface Correlation {
  r: number;
  /** Two-sided p-value for r under the usual t-transform. */
  p: number;
  /** Overlapping buckets used. */
  n: number;
  insufficient?: string;
}

/** Pearson r over the values given, with no differencing of its own. */
function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma,
      y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/**
 * Correlation between two series, on their DAILY CHANGES.
 *
 * Aligned by timestamp rather than by index — two series can have different
 * coverage (npm downloads start later than dev.to followers), and zipping them
 * positionally would silently compare July to March.
 */
export function correlate(
  a: Point[],
  b: Point[],
  opts: { isRate?: boolean; minPoints?: number } = {},
): Correlation {
  const { isRate = false, minPoints = 10 } = opts;
  const mb = new Map(b.map((p) => [p.t, p.v]));
  const ts: string[] = [];
  const av: number[] = [];
  const bv: number[] = [];
  for (const p of a) {
    const other = mb.get(p.t);
    if (other === undefined) continue;
    if (!Number.isFinite(p.v) || !Number.isFinite(other)) continue;
    ts.push(p.t);
    av.push(p.v);
    bv.push(other);
  }

  const x = isRate ? av : diff(av);
  const y = isRate ? bv : diff(bv);
  const n = Math.min(x.length, y.length);
  if (n < minPoints)
    return { r: 0, p: 1, n, insufficient: `needs ${minPoints} overlapping points, has ${n}` };

  const r = pearson(x.slice(0, n), y.slice(0, n));
  // t = r*sqrt((n-2)/(1-r²)); |r| = 1 would divide by zero.
  const denom = 1 - r * r;
  const p =
    denom <= 0
      ? 0
      : 2 * (1 - normalCdf(Math.abs(r * Math.sqrt((n - 2) / denom))));
  return { r, p, n };
}

export interface Divergence {
  diverging: boolean;
  /** What the pair did over the long window. */
  baseline: number;
  recentA: TrendDirection;
  recentB: TrendDirection;
  note: string;
}

/**
 * Two series that normally move together, and lately do not.
 *
 * This is the signal worth surfacing: "downloads and stars have tracked each
 * other all year, and for the last three weeks downloads are rising while
 * stars are flat." A plain correlation number cannot say that, because the
 * long window drowns the recent weeks.
 *
 * Requires a positive baseline relationship before claiming divergence — two
 * unrelated series pointing different ways is not a signal, it is a coincidence.
 */
export function divergence(
  a: Point[],
  b: Point[],
  opts: { recent?: number; baselineMin?: number } = {},
): Divergence {
  const { recent = 21, baselineMin = 0.3 } = opts;

  // The baseline is measured on the data BEFORE the recent window, not on the
  // whole series. Measuring it on everything is self-defeating: a genuine
  // divergence drags the overall correlation down, so the check that requires a
  // baseline would reject exactly the cases it exists to find. On a 60-day
  // series with a 21-day stall, whole-window r came out at 0.09 and the signal
  // was silently discarded.
  const priorA = a.slice(0, Math.max(0, a.length - recent));
  const priorB = b.slice(0, Math.max(0, b.length - recent));
  const base = correlate(priorA, priorB);
  const ra = trend(a.slice(-recent));
  const rb = trend(b.slice(-recent));

  const opposed =
    (ra.direction === "rising" && rb.direction !== "rising") ||
    (ra.direction === "falling" && rb.direction !== "falling") ||
    (rb.direction === "rising" && ra.direction !== "rising") ||
    (rb.direction === "falling" && ra.direction !== "falling");

  const diverging = base.r >= baselineMin && !base.insufficient && opposed;
  return {
    diverging,
    baseline: base.r,
    recentA: ra.direction,
    recentB: rb.direction,
    note: diverging
      ? `tracked together (r=${base.r.toFixed(2)}), last ${recent}d: ${ra.direction} vs ${rb.direction}`
      : base.insufficient
        ? base.insufficient
        : base.r < baselineMin
          ? `no baseline relationship (r=${base.r.toFixed(2)})`
          : "moving together",
  };
}
