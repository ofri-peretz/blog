---
devto_url: "https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8"
devto_id: 3688612
title: "Our linter reported 0 cycles. A cache bug hid 245 files at scale."
description: "Our import-next/no-cycle reported 0 cycles in next.js's 14K-file repo. oxlint reported 17. The same rule on a 33-file subset of the same repo found 5. The bug: a depth-truncated DFS cached files as 'known acyclic' that it had never finished exploring — and the cascade swallowed 245 files. Five lines fixed it. Here is why your AI-generated barrel files make this worse."
published: true
tags:
  - "javascript"
  - "node"
  - "performance"
  - "eslint"
canonical_url: "https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale"
cover_image: ""
series: "Inside our linter benchmarks"
---

At 2,363 files, `import-next/no-cycle` stopped detecting cycles — not because there were none, but because the cache was poisoned by a depth-truncated DFS that cached unexplored files as "known acyclic." Here's the 5-line fix and why it's harder than it sounds.

We benchmark `import-next/no-cycle` against `eslint-plugin-import/no-cycle` and oxlint's native Rust port on next.js (131K stars, 14,556 source files in the repo; 2,363 of them lintable under the bench's `packages/**` glob). The two ESLint plugins agreed: **0 cycles found**. oxlint disagreed: **17 cycles found**.

We trusted the consensus. Then we tested our own rule on a 33-file subset of the same repo (`packages/next/src/client/components/router-reducer/**`). It found **5 cycles immediately**.

Same rule. Same config. Same files. Different scope. Different answers.

> **Our `no-cycle` CI check was passing, our codebase had cycles we could see, the logs showed no errors. It was cache poisoning.**

The bug was 60 lines deep in the cache layer — and it explains why the wider scope returned silence. Here's the part that should scare you before you scroll: **the build went green. Two linters agreed on `0`. A passing CI certified a number the cache had fabricated — and on AI-scaffolded code, that green check is exactly what makes everyone stop looking.**

