/**
 * Runnable self-check for detect.ts — `npx tsx src/lib/detect.selfcheck.ts`.
 *
 * The repo has no test runner in this app, so this is an assert-based script
 * rather than a suite. It exists because the two failure modes here are silent:
 * a cumulative series reported as "rising" forever, and two unrelated cumulative
 * series reported as r≈0.99. Both look like working features.
 */
import assert from "node:assert/strict";
import { trend, correlate, divergence, diff, type Point } from "./detect";

const day = (i: number): string =>
  new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const series = (vals: number[]): Point[] => vals.map((v, i) => ({ t: day(i), v }));

/** Cumulative series from a list of daily gains. */
const cumulative = (gains: number[]): Point[] => {
  let acc = 0;
  return series(gains.map((g) => (acc += g)));
};

// ── 1. The headline trap: a stalled cumulative metric must NOT read as rising ──
{
  // Grew fast, then flat-lined. The LEVEL still slopes up forever.
  const stalled = cumulative([...Array(30).fill(10), ...Array(30).fill(0)]);
  const t = trend(stalled);
  assert.notEqual(t.direction, "rising", "a stalled cumulative metric must not read as rising");

  // And the same data judged on the level would have said "rising" — this is
  // the assertion that proves differencing is what saves us, not luck.
  const naive = trend(stalled, { isRate: true });
  assert.equal(naive.direction, "rising", "sanity: the naive level-based read does say rising");
}

// ── 2. Genuine acceleration and deceleration are detected ─────────────────────
{
  const accelerating = cumulative(Array.from({ length: 40 }, (_, i) => 5 + i));
  assert.equal(trend(accelerating).direction, "rising");

  const decelerating = cumulative(Array.from({ length: 40 }, (_, i) => 50 - i));
  assert.equal(trend(decelerating).direction, "falling");
}

// ── 3. Noise is not a trend ───────────────────────────────────────────────────
{
  // Deterministic alternation: no direction, and the tie correction must keep
  // p high rather than calling the zig-zag a trend.
  const noisy = cumulative(Array.from({ length: 40 }, (_, i) => (i % 2 ? 12 : 8)));
  assert.equal(trend(noisy).direction, "flat");
}

// ── 4. One spike does not manufacture a trend (why Theil-Sen, not OLS) ────────
{
  const flatWithSpike = cumulative([...Array(20).fill(10), 900, ...Array(19).fill(10)]);
  assert.equal(trend(flatWithSpike).direction, "flat", "a single spike must not create a trend");
}

// ── 5. Too little data answers "cannot tell", not "flat" ──────────────────────
{
  const t = trend(cumulative([1, 2, 3]));
  assert.ok(t.insufficient, "short series must report insufficiency");
}

// ── 6. The correlation trap: unrelated cumulative series must NOT be ~1 ───────
{
  // Two independent-ish gain patterns, both cumulative and both monotonic.
  const a = cumulative(Array.from({ length: 60 }, (_, i) => (i % 7 === 0 ? 30 : 3)));
  const b = cumulative(Array.from({ length: 60 }, (_, i) => (i % 5 === 0 ? 25 : 4)));

  const honest = correlate(a, b);
  assert.ok(Math.abs(honest.r) < 0.5, `differenced r should be modest, got ${honest.r}`);

  // The naive level-based version is the bug we are avoiding; assert it really
  // does produce the near-perfect correlation, so this test fails loudly if
  // someone "simplifies" correlate() back to operating on levels.
  const naive = correlate(a, b, { isRate: true });
  assert.ok(naive.r > 0.95, `sanity: level correlation is spurious-high, got ${naive.r}`);
}

// ── 7. A real relationship still shows up ─────────────────────────────────────
{
  const gains = Array.from({ length: 60 }, (_, i) => 5 + (i % 9) * 3);
  const a = cumulative(gains);
  const b = cumulative(gains.map((g) => g * 2 + 1));
  assert.ok(correlate(a, b).r > 0.95, "a genuine linear relationship must survive differencing");
}

// ── 8. Alignment is by timestamp, not by index ────────────────────────────────
{
  const gains = Array.from({ length: 40 }, (_, i) => 5 + (i % 6));
  const a = cumulative(gains);
  const b = cumulative(gains).slice(10); // starts later, as npm data does
  const c = correlate(a, b);
  assert.equal(c.n, b.length - 1, "only the overlapping window is compared");
  assert.ok(c.r > 0.95, "the same data offset in time must still correlate");
}

// ── 9. Divergence needs a baseline relationship, not just opposite directions ─
{
  // A shared, genuinely correlated history for the first 39 days...
  const shared = Array.from({ length: 39 }, (_, i) => 8 + ((i * 7) % 11));
  // ...then A accelerates while B flat-lines. That is the shape worth alerting on.
  const together = cumulative([...shared, ...Array.from({ length: 21 }, (_, i) => 10 + i)]);
  const stalls = cumulative([...shared, ...Array(21).fill(0)]);

  const d = divergence(together, stalls);
  assert.equal(d.diverging, true, `expected divergence, got: ${d.note}`);
  assert.equal(d.recentA, "rising");
  assert.equal(d.recentB, "flat");

  // Regression lock for the baseline window: measured over the WHOLE series the
  // stall destroys the correlation and this signal disappears. The baseline has
  // to come from the period before the divergence.
  assert.ok(
    correlate(together, stalls).r < 0.3,
    "sanity: whole-window r is dragged down by the divergence itself",
  );

  // Two unrelated series pointing different ways is a coincidence, not a signal.
  const unrelated = cumulative(Array.from({ length: 60 }, (_, i) => (i % 11 === 0 ? 40 : 1)));
  assert.equal(divergence(unrelated, stalls).diverging, false);
}

// ── 10. A RATIO side must not be differenced twice ────────────────────────────
{
  // A ratio that is genuinely climbing, paired with one that is flat. Both are
  // already rates. Differencing them again yields a second derivative that
  // trends flat regardless, so without per-side isRate flags this pair could
  // never report a divergence.
  const shared = Array.from({ length: 39 }, (_, i) => 0.05 + ((i * 3) % 7) / 1000);
  const climbing = series([...shared, ...Array.from({ length: 21 }, (_, i) => 0.06 + i / 500)]);
  const flatRatio = series([...shared, ...Array(21).fill(0.055)]);

  const withFlags = divergence(climbing, flatRatio, { isRateA: true, isRateB: true });
  assert.equal(withFlags.recentA, "rising", "a rising ratio must read as rising when isRate is set");
  assert.equal(withFlags.diverging, true, `expected divergence, got: ${withFlags.note}`);

  // And without the flags it is silently missed — the assertion that keeps the
  // per-side options from being "simplified" away.
  const without = divergence(climbing, flatRatio);
  assert.notEqual(without.recentA, "rising", "sanity: double-differencing hides the rise");
}

// ── 11. diff() is the plain first difference ──────────────────────────────────
assert.deepEqual(diff([1, 3, 6, 10]), [2, 3, 4]);

console.log("detect.ts self-check: all assertions passed");
