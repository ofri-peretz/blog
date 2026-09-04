/** Self-check for league.ts — `npx tsx src/lib/league.selfcheck.ts`. */
import assert from "node:assert/strict";
import {
  aggregate,
  arenaSummary,
  mergeLeague,
  forecast,
  FORECAST_MIN_DAYS,
} from "./league";
const a = (u: string, rx: number, cm = 0) => ({
  user: { username: u },
  public_reactions_count: rx,
  comments_count: cm,
});
const t = aggregate(
  "security",
  [a("x", 50), a("x", 40), a("y", 60), a("me", 11, 4), a("z", 5)],
  "me",
);
assert.equal(t.authors, 4);
assert.equal(t.rank, 3, "x has 90, y 60, me 11, z 5");
assert.equal(t.percentile, 1 / 3, "we out-rank one of three others");
assert.deepEqual(
  t.above.map((l) => l.author),
  ["x", "y"],
);
const absent = aggregate("ai", [a("p", 1)], "me");
assert.equal(absent.rank, null);
assert.equal(absent.percentile, 0, "absent is zero, not unknown");
assert.deepEqual(arenaSummary([t, absent]), { percentile: 0.167, present: 1 });
console.log("league.selfcheck: ok");

// ── The climb: thresholds come from the sorted list; the gap is to the next level's last place + 1 ──
{
  const A = (
    u: string,
    id: number,
    rx: number,
    cm = 0,
    tags: string[] = [],
  ) => ({
    id,
    user: { username: u },
    public_reactions_count: rx,
    comments_count: cm,
    tag_list: tags,
  });
  const sample = [
    A("a", 1, 100),
    A("b", 2, 90),
    A("c", 3, 80),
    A("d", 4, 70),
    A("e", 5, 60),
    A("f", 6, 50),
    A("g", 7, 40),
    A("h", 8, 30),
    A("i", 9, 20),
    A("j", 10, 10),
    A("k", 11, 9),
    A("me", 12, 3),
    A("me", 13, 3),
  ];
  const c = mergeLeague([sample, [A("a", 1, 100)]], "me"); // duplicate article id must not double count
  assert.equal(c.articles, 13);
  assert.equal(c.authors, 12);
  assert.equal(c.rank, 12);
  assert.equal(c.ours!.reactions, 6);
  assert.equal(c.thresholds[5], 60);
  assert.equal(c.thresholds[10], 10);
  assert.equal(
    c.thresholds[20],
    null,
    "a level beyond the sample is null, not 0",
  );
  assert.equal(c.level, 20, "rank 12 is inside the top 20");
  assert.deepEqual(
    c.next,
    { level: 10, reactionsNeeded: 5 },
    "the top-10 line is 10; we have 6; 11 − 6 = 5",
  );
  assert.deepEqual(
    c.nextUp.map((l) => l.author),
    ["g", "h", "i", "j", "k"],
  );
  assert.equal(c.plan.ourRxPerArticle, 3);
  assert.equal(
    c.plan.articlesAtOurRate,
    2,
    "5 more reactions at 3 per article = 2 articles",
  );
}
// Absent from a small sample: the next level is the widest one the sample has a bar for, never a level with no bar.
{
  const A = (u: string, id: number, rx: number) => ({
    id,
    user: { username: u },
    public_reactions_count: rx,
    comments_count: 0,
    tag_list: [],
  });
  const absent = mergeLeague(
    [
      [
        A("a", 1, 100),
        A("b", 2, 90),
        A("c", 3, 80),
        A("d", 4, 70),
        A("e", 5, 60),
        A("f", 6, 50),
      ],
    ],
    "me",
  );
  assert.equal(absent.rank, null);
  assert.equal(absent.level, null);
  assert.deepEqual(
    absent.next,
    { level: 5, reactionsNeeded: 61 },
    "six authors: top 5 is the widest level with a bar (60); 61 reactions enters it",
  );
  assert.equal(absent.thresholds[10], null);
  const tiny = mergeLeague([[A("a", 1, 100)]], "me");
  assert.equal(
    tiny.next,
    null,
    "one author: no level has a bar, so nothing is next",
  );
}
console.log("league.selfcheck: climb ok");

// Forecast: silent under seven rows, a date when climbing, none when flat.
const dayN = (i: number) =>
  new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
assert.equal(forecast([{ day: dayN(0), rank: 150 }], 100).etaNext, null);
assert.equal(
  forecast([{ day: dayN(0), rank: 150 }], 100).need,
  FORECAST_MIN_DAYS,
);
const climbing = forecast(
  Array.from({ length: 7 }, (_, i) => ({ day: dayN(i), rank: 150 - 2 * i })),
  100,
  Date.UTC(2026, 8, 7),
);
assert.equal(climbing.slopePerDay, -2);
assert.equal(climbing.daysToNext, 19);
assert.equal(climbing.etaNext, "2026-09-26");
assert.equal(
  forecast(
    Array.from({ length: 7 }, (_, i) => ({ day: dayN(i), rank: 150 })),
    100,
  ).daysToNext,
  null,
);
console.log("league.selfcheck: forecast ok");