**TL;DR install:** if you just want the patched detector right now, skip to [the fix](#the-fix). The corrected rule ships in `eslint-plugin-import-next@2.3.6` — one package, no additional config:

```bash
npm i -D eslint-plugin-import-next
```

The rest of this post explains exactly which cache invariant broke, why it hid 245 files, and why AI-scaffolded barrel trees make any depth-bounded cycle detector more likely to hit the same failure mode.

## Scale makes this interesting

At 500 files, `no-cycle` works perfectly. At 5,000, the cache poisoning probability climbs because the number of sourceFile-blind forward searches that can run — and corrupt the cache — before the cluster's own short cycles are evaluated grows with scope. **Most teams hit this at 1,000–2,000 files and file it as a fluke**: CI passes, nothing throws, the tool appears to work. The only signal is the absence of expected findings — which is easy to explain away as "maybe we got lucky with our imports."

At 2,363 files, a single bad cache entry cascaded into **245 unique files in cycles hidden from the detector, across 914 unique (file, line) pairs**. The poisoning produced clean output on every CI run. Only the absence of expected cycle detections in a scale-test — narrow vs. wide scope — revealed the problem.

The cache math is straightforward: more files means more independent forward searches running before the cluster's own cycle is evaluated, each with a higher probability of threading through a barrel-export chain that exceeds the depth cap. That's why a 33-file subset stays clean (no room for deep sourceFile-blind searches to accumulate) while the 2,363-file run goes dark.

## The setup that hides the bug

Every cycle-detection algorithm has the same shape:

1. For each file F in the lint scope
2. Run a depth-bounded DFS over its import graph
3. If DFS returns to F → found a cycle
4. Else → F is acyclic, remember that for next time

Step 4 is where caching pays off. Without memoization, every file re-walks overlapping subgraphs — roughly O(N²) in the worst case on a densely connected graph. With a "known acyclic" cache, repeat visits collapse to O(1), and on real codebases most files resolve through that fast path. Without it, the rule gets too slow to run in CI — which is exactly why the cache exists, and exactly why a wrong entry in it is so damaging.

The shape of the cache:

```ts
interface FileSystemCache {
  // ...
  nonCyclicFiles: Set<string>; // files known not to be in any cycle
}
```

And the use site. For each import `sourceFile → targetFile`, we DFS *forward* from `targetFile` looking for a path back to `sourceFile` — if we find one, `sourceFile` is in a cycle:

```ts
// sourceFile = the file that contains the import
// targetFile = the file being imported (where the forward search starts)
const pathStack: string[] = [sourceFile];

function dfs(file: string, depth: number, visited: Set<string>) {
  if (file === sourceFile) {        // path looped back to the importer
    allCycles.push([...pathStack, file]);
    return;
  }
  if (depth >= maxDepth) return;    // <-- early return on depth limit
  if (visited.has(file)) return;
  if (cache.nonCyclicFiles.has(file)) return; // <-- trust a prior verdict
  visited.add(file);
  pathStack.push(file);
  // ... recurse into this file's imports, then pathStack.pop()
}

// Called once PER IMPORT EDGE across the whole lint scope.
dfs(targetFile, 1, new Set());
if (allCycles.length === 0) {
  cache.nonCyclicFiles.add(targetFile); // <-- cache the result
}
```

Spot the bug? It's between those two `// <--` lines. And note the cache key: `add(targetFile)` — the verdict is stored against the *imported* file alone, with no record of *which* `sourceFile` we were searching for. Hold onto that; it's what turns one truncated search into a wrong answer for every other search.

## Why the cache poisons itself

When the DFS hits `depth >= maxDepth`, it returns _as if it had completed exploration without finding a cycle_. The caller can't tell the difference between "I explored everything and found nothing" and "I gave up at depth 10."

Here's the subtlety that makes this hide even *short* cycles — the part a careful reader rightly pushes on. Take file `F`, which sits on a 3-file cycle inside router-reducer. You'd think `F` could never be cached acyclic: walk its own short cycle and you find it immediately. But the cache entry for `F` isn't necessarily written by a search that started looking for *F's* cycle. `F` is imported from many places. Suppose some *distant* file `S` (outside router-reducer) imports `F`. We run `detectCycleFromImport(S, F)`: DFS forward from `F`, looking for a path back to `S`. That search threads out through `F`'s barrel re-exports — `index.ts` → sibling → sibling — and at depth 11, still chasing a path to `S`, it hits the cap and returns empty. `allCycles.length === 0`, so:

1. DFS truncated at depth 10 (searching for a path to `S`, never reached)
2. `allCycles.length === 0`
3. **`cache.nonCyclicFiles.add(F)`** — `F` marked acyclic, *with no record that we were only ever looking for `S`*

That's the real defect: the cache key is `F` alone (`add(targetFile)`), but the verdict it just stored — "no cycle" — was only ever true *relative to `S`*. The cache promotes "`F` has no path back to `S` within 10 hops" into the unconditional claim "`F` is in no cycle at all." So now when router-reducer's own file imports `F` and we go looking for `F`'s *short* cycle, `if (cache.nonCyclicFiles.has(F)) return;` fires first — and the 3-file cycle that's sitting right there, two hops away, is never walked. A deep, unrelated search poisoned a node that a shallow, local search would have flagged in microseconds.

And it cascades, because `nonCyclicFiles` is module-scoped shared state, deliberately *not* cleared between files in a run (cross-file reuse is the whole point of the cache — it's what keeps the rule fast enough for CI). One sourceFile-blind entry suppresses every later search that routes through `F`, each of which then caches *itself* acyclic, and the dark patch spreads through the cluster one target at a time.

To be precise about what actually fired at scale: the production default in effect during that bench run was **`maxDepth: 10`** — the rule's historical default at the time. That `10` is shallower than real next.js cycles reach: `webpack-config.ts`, for instance, sits ~12 hops deep, proof that production import chains routinely exceed the cap. Any DFS that runs out of depth before closing a loop — anywhere in the graph, including along the paths feeding the router-reducer cluster — takes the truncate-then-cache path. (The fix raised the default to unbounded *and* stopped truncated runs from writing to the cache — both halves, covered below. If you're reading the rule source today, you'll see the new unbounded default, not the `10` that caused this.)

In a small lint scope, you don't see the cascade — there aren't enough files for one bad cache entry to mask the others. In a 14K-file scope, one early miss-then-cache wipes out the whole cluster.

## Why it survived undetected

Cache bugs don't throw errors — they silently return wrong results. The poisoning produced clean output on every CI run. The tool appeared to work: no exceptions, no warnings, no suspicious log lines. Only the absence of expected cycle detections in a scale-test revealed the problem. The miss rate at 2,363 files was effectively 100% for the affected cluster: **0 cycles reported where 914 (file, line) pairs existed**.

No reviewer was asleep. The bug survived because both halves of it are individually correct and they were written at different times.

The `if (depth >= maxDepth) return;` line is a textbook performance guard — every reviewer who's ever paged through a dense graph nods at it and moves on. The `if (allCycles.length === 0) cache.nonCyclicFiles.add(targetFile);` line reads in plain English as "we found no cycles, so remember this file is fine" — also obviously correct, in isolation. Neither line is wrong. The bug lives in the *gap between them*: the early return makes `allCycles.length === 0` mean two different things, and nothing in the diff for the cache write forced anyone to remember the early return existed. A diff-scoped review sees a correct line added to a correct function. You only catch this if you're holding the whole control-flow in your head at once — which is exactly what review at PR granularity optimizes against. The green unit tests and the two-linter consensus then certified the wrong answer, so there was no signal pulling anyone back to look.

## The narrow-vs-wide scope smoking gun

Here's the test that proved it. Same rule, same config, same `--no-cache` flag (so ESLint doesn't cache between runs — but our in-process cache is still active for the duration of the run):

```bash
# Wide scope: 2,363 files, includes everything in packages/
$ eslint --no-cache --config flagship.config.mjs 'packages/**/*.{ts,tsx,js}'
# 0 import-next/no-cycle findings

# Narrow scope: 33 files, just the router-reducer directory
$ eslint --no-cache --config flagship.config.mjs 'packages/next/src/client/components/router-reducer/**/*.ts'
# 5 import-next/no-cycle findings
```

The narrow run finds cycles. The wide run starts from a fresh process with a fresh cache too — but it lints the 2,363 files in some order, and as it goes it fills `nonCyclicFiles` with exactly the kind of sourceFile-blind entry described above: a router-reducer file gets searched *forward* on behalf of some distant importer, the search runs past depth 10 through the cluster's barrels without closing *that* loop, and the file is cached acyclic. By the time the pass gets around to detecting the cluster's own short cycles, those nodes are already marked clean and the short-circuit skips them. The narrow run never builds those entries: with only 33 files in scope, no forward search has a 10-hop barrel chain to get lost in before the local cycle closes, so every cache write is honest. Scope isn't the cause; it's how many deep, sourceFile-blind searches get to run and poison nodes before the cluster's own short cycles are evaluated — which is why a small subtree stays clean and the 14K-file pass goes dark.

oxlint, being a different process with its own implementation, doesn't share our cache. It uses oxlint's own `ModuleGraphVisitorBuilder` and finds 17 cycles. (Why oxlint's 17 differs from `eslint-plugin-import`'s 0 is a separate story about `import type` edge-counting policy — I trace that in the [companion root-cause writeup](https://dev.to/ofri-peretz/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it).)

## The fix

Track whether the DFS was truncated, and don't cache truncated runs:

```ts
let depthLimitHit = false;

function dfs(file: string, depth: number, visited: Set<string>) {
  if (file === sourceFile) {
    allCycles.push([...pathStack, file]);
    return;
  }
  if (depth >= maxDepth) {
    depthLimitHit = true; // <-- record the truncation
    return;
  }
  // ... rest unchanged
}

dfs(targetFile, 1, new Set());

// Only cache as acyclic when DFS COMPLETED and found nothing.
// A depth-truncated DFS isn't proof of acyclicity.
if (allCycles.length === 0 && !depthLimitHit) {
  cache.nonCyclicFiles.add(targetFile);
}
```

Five lines — but be precise about what they buy. The guard stops a truncated DFS from *poisoning its neighbors*: no more false-acyclic cache entries cascading through a cluster. It does **not**, on its own, make a depth-truncated run find a cycle that sits past the limit — a file whose only cycle is at depth 12 still reports 0 *for itself* under `maxDepth: 10`. That second false negative is closed by the other half of the fix: raising the default to unbounded, so the DFS actually reaches the deep loop. The guard makes unbounded *safe* to default to (a truncated run on a dense graph no longer corrupts the cache); the unbounded default is what surfaces the deep cycles. Together: re-running on next.js goes **0 → 245 unique files in cycles, 914 unique (file, line) pairs**, and the wide-scope correctness now matches the narrow-scope correctness.

The obvious objection: *unbounded recursive DFS on a 14K-file graph — doesn't that blow the call stack?* No, and the reason is the same `visited` set that scopes one search. Recursion descends a node only once per search tree (`if (visited.has(file)) return;`), so the real recursion depth is bounded by the longest *acyclic* import chain — the graph's diameter, not the file count — and never by the cycle itself (a back-edge hits `visited` and returns instead of recursing forever). That's also the answer to the question every reviewer eventually asks: if per-call `visited` already bounds the search, why did the cascade happen? Because `visited` is created fresh **per target file** — it only protects one search — while `nonCyclicFiles` is the module-scoped cache shared across *every* file in the run. `visited` stops infinite recursion within a search; the cross-file cache is the state that leaks a wrong answer from one search into all the later ones. Two different sets, two different jobs — and only one of them was lying. (`maxDepth` existed originally as a blunt stack-and-latency guard; the real fix was making the cache honest, which let the cap go.)

The fix shipped in `eslint-plugin-import-next@2.3.6`. If you want the corrected detector in your own CI, this is the whole setup — no truncation default to lower, no cache flag to remember. (If you're also evaluating how this compares to the 17 other ESLint security and quality plugins in our benchmark, see [the full plugin comparison](https://eslint.interlace.tools).)

```bash
npm i -D eslint-plugin-import-next
```

```js
// eslint.config.mjs
import importNext from "eslint-plugin-import-next";

export default [
  {
    plugins: { "import-next": importNext },
    rules: {
      // Since 2.3.6 the default is Number.MAX_SAFE_INTEGER (unbounded) —
      // the old default of 10 is what hid the 245 files. Leave it unbounded.
      // A depth-truncated run no longer poisons the cache, so a lower
      // cap (for stack-safety on dense graphs) is now safe to set.
      "import-next/no-cycle": "error",
    },
  },
];
```

Rule reference and full option list: [`import-next/no-cycle` on eslint.interlace.tools](https://eslint.interlace.tools/rules/import-next/no-cycle).

### The 30-second test — run this on your own repo

This is the whole diagnostic, copy-paste ready. Install the patched detector, lint the whole repo, then lint your gnarliest subdirectory, and compare the two counts:

```bash
# 1. Install the patched detector (>=2.3.6, with the truncation fix)
npm i -D eslint-plugin-import-next

# 2. Whole repo — note the no-cycle count
npx eslint 'src/**/*.{ts,tsx}'

# 3. One dense subdirectory (your biggest barrel tree / the dir your LLM keeps editing)
npx eslint 'src/<your-gnarliest-subdir>/**/*.{ts,tsx}'

# Compare: if step 3 reports MORE cycles than step 2, the wide scope is
# hiding cycles — you have this class of bug, patched detector or not.
# (Precisely: a correct detector never reports FEWER cycles for a superset
#  scope than for its subset. A subset finding more is the signature.)
```

That single comparison — subset finds more than the whole — is the signature. It works on *any* cycle detector, not just ours. It's also where AI-scaffolded code lights up hardest, for reasons I get into [below](#why-ai-generated-code-makes-this-worse).

## What `eslint-plugin-import` does instead

When you've found a real bug, it's worth checking how peers in the same landscape modeled the problem. The long-standing `eslint-plugin-import/no-cycle` rule uses a fundamentally different approach:

```js
// from eslint-plugin-import/src/rules/no-cycle.js:73
const scc = options.disableScc
  ? {}
  : StronglyConnectedComponentsBuilder.get(myPath, context);

// ...

// If we're in different SCCs, we can't have a circular dependency
const hasDependencyCycle =
  options.disableScc || scc[myPath] === scc[imported.path];
if (!hasDependencyCycle) return;
```

They build a strongly-connected-components graph **once per lint run**, then per-file the cycle check is O(1) — _"are these two files in the same SCC?"_. The SCC graph itself is computed in O(V+E) using Tarjan's algorithm.

This sidesteps the depth-limit problem entirely. SCCs are an exact answer to "what are the cycle clusters?" — there's no truncation, no approximation, no cache to poison. They cache the SCC result module-wide and clear it on `Program:exit`.

oxlint goes further: it builds an explicit module graph during parsing, then the cycle visitor runs against that graph directly. No need for SCC because the graph is already structured.

Both approaches share a property our DFS-with-cache approach lacks: **the algorithm is exact, not approximate**. The cache trades some compute for correctness — exactly what we accidentally did the wrong way.

For a full performance comparison between `eslint-plugin-import` and `eslint-plugin-import-next` (up to 100x faster on large repos), see [the benchmark writeup](https://dev.to/ofri-peretz/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).

## Why AI-generated code makes this worse

This bug fires on one condition: a real cycle sits deeper than the DFS depth limit. So anything that lengthens import chains makes a finite-depth detector more likely to truncate-then-cache — and AI assistants lengthen import chains by default.

Ask an LLM to "add a module" and you tend to get a barrel: an `index.ts` that re-exports a handful of siblings, each of which re-exports its own neighbors. Every barrel hop is another edge between the importer and the symbol it actually wants. A cycle that's 3 files apart logically can be 11 hops apart once the codegen-friendly re-export tree is in the path — past the old `maxDepth: 10` default that triggered this bug, invisible, and now cached as acyclic for every traversal that crosses it. The same pattern that makes AI-written modules look tidy is the pattern that hides their cycles from any depth-bounded detector — and plenty of cycle detectors still ship a finite cap.

This isn't hypothetical, and it isn't a Claude-vs-Gemini thing — it's structural, and the depth-cascade is the import-graph cousin of a failure mode I keep measuring elsewhere: a static-analysis pass that looks green while it's silently wrong. In the generation experiment, [65-75% of AI-written Node functions shipped with a vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) the model never flagged; in the remediation experiment, "fix it again" loops [reintroduced a brand-new bug at 4× the rate](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) without a deterministic linter in the loop (32% vs 8%). Different rule, same lesson: the model's confidence is not the detector's correctness, and a green run on AI-scaffolded code is the place that gap hides best.

The uncomfortable part: the detector doesn't error. It returns **0**, the build goes green, and the consensus of two linters agrees with it. If you let an assistant scaffold modules and trust a green `no-cycle` run, you are trusting exactly the number this bug fabricates. Point the fixed detector at the repo your assistant has been editing and run [the 30-second narrow-vs-wide test](#the-30-second-test--run-this-on-your-own-repo) against its gnarliest barrel directory — that's where the cascade has the most room to grow, and where AI-scaffolded code makes the gap widest.

### Reproduce it on a Gemini-scaffolded repo (challenge protocol)

Want to turn the structural claim into original data on a specific model? Here's the exact, reproducible protocol — I'm publishing the recipe rather than a number I haven't measured, because I want the count to come from *your* model and *your* scaffold, not a fabricated one:

```bash
# 1. Have Gemini scaffold a small feature across modules. A prompt that
#    reliably produces a deep barrel tree (the structure that hides cycles):
#    "Create a feature module `orders` in src/. Split it into submodules
#     (api, hooks, components, utils), each with its own index.ts barrel,
#     and re-export everything up through src/orders/index.ts. Wire the
#     submodules so components imports hooks, hooks imports api, api imports
#     a shared type from components." (that last edge is the cycle seed)

# 2. Make sure import-next is installed and registered in eslint.config.mjs
#    (the config block above does this). With the plugin registered, set a
#    FINITE depth cap to simulate the buggy class, and lint wide then subset:
npx eslint --rule 'import-next/no-cycle: ["error", { "maxDepth": 10 }]' 'src/**/*.{ts,tsx}'
npx eslint --rule 'import-next/no-cycle: ["error", { "maxDepth": 10 }]' 'src/orders/**'

# 3. Now re-run both with the unbounded default — drop the --rule override
#    and let the rule from your config (above) run at its patched default:
npx eslint 'src/**/*.{ts,tsx}'
npx eslint 'src/orders/**'

# Record four numbers: (wide@10, subset@10, wide@∞, subset@∞).
# The depth-cascade signature is wide@10 < subset@10 with wide@∞ == subset@∞.
```

Run it across Gemini 2.5 Pro, Gemini 3 Pro, and Gemini 3 Flash and you have an original, model-specific dataset on how AI barrel-scaffolding interacts with depth-bounded cycle detection — the four-number signature is the whole experiment. I'm running this sweep next; until I have the counts in hand I won't print one here. (It also happens to be a clean [Build with Gemini](https://dev.to/challenges) entry under `#googleai #geminichallenge` — beat me to it if you want.)

What I *have* measured across these exact models is adjacent and points the same way: when I [benchmarked 700 AI-generated functions across 5 models from Gemini and Claude](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) against 332 ESLint rules, [Claude and Gemini landed in a near dead-heat on security](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) — both leaning on the same tidy-looking re-export and abstraction habits that lengthen import paths. The model isn't the variable; the *structure* is, and that structure is exactly what feeds this false `0`.

## Three takeaways

**Caches should never lie.** A cache entry should only encode information you've _proven_, not information you've _failed to disprove_. Our `nonCyclicFiles` cache encoded "DFS found no cycle" as "no cycle exists." Those aren't the same statement.

**Test the algorithm at the same scope you'll deploy at.** Our unit tests passed because the test fixtures are small and depth-bounded. The bug only surfaces at 2K+ files where the cache fills up enough for cascades to start. We need a stress test that mirrors production.

**An exact algorithm sidesteps a class of bugs that caches can introduce.** SCC-based cycle detection (eslint-plugin-import) and module-graph walking (oxlint) avoid the depth-limit interaction by construction. We hold our DFS approach for a reason — incremental analysis benefits from per-file caching — but the depth-limit + cache interaction is exactly the kind of bug the SCC approach can't have. Worth re-evaluating whether incrementality is worth that trade.

The fix is in [packages/eslint-devkit/src/resolver/dependency-analysis.ts](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-devkit/src/resolver/dependency-analysis.ts). The bench that exposed it is [`benchmarks/suites/ilb-flagship`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks/suites/ilb-flagship).

**Series — _Inside our linter benchmarks_.** This is one of three rule bugs the same bench sweep caught, and the second angle on this specific one:

- [import-next/no-cycle reported 0 cycles on next.js — we found why and fixed it](https://dev.to/ofri-peretz/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it) — the same bug from the depth-limit side, including why oxlint's 17 and `eslint-plugin-import`'s 0 are both correct under different `import type` edge policies.
- [What ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) — the smoke-gate that exposed all three bugs at F1=1.00.
- [When entropy isn't enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) — 807 false credential findings on vercel/ai, the third bug in the sweep.

Have you ever had a CI tool report a false green because of a caching bug — and how did you discover it wasn't actually checking what you thought? Bonus points if it was on code an AI assistant scaffolded and the green check is what made everyone stop looking. Drop the before/after count in the comments — I'm collecting these failure modes for the bench corpus.

---

*[eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
