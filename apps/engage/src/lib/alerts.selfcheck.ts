/**
 * Runnable self-check for the alert rules —
 * `npx tsx --conditions=react-server src/lib/alerts.selfcheck.ts`.
 *
 * These assertions are almost entirely about the FALSE ALARM direction. A stall
 * alert that fires on a quiet weekend gets muted within a week, and a muted
 * alert is strictly worse than no alert: it turns an unmonitored failure into
 * one you believe is monitored. So the quiet-but-alive cases are asserted just
 * as hard as the genuinely-dead ones.
 */
import assert from "node:assert/strict";
import { _internals } from "./alerts";

const { trailingZeros, baseline } = _internals;
const pts = (vals: number[]) =>
  vals.map((v, i) => ({ t: `2026-06-${String(i + 1).padStart(2, "0")}`, v }));

// ── trailingZeros counts only the tail, never zeros in the middle ────────────
{
  assert.equal(trailingZeros(pts([5, 0, 0, 4, 0, 0, 0])), 3);
  assert.equal(trailingZeros(pts([5, 0, 0, 4])), 0, "a mid-series gap is not a stop");
  assert.equal(trailingZeros(pts([0, 0, 0])), 3);
  assert.equal(trailingZeros([]), 0);
}

// ── baseline describes what the series did BEFORE it went quiet ──────────────
{
  // 14 days at 10/day, then 3 zeros. The baseline must ignore the zeros —
  // including them drags it toward 0 and the alert never reaches its threshold.
  const p = pts([...Array(14).fill(10), 0, 0, 0]);
  const zeros = trailingZeros(p);
  assert.equal(zeros, 3);
  assert.equal(baseline(p, zeros), 10, "baseline must exclude the trailing zeros");
}

// ── the false-alarm cases, stated as assertions ──────────────────────────────
{
  // A property that has ALWAYS been near zero has nothing to lose. ds_storybook
  // saw 27 events in 90 days; a rule without the baseline guard fires on it
  // every single day.
  const quiet = pts([0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const z = trailingZeros(quiet);
  const before = baseline(quiet, z);
  assert.ok(z >= 3, "this fixture does have a zero tail");
  assert.ok(
    before === null || before < 1,
    "a never-busy series must fail the baseline guard, so the alert does not fire",
  );

  // A weekend is two days, which is why the threshold is three.
  const weekend = pts([...Array(14).fill(8), 0, 0]);
  assert.equal(trailingZeros(weekend), 2, "a two-day lull must stay under the threshold");
}

// ── the real case: busy, then stopped ────────────────────────────────────────
{
  // The shape of the blog on 2026-08-02: healthy traffic, then nothing.
  const stopped = pts([...Array(14).fill(120), 0, 0, 0, 0, 0]);
  const z = trailingZeros(stopped);
  const before = baseline(stopped, z);
  assert.ok(z >= 3 && before !== null && before >= 1, "a stopped feed must fire");
  assert.equal(before, 120);
}

console.log("alerts.selfcheck: all assertions passed");
