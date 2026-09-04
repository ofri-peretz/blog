/** Runnable check for the watcher's rules — `node scripts/control-bands.check.mjs`. */
import assert from "node:assert/strict";
import { evaluate } from "./control-bands.mjs";
const band = { id: "t", window: 28, minPoints: 14, worse: "lower" };
const pts = (vals) => vals.map((v, i) => ({ t: `2000-01-${String(i + 1).padStart(2, "0")}`, v }));
const base = Array(20).fill(100);          // mean 100, sd 0 → any recent below is "worse", but sd 0 disables σ rules
const jitter = Array(20).fill(0).map((_, i) => 100 + (i % 2 ? 2 : -2)); // mean 100, sd 2
assert.equal(evaluate(pts(jitter.concat([100, 100, 100, 100, 100, 100, 100, 100])), band).tier, null, "steady is ok");
assert.equal(evaluate(pts(jitter.concat([100, 100, 100, 100, 100, 100, 100, 90])), band).rule, 1, "one point beyond 3σ is rule 1");
assert.equal(evaluate(pts(jitter.concat([100, 100, 100, 100, 100, 95, 95, 100])), band).rule, 2, "2 of 3 beyond 2σ is rule 2");
assert.equal(evaluate(pts(jitter.concat([100, 100, 100, 97, 97, 97, 97, 100])), band).rule, 3, "4 of 5 beyond 1σ is rule 3");
assert.equal(evaluate(pts(jitter.concat([99, 99, 99, 99, 99, 99, 99, 99])), band).rule, 4, "8 on the worse side is drift, rule 4");
assert.equal(evaluate(pts(jitter.concat([100, 100, 100, 100, 100, 100, 100, 110])), band).tier, null, "the good side never breaches");
assert.equal(evaluate(pts(base.concat([100, 100, 100, 100, 100, 100, 100, 50])), band).tier, null, "sd 0 cannot compute σ; rule 4 needs 8 below the mean");
assert.match(evaluate(pts([1, 2, 3]), band).reason, /need/, "too few points says so");
assert.equal(evaluate(pts(jitter.concat([100, 100, 100, 100, 100, 100, 100, 100, 0])), band, "2000-01-29").tier, null, "today's partial day is not judged");
console.log("control-bands.check: ok");
