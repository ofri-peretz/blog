/**
 * Runnable self-check for footprint.ts — part of `npm run selfcheck`
 * (`npx tsx --conditions=react-server src/lib/footprint.selfcheck.ts`).
 *
 * Two things here rendered perfectly while being wrong:
 *
 *   - `todayCST()` returned tomorrow after 19:00 Chicago time, so an evening
 *     action was written under a date the generator was not reading.
 *   - a click was recorded as `posted`. Now it is `opened`, and only the
 *     reconciler (or an explicit human override) can say `posted`.
 *
 * Both were seen failing on the unfixed code before this file was committed.
 */
import assert from "node:assert/strict";
import { todayCST, nextStatus } from "./footprint";

// ── 1. Evening in Chicago is still today ─────────────────────────────────────
{
  // 2026-09-02 22:30 CDT is 2026-09-03T03:30Z. The old implementation said 09-03.
  assert.equal(todayCST(new Date("2026-09-03T03:30:00Z")), "2026-09-02");
  // And midday is unambiguous in every zone, so it must agree too.
  assert.equal(todayCST(new Date("2026-09-02T17:00:00Z")), "2026-09-02");
  // Winter (CST, UTC-6): 2026-01-15 23:30 CST is 01-16T05:30Z.
  assert.equal(todayCST(new Date("2026-01-16T05:30:00Z")), "2026-01-15");
}

// ── 2. A click is `opened`, not `posted` ─────────────────────────────────────
{
  assert.equal(nextStatus("open"), "opened", "a click proves the tab opened, nothing more");
  assert.equal(nextStatus("skip"), "skipped");
  assert.equal(nextStatus("posted"), "posted", "the explicit override is the only client path to posted");
}

console.log("footprint.selfcheck: ok");
