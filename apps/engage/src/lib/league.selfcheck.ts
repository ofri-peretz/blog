/** Self-check for league.ts — `npx tsx src/lib/league.selfcheck.ts`. */
import assert from "node:assert/strict";
import { aggregate, arenaSummary } from "./league";
const a = (u: string, rx: number, cm = 0) => ({ user: { username: u }, public_reactions_count: rx, comments_count: cm });
const t = aggregate("security", [a("x", 50), a("x", 40), a("y", 60), a("me", 11, 4), a("z", 5)], "me");
assert.equal(t.authors, 4);
assert.equal(t.rank, 3, "x has 90, y 60, me 11, z 5");
assert.equal(t.percentile, 1 / 3, "we out-rank one of three others");
assert.deepEqual(t.above.map((l) => l.author), ["x", "y"]);
const absent = aggregate("ai", [a("p", 1)], "me");
assert.equal(absent.rank, null);
assert.equal(absent.percentile, 0, "absent is zero, not unknown");
assert.deepEqual(arenaSummary([t, absent]), { percentile: 0.167, present: 1 });
console.log("league.selfcheck: ok");
