/** npx tsx src/lib/ties.selfcheck.ts — folding, direction, dates, states, orderings, follower split. */
import assert from "node:assert/strict";
import {
  fold,
  followerSplit,
  goingCold,
  owed,
  state,
  type CommentRow,
} from "./ties";

const NOW = Date.parse("2026-09-04T12:00:00Z");
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const rows: CommentRow[] = [
  {
    author: "ann",
    article_author: "ofri-peretz",
    direction: "in",
    created_at: ago(60),
  },
  {
    author: "ofri-peretz",
    article_author: "ann",
    direction: "out",
    created_at: ago(50),
  }, // mutual, cold
  {
    author: "bob",
    article_author: "ofri-peretz",
    direction: "in",
    created_at: ago(3),
  },
  {
    author: "ofri-peretz",
    article_author: "bob",
    direction: "out",
    created_at: ago(2),
  }, // mutual, warm
  {
    author: "cat",
    article_author: "ofri-peretz",
    direction: "in",
    created_at: ago(20),
    comment_id: "c1",
    body_excerpt: "Great piece",
    article_id: 7,
  }, // owed, cooling
  {
    author: "dan",
    article_author: "ofri-peretz",
    direction: "in",
    created_at: ago(1),
  }, // owed, warm
  {
    author: "ofri-peretz",
    article_author: "eve",
    direction: "out",
    created_at: ago(5),
  }, // we went first
  {
    author: "ofri-peretz",
    article_author: null,
    direction: "out",
    created_at: ago(5),
  }, // no counterpart: dropped
];
const ties = fold(rows, NOW);
assert.deepEqual(ties.map((t) => t.who).sort(), [
  "ann",
  "bob",
  "cat",
  "dan",
  "eve",
]);
const ann = ties.find((t) => t.who === "ann")!;
assert.deepEqual(
  [ann.in, ann.out, ann.days, ann.mutual, ann.state],
  [1, 1, 50, true, "cold"],
);
assert.equal(ties.find((t) => t.who === "bob")!.state, "warm");
assert.equal(state(14), "warm");
assert.equal(state(15), "cooling");
assert.equal(state(45), "cooling");
assert.equal(state(46), "cold");
assert.deepEqual(
  goingCold(ties).map((t) => t.who),
  ["ann", "bob"],
);
assert.deepEqual(
  owed(ties).map((t) => t.who),
  ["dan", "cat"],
);
// We went first and nobody answered: in the ledger, in neither list.
const eve = ties.find((t) => t.who === "eve")!;
assert.deepEqual([eve.in, eve.out, eve.mutual], [0, 1, false]);
assert.ok(
  !goingCold(ties).some((t) => t.who === "eve") &&
    !owed(ties).some((t) => t.who === "eve"),
);
assert.deepEqual(
  followerSplit([
    { onboarding: false },
    { onboarding: true },
    { onboarding: true },
    { onboarding: null },
  ]),
  { total: 4, prior: 1, sameDay: 2, unresolved: 1 },
);
// The latest inbound comment travels with the tie, so a reply in kind has something to answer.
assert.deepEqual(ties.find((t) => t.who === "cat")!.last, {
  commentId: "c1",
  excerpt: "Great piece",
  articleId: 7,
});
console.log("ties.selfcheck: ok");
