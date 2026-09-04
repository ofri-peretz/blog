/** Self-check for impact-score.ts — `npx tsx src/lib/impact-score.selfcheck.ts`. */
import assert from "node:assert/strict";
import { CATALOG, PILLARS, scoreMetric, scoreImpact } from "./impact-score";

const by = (id: string) => CATALOG.find((m) => m.id === id)!;

// ── 1. Linear, floored, capped, and direction-aware ──────────────────────────
assert.equal(scoreMetric(by("views_per_day_7d"), 20), 0, "the floor scores nothing");
assert.equal(scoreMetric(by("views_per_day_7d"), 110), 0.5, "half way is half");
assert.equal(scoreMetric(by("views_per_day_7d"), 1000), 1, "beyond the target caps at 1");
assert.equal(scoreMetric(by("views_per_day_7d"), 3), 0, "below the floor never goes negative");
assert.equal(scoreMetric(by("reply_latency_h"), 24), 1, "down: the target is the good end");
assert.equal(scoreMetric(by("reply_latency_h"), 168), 0);
assert.equal(scoreMetric(by("reply_latency_h"), 96), 0.5);
assert.equal(scoreMetric(by("mutual_ties"), null), 0, "unmeasured is zero, never a guess");

// ── 2. Pillars are 20 each, the score sums them, and every catalog entry belongs to one ──
{
  const ids = new Set(PILLARS.map((p) => p.id));
  for (const m of CATALOG) assert.ok(ids.has(m.pillar), `${m.id} names an unknown pillar`);
  const none = scoreImpact({});
  assert.equal(none.score, 0);
  assert.equal(none.measured, 0);
  assert.equal(none.total, CATALOG.length);
  const all: Record<string, number> = {};
  for (const m of CATALOG) all[m.id] = m.direction === "up" ? m.target : m.target; // target hits 1 either way
  const full = scoreImpact(all);
  assert.equal(full.score, 100, "every metric at target is exactly 100");
  assert.ok(full.pillars.every((p) => p.points === 20));
}

// ── 3. One input moves exactly one pillar ───────────────────────────────────
{
  const base = scoreImpact({ mutual_ties: 0 });
  const bumped = scoreImpact({ mutual_ties: 15 });
  const moved = bumped.pillars.filter((p, i) => p.points !== base.pillars[i].points).map((p) => p.id);
  assert.deepEqual(moved, ["standing"]);
  assert.equal(bumped.pillars.find((p) => p.id === "standing")!.points, 5, "one of four standing metrics at target = 5 of 20");
}
console.log("impact-score.selfcheck: ok");
