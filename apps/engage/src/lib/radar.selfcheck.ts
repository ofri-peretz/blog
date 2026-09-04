/** npx tsx src/lib/radar.selfcheck.ts — velocity floor, relevance hits, ranking, own posts, age cut. */
import assert from "node:assert/strict";
import { ageHours, rank, relevance, velocity, type RadarIn } from "./radar";

const NOW = Date.parse("2026-09-04T12:00:00Z");
const at = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const post = (
  id: number,
  h: number,
  rx: number,
  title: string,
  tag_list: string[] = [],
  username = "someone",
): RadarIn => ({
  id,
  title,
  url: `https://dev.to/${username}/${id}`,
  published_at: at(h),
  positive_reactions_count: rx,
  comments_count: 0,
  tag_list,
  user: { username },
});

// Five minutes old with two reactions is 2/h, not 24/h.
assert.equal(velocity(post(1, 5 / 60, 2, "x"), NOW), 2);
assert.equal(velocity(post(2, 4, 12, "x"), NOW), 3);
assert.equal(Math.round(ageHours(post(3, 6, 0, "x"), NOW)), 6);

const r = relevance(
  post(4, 1, 0, "ESLint found an injection in my Node app", [
    "security",
    "javascript",
  ]),
);
// "lint" is inside "eslint": one hit. Order is the keyword list, then the home tags.
assert.deepEqual(r.hits, [
  "eslint",
  "security",
  "injection",
  "node",
  "#security",
  "#javascript",
]);
assert.equal(r.relevance, 6);
assert.equal(
  relevance(post(5, 1, 0, "My weekend in Lisbon", ["travel"])).relevance,
  0,
);

const rows = rank(
  [
    post(10, 2, 10, "Kong gateway on GKE", ["cloud"]), // v 5, relevance 0 → 5
    post(11, 4, 8, "ESLint security rules for Node", ["security"]), // v 2, relevance 4 → 10
    post(12, 30, 100, "Old and huge", ["security"]), // too old
    post(13, 1, 50, "Mine", ["security"], "ofri-peretz"), // own
    post(11, 4, 8, "ESLint security rules for Node", ["security"]), // duplicate id
  ],
  new Set([10]),
  NOW,
);
assert.deepEqual(
  rows.map((x) => x.id),
  [11, 10],
);
assert.equal(rows[0].score, 10);
assert.equal(rows[1].commented, true);
assert.equal(rows[0].commented, false);
// A malformed date is infinitely old: dropped by the age cut, never NaN in a cell.
assert.equal(
  ageHours({ ...post(99, 0, 0, "x"), published_at: "bad-date" }, NOW),
  Infinity,
);
assert.equal(
  rank(
    [{ ...post(98, 0, 9, "ESLint", ["security"]), published_at: "" }],
    new Set(),
    NOW,
  ).length,
  0,
);
// Dependency injection is a NestJS topic, not an attack: no "injection" hit.
assert.deepEqual(
  relevance(post(6, 1, 0, "NestJS Dependency Injection Explained", ["node"]))
    .hits,
  ["node", "nestjs", "#node"],
);
console.log("radar.selfcheck: ok");
