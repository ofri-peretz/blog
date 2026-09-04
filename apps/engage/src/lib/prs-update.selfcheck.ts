/** Self-check for prs-update.ts — `npx tsx src/lib/prs-update.selfcheck.ts`. */
import assert from "node:assert/strict";
import { parseTarget, outcomeFor } from "./prs-update";

assert.deepEqual(parseTarget({ owner: "vercel", repo: "ai", number: 12 }), { owner: "vercel", repo: "ai", number: 12 });
assert.equal(parseTarget({ owner: "../etc", repo: "x", number: 1 }), null, "path characters are refused");
assert.equal(parseTarget({ owner: "a", repo: "b", number: "12abc" }), null);
assert.equal(parseTarget({ owner: "a", repo: "b", number: 0 }), null);
assert.equal(parseTarget(undefined), null);

assert.equal(outcomeFor(202).ok, true);
assert.equal(outcomeFor(422).status, "conflict", "a conflict is never retried, it is shown");
assert.equal(outcomeFor(403).status, "not-ours");
assert.equal(outcomeFor(500, "boom").message, "boom");
console.log("prs-update.selfcheck: ok");
