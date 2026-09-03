/** Self-check for yield.ts — `npx tsx src/lib/yield.selfcheck.ts`. */
import assert from "node:assert/strict";
import { yieldOf, summarize, pearson } from "./yield";

const ME = "ofri-peretz";
const art = { id: 1, title: "t", url: "u", published_at: "2026-08-01T10:00:00Z" };
const c = (username: string, created_at: string, children: any[] = []) => ({ user: { username }, created_at, children });

// ── 1. Window edge is inclusive at 14 days, exclusive after; our own replies never count ──
{
  const tree = [
    c("a", "2026-08-01T10:00:01Z", [c(ME, "2026-08-01T11:00:00Z", [c("a", "2026-08-02T00:00:00Z")])]),
    c("b", "2026-08-15T10:00:00Z"), // exactly +14d → in
    c("d", "2026-08-15T10:00:01Z"), // one second past → out
    c("e", "2026-07-31T00:00:00Z"), // before publish (imported comment) → out of window, counts toward total
  ];
  const r = yieldOf(art, tree, ME, Date.parse("2026-09-01T00:00:00Z"));
  assert.equal(r.comments14d, 3, "a, a's reply-to-us, b");
  assert.equal(r.commentsTotal, 5, "everyone but us, lifetime");
  assert.equal(r.windowClosed, true);
  assert.equal(yieldOf(art, tree, ME, Date.parse("2026-08-05T00:00:00Z")).windowClosed, false, "young article: no verdict yet");
}

// ── 2. Summary uses only closed windows in the trailing 30 days ──
{
  const now = Date.parse("2026-09-03T00:00:00Z");
  const rows = [
    { ...yieldOf({ ...art, id: 1, published_at: "2026-08-05T00:00:00Z" }, [c("x", "2026-08-06T00:00:00Z")], ME, now) },
    { ...yieldOf({ ...art, id: 2, published_at: "2026-08-10T00:00:00Z" }, [], ME, now) },
    { ...yieldOf({ ...art, id: 3, published_at: "2026-09-01T00:00:00Z" }, [c("x", "2026-09-02T00:00:00Z")], ME, now) }, // window open
    { ...yieldOf({ ...art, id: 4, published_at: "2026-06-01T00:00:00Z" }, [c("x", "2026-06-02T00:00:00Z")], ME, now) }, // too old
  ];
  const s = summarize(rows, now);
  assert.equal(s.articles30d, 2, "ids 1 and 2: recent and closed");
  assert.equal(s.mean14d30d, 0.5);
  assert.equal(s.withAny30d, 1);
  assert.equal(s.articlesTotal, 4);
  assert.equal(summarize([], now).mean14d30d, null, "no articles is null, not 0");
}

// ── 3. Pearson refuses to speak below the floor, and is right above it ──
{
  assert.equal(pearson([[1, 1], [2, 2]]).r, null);
  const pairs: [number, number][] = Array.from({ length: 20 }, (_, i) => [i, 2 * i + 1]);
  assert.equal(pearson(pairs).r, 1);
  assert.equal(pearson(pairs.map(([x]) => [x, 5] as [number, number])).r, null, "constant yield has no correlation");
}
console.log("yield.selfcheck: ok");
