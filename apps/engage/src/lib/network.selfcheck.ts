/**
 * Runnable self-check for the two-hop expansion —
 * `npx tsx --conditions=react-server src/lib/network.selfcheck.ts`.
 *
 * One regression, guarded: `expandTwoHop` used to read `.filter((n) => !n.us)`.
 * That reads as an obvious economy — why crawl our own articles, we know them —
 * and it silently broke the graph's entire inbound half. Every edge points at
 * the OWNER of the article it was seen on, so never sampling our articles means
 * no edge can ever point at us. `in` was 0 and `mutual` empty for any corpus,
 * forever, while the UI ranked authors by "who talked back".
 *
 * It cost a live API comparison to find. It costs four assertions to keep out.
 */
import assert from "node:assert/strict";
import { expandTwoHop, ME, type Graph } from "./network";

const node = (id: string, degree: number, us = false) => ({
  id,
  out: 0,
  in: 0,
  degree,
  mutual: [] as string[],
  us,
});

const seed: Graph = {
  nodes: [
    node("hub-a", 99),
    node("hub-b", 50),
    node(ME, 1, true), // deliberately LOW degree — must survive the top-N cut
  ],
  edges: [],
  clusters: [],
  sampledArticles: 0,
  fetchedAt: "2026-08-11T00:00:00.000Z",
};

/** Fake dev.to: two articles each, ours carrying a zero-comment decoy. */
const fake = async (url: string) => {
  const who = decodeURIComponent(new URL(url).searchParams.get("username") ?? "");
  if (who === ME)
    return [
      { id: 900, comments_count: 4 },
      { id: 901, comments_count: 0 }, // must be skipped: a guaranteed-empty crawl
      { id: 902, comments_count: 2 },
    ];
  return [{ id: who === "hub-a" ? 1 : 2, comments_count: 7 }];
};

/* Wrapped: tsx transpiles this to CJS, which has no top-level await. */
void (async () => {
  // ── 1. we are always a target, even at the bottom of the degree ranking ──────
  {
    const extra = await expandTwoHop(seed, { topAuthors: 1 }, fake);
    const ours = extra.filter(([, owner]) => owner === ME);
    assert.ok(
      ours.length > 0,
      "our own articles must be sampled, or every inbound edge is unobservable",
    );
    // topAuthors: 1 keeps only hub-a among the others — and us regardless.
    const owners = new Set(extra.map(([, o]) => o));
    assert.ok(owners.has(ME) && owners.has("hub-a"), "both us and the top author");
    assert.ok(!owners.has("hub-b"), "topAuthors must still bound the OTHER authors");
  }

  // ── 2. our zero-comment articles are skipped ─────────────────────────────────
  {
    const extra = await expandTwoHop(seed, {}, fake);
    const ids = extra.filter(([, o]) => o === ME).map(([id]) => id);
    assert.deepEqual(ids.sort(), [900, 902], "an article with 0 comments is an empty crawl");
  }

  // ── 3. an article reachable twice is crawled once ────────────────────────────
  {
    // Both hubs return the SAME article id, which would otherwise double every
    // edge weight observed on it.
    const dupFake = async () => [{ id: 42, comments_count: 3 }];
    const extra = await expandTwoHop(seed, {}, dupFake);
    const ids = extra.map(([id]) => id);
    assert.equal(new Set(ids).size, ids.length, "sample must be deduped by article id");
  }

  // ── 4. one unreachable author does not void the expansion ────────────────────
  {
    const flaky = async (url: string) => {
      if (url.includes("hub-a")) throw new Error("503");
      return fake(url);
    };
    const extra = await expandTwoHop(seed, {}, flaky);
    assert.ok(
      extra.some(([, o]) => o === ME),
      "a failing author must not take our own articles down with it",
    );
  }
  console.log("network.selfcheck: all assertions passed");
})();
