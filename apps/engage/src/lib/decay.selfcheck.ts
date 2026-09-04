/** npx tsx src/lib/decay.selfcheck.ts — shares, rate, classes, the two-day start rule, summary. */
import assert from "node:assert/strict";
import { decay, summarize, type Snap } from "./decay";

const NOW = Date.parse("2026-09-04T12:00:00Z");
const day = (d: number) =>
  new Date(Date.parse("2026-07-01") + d * 86_400_000)
    .toISOString()
    .slice(0, 10);
const series = (
  slug: string,
  views: (d: number) => number,
  from = 0,
  days = 60,
): Snap[] =>
  Array.from({ length: days - from }, (_, i) => ({
    external_id: slug,
    observed_on: day(from + i),
    views: views(from + i),
  }));

// Feed: 81 of 100 views by day three, a trickle to day fourteen, nothing after.
const feed = decay(
  { slug: "f", title: "Feed", published_at: "2026-07-01" },
  series("f", (d) => (d < 3 ? d * 27 : d < 14 ? 81 + (d - 3) : 100)),
  NOW,
);
assert.equal(feed.kind, "feed");
assert.equal(feed.early, 0.81);
assert.equal(feed.tail, 0);
assert.equal(feed.rate, 0);
// Search: five views a day, forever.
const search = decay(
  { slug: "s", title: "Search", published_at: "2026-07-01" },
  series("s", (d) => 5 * d),
  NOW,
);
assert.equal(search.kind, "search");
assert.equal(search.early, 0.05);
assert.ok(search.tail! > 0.7);
assert.equal(search.rate, 5);
// Mixed: 60% in three days, a trickle to day fourteen, one a day after: neither threshold.
const mixed = decay(
  { slug: "m", title: "Mixed", published_at: "2026-07-01" },
  series(
    "m",
    (d) => Math.min(d, 3) * 40 + Math.min(d, 14) * 4 + Math.max(0, d - 14),
  ),
  NOW,
);
assert.equal(mixed.kind, "mixed");
assert.equal(mixed.early, 0.6);
assert.equal(mixed.rate, 1);
// A first snapshot three days late is not a start.
const late = decay(
  { slug: "l", title: "Late", published_at: "2026-07-01" },
  series("l", (d) => 5 * d, 3),
  NOW,
);
assert.equal(late.kind, "no window");
assert.equal(late.early, null);
// Twenty days old: too young to class, but the early share and the rate are known.
const young = decay(
  { slug: "y", title: "Young", published_at: day(45) },
  series("y", (d) => 5 * (d - 45), 45, 60),
  Date.parse(day(65)),
);
assert.equal(young.kind, "too young");
assert.equal(young.early, 0.21);
const sum = summarize([feed, search, mixed, late, young]);
assert.deepEqual(
  [sum.feed, sum.search, sum.mixed, sum.tooYoung, sum.noWindow],
  [1, 1, 1, 1, 1],
);
assert.equal(sum.evergreen[0].slug, "s");
console.log("decay.selfcheck: ok");
