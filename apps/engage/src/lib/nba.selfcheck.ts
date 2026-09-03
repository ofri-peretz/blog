/** Self-check for nba.ts — `npx tsx src/lib/nba.selfcheck.ts`. */
import assert from "node:assert/strict";
import { rankActions } from "./nba";
import type { StandingGraph } from "./standing";

const graph: StandingGraph = {
  nodes: [
    { id: "sloan", in: 9, out: 0, degree: 900, mutual: [] },
    { id: "hub", in: 9, out: 0, degree: 200, mutual: [] },
    { id: "talker", in: 1, out: 3, degree: 5, mutual: [] },
    { id: "old", in: 0, out: 1, degree: 2, mutual: [] },
    { id: "me", in: 1, out: 1, degree: 2, mutual: [], us: true },
  ],
  edges: [
    { from: "talker", to: "me", weight: 1 },
    { from: "me", to: "old", weight: 1 },
  ],
};
const day = 86_400_000;
const now = Date.parse("2026-09-03T00:00:00Z");

// ── 1. A mutual-tie candidate outranks a random fresh pick and a core node ──
{
  const rows = rankActions(
    graph, "me",
    [{ index: 0, author: "talker", ageDays: 3, replyToUs: false }],
    [{ index: 0, author: "hub", kind: "comment" }, { index: 1, author: "fresh", kind: "comment" }, { index: 2, author: "old", kind: "comment" }],
    [], now,
  );
  assert.deepEqual(rows.map((r) => r.author), ["talker", "hub", "fresh", "old"]);
  assert.match(rows[0].why, /mutual tie/);
  assert.match(rows[1].why, /core node/);
}

// ── 2. Cooldown scores 0, staff never appear, reactions weigh half ──────────
{
  const rows = rankActions(
    graph, "me", [],
    [{ index: 0, author: "fresh", kind: "comment" }, { index: 1, author: "fresh2", kind: "reaction" }, { index: 2, author: "sloan", kind: "comment" }],
    [{ author: "fresh", at: now - 2 * day }], now,
  );
  assert.equal(rows.find((r) => r.author === "fresh")!.score, 0);
  assert.ok(!rows.some((r) => r.author === "sloan"));
  assert.equal(rows.find((r) => r.author === "fresh2")!.score, 0.5);
}

// ── 3. Age pays, capped; the same author twice is halved; order is stable ───
{
  const threads = [
    { index: 0, author: "a", ageDays: 100 },
    { index: 1, author: "a", ageDays: 1 },
    { index: 2, author: "b", ageDays: 14 },
  ];
  const r1 = rankActions(graph, "me", threads, [], [], now);
  const r2 = rankActions(graph, "me", threads, [], [], now);
  assert.deepEqual(r1, r2, "deterministic");
  assert.equal(r1[0].author, "a");
  assert.equal(r1[0].score, 1 + 2, "new author + 4 capped weeks × 0.5");
  assert.equal(r1.find((r) => r.index === 1)!.score, 0.5, "second row for the same author is halved");
}

console.log("nba.selfcheck: ok");
