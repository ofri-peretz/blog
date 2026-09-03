/**
 * Self-check for standing.ts — `npx tsx src/lib/standing.selfcheck.ts`.
 *
 * A fixture graph with one staff node at the top, and the assertions the
 * intent's "How we will know it worked" table depends on. Removing one edge
 * must move exactly the metrics that edge carried and nothing else.
 */
import assert from "node:assert/strict";
import { computeStanding, sampleHash, type StandingGraph } from "./standing";

const g = (): StandingGraph => ({
  sampledIds: [3, 1, 2],
  sampledArticles: 3,
  nodes: [
    { id: "sloan", in: 500, out: 10, degree: 400, mutual: [] }, // staff: excluded from rank
    { id: "big", in: 300, out: 20, degree: 120, mutual: ["me"] },
    { id: "mid", in: 40, out: 5, degree: 30, mutual: [] },
    { id: "me", in: 3, out: 6, degree: 9, mutual: ["big"], us: true },
    { id: "small", in: 1, out: 1, degree: 2, mutual: [] },
  ],
  edges: [
    { from: "big", to: "me", weight: 2 },
    { from: "me", to: "big", weight: 1 },
    { from: "mid", to: "me", weight: 1 },
    { from: "me", to: "small", weight: 1 },
  ],
});

// ── 1. The headline numbers ──────────────────────────────────────────────────
{
  const r = computeStanding(g(), "me", [], 2);
  assert.equal(r.degree, 9);
  assert.equal(r.in_authors, 2, "big and mid have edges into us; small does not");
  assert.equal(r.mutual, 1);
  assert.equal(r.core_reach, 1, "big is in the top-2 non-staff core and is mutual");
  assert.equal(r.rank_nonstaff, 3, "big, mid, me — staff is not in the ranking");
  assert.equal(r.rank_pct, 33, "we out-rank 1 of 3 other non-staff nodes");
  assert.equal(r.sample_size, 3);
  assert.equal(r.sample_hash, sampleHash([1, 2, 3]), "hash is order-independent");
}

// ── 2. One edge removed moves only what it carried ───────────────────────────
{
  const graph = g();
  graph.edges = graph.edges.filter((e) => !(e.from === "mid" && e.to === "me"));
  const r = computeStanding(graph, "me", [], 2);
  assert.equal(r.in_authors, 1);
  assert.equal(r.mutual, 1, "mutual comes from the node, untouched");
  assert.equal(r.rank_nonstaff, 3, "degree on the node is untouched, so rank is");
}

// ── 3. Replies: waiting is unanswered, latency is a median over answered ──────
{
  const threads = [
    { at: "2026-09-01T00:00:00Z", answeredAt: "2026-09-01T10:00:00Z" }, // 10 h
    { at: "2026-09-01T00:00:00Z", answeredAt: "2026-09-02T00:00:00Z" }, // 24 h
    { at: "2026-09-01T00:00:00Z", answeredAt: "2026-09-03T00:00:00Z" }, // 48 h
    { at: "2026-09-02T00:00:00Z" },
    { at: "2026-09-02T00:00:00Z" },
  ];
  const r = computeStanding(g(), "me", threads, 2);
  assert.equal(r.replies_waiting, 2);
  assert.equal(r.reply_latency_h, 24, "median, not mean — 48 h must not drag it to 27");
  assert.equal(computeStanding(g(), "me", [], 2).reply_latency_h, null, "nothing answered is null, not 0");
}

// ── 4. Absent from the graph is null rank, not rank 0 ────────────────────────
{
  const r = computeStanding(g(), "nobody", [], 2);
  assert.equal(r.rank_nonstaff, null);
  assert.equal(r.degree, 0);
}

console.log("standing.selfcheck: ok");
