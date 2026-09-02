/**
 * Runnable self-check for series.ts — `npm run selfcheck` (or
 * `npx tsx --conditions=react-server src/lib/series.selfcheck.ts`).
 *
 * The condition flag is not optional: series.ts imports `server-only`, whose
 * default entry throws by design. `react-server` is the condition that resolves
 * it to the empty module, which is exactly the environment the real caller runs
 * in. detect.selfcheck.ts needs no flag only because detect.ts imports nothing.
 *
 * Same reasoning as detect.selfcheck.ts: no test runner in this app, and the
 * failure modes here render perfectly rather than throwing. A gauge summed into
 * a weekly bucket reports ~7x the real latency; a stalled series that inherits
 * a neighbour's freshness reports `stale: false` forever. Both look like
 * working features on screen.
 */
import assert from "node:assert/strict";
import { bucket, rebase100, toDelta, ratio, type Point } from "./series";

const day = (i: number): string =>
  new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10); // 2026-01-05 = Monday
const series = (vals: number[]): Point[] => vals.map((v, i) => ({ t: day(i), v }));

// ── 1. The headline trap: a gauge must be averaged, never summed ──────────────
{
  // Seven days of a p75 LCP that never moved. The weekly roll-up is 2000ms —
  // the same latency — not 14000ms.
  const lcp = series(Array(7).fill(2000));

  const asGauge = bucket(lcp, "week", "gauge");
  assert.equal(asGauge.length, 1, "seven days is one ISO week");
  assert.equal(asGauge[0].v, 2000, "a flat p75 gauge must roll up to the same value");

  // And the bug this guards against, stated as an assertion: summing would have
  // reported a 7x latency regression out of thin air.
  const asRate = bucket(lcp, "week", "rate");
  assert.equal(asRate[0].v, 14000);
  assert.notEqual(
    asGauge[0].v,
    asRate[0].v,
    "gauge and rate must not aggregate the same way, or the kind is decorative",
  );
}

// ── 2. cumulative takes the last value, not the sum ───────────────────────────
{
  const followers = bucket(series([10, 11, 12, 13, 14, 15, 16]), "week", "cumulative");
  assert.equal(followers[0].v, 16, "a cumulative total rolls up to its closing value");
}

// ── 3. rate sums — seven daily exception counts are a weekly count ────────────
{
  const exceptions = bucket(series([1, 0, 2, 0, 0, 3, 1]), "week", "rate");
  assert.equal(exceptions[0].v, 7);
}

// ── 4. day grain is a pass-through for every kind ─────────────────────────────
{
  const pts = series([1, 2, 3]);
  for (const k of ["cumulative", "rate", "gauge"] as const)
    assert.deepEqual(bucket(pts, "day", k), pts, `day grain must not aggregate (${k})`);
}

// ── 5. ratio never yields Infinity, and drops unmatched days ──────────────────
{
  const a = series([10, 20, 30]);
  const b = [
    { t: day(0), v: 2 },
    { t: day(1), v: 0 }, // division by zero
    // day(2) missing entirely
  ];
  const r = ratio(a, b);
  assert.equal(r.length, 1, "a zero denominator and a missing day both yield no point");
  assert.equal(r[0].v, 5);
  assert.ok(r.every((p) => Number.isFinite(p.v)), "ratio must never emit Infinity");
}

// ── 6. rebase100 anchors to the first NON-ZERO point ──────────────────────────
{
  // Leading zeros are normal for a metric that started mid-window; anchoring to
  // a zero base would divide by zero and blank the whole series.
  const r = rebase100(series([0, 0, 50, 100]));
  assert.ok(r.every((p) => Number.isFinite(p.v)), "leading zeros must not produce Infinity");
  assert.equal(r[2].v, 100, "the first non-zero point is the 100 anchor");
  assert.equal(r[3].v, 200);
}

// ── 7. delta drops the first point rather than inventing a gain ───────────────
{
  const d = toDelta(series([10, 13, 13]));
  assert.equal(d.length, 2, "n points yield n-1 deltas");
  assert.equal(d[0].v, 3);
  assert.equal(d[1].v, 0, "a flat day is a zero delta, not a missing one");
}

console.log("series.selfcheck: all assertions passed");
