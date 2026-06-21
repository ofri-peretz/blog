---
devto_url: "https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3h7b-temp-slug-4255134"
devto_id: 3688612
title: "Our cycle detector reported 0. The real number was 245 files."
description: "Our import-next/no-cycle reported 0 cycles in next.js's 14K-file repo. oxlint reported 17. The same rule on a 33-file subset of the same repo found 5. The bug: a depth-truncated DFS cached files as 'known acyclic' that it had never finished exploring — and the cascade swallowed 245 files. Five lines fixed it. Here is why your AI-generated barrel files make this worse."
published: true
tags:
  - "eslint"
  - "node"
  - "ai"
  - "javascript"
canonical_url: "https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale"
cover_image: ""
series: "Inside our linter benchmarks"
---

We benchmark `import-next/no-cycle` against `eslint-plugin-import/no-cycle` and oxlint's native Rust port on next.js (131K stars, 14,556 source files). The two ESLint plugins agreed: **0 cycles found**. oxlint disagreed: **17 cycles found**.

We trusted the consensus. Then we tested our own rule on a 33-file subset of the same repo (`packages/next/src/client/components/router-reducer/**`). It found **5 cycles immediately**.

Same rule. Same config. Same files. Different scope. Different answers.

The bug was 60 lines deep in the cache layer — and it explains why the wider scope returned silence.

## The setup that hides the bug

Every cycle-detection algorithm has the same shape:

1. For each file F in the lint scope
2. Run a depth-bounded DFS over its import graph
3. If DFS returns to F → found a cycle
4. Else → F is acyclic, remember that for next time

Step 4 is where caching pays off. With N files and average graph depth D, naive cycle detection is O(N²·D). With a "known acyclic" cache, repeat visits are O(1). On real codebases the cache hit rate is 70%+ — without it the rule gets too slow to run in CI.

The shape of the cache:

```ts
interface FileSystemCache {
  // ...
  nonCyclicFiles: Set<string>; // files known not to be in any cycle
}
```

And the use site:

```ts
function dfs(file: string, depth: number, visited: Set<string>) {
  if (file === sourceFile) {
    allCycles.push([...pathStack, file]);
    return;
  }
  if (depth >= maxDepth) return; // <-- early return on depth limit
  if (visited.has(file)) return;
  if (cache.nonCyclicFiles.has(file)) return;
  // ... recurse into imports
}

dfs(targetFile, 1, new Set());
if (allCycles.length === 0) {
  cache.nonCyclicFiles.add(targetFile); // <-- cache the result
}
```

Spot the bug? It's between those two `// <--` lines.

## Why the cache poisons itself

When the DFS hits `depth >= maxDepth`, it returns _as if it had completed exploration without finding a cycle_. The caller can't tell the difference between "I explored everything and found nothing" and "I gave up at depth 10."

So a file whose only cycle is at depth 12 (where 12 > maxDepth=10) gets:

1. DFS truncated at depth 10
2. `allCycles.length === 0`
3. **`cache.nonCyclicFiles.add(targetFile)`** — incorrectly marked as known-acyclic

Now any future DFS that traverses through that file short-circuits because of `if (cache.nonCyclicFiles.has(file)) return;`. The poisoning cascades: every file in the same SCC subtree gets marked acyclic by association.

In a small lint scope, you don't see the cascade — there aren't enough files for one bad cache entry to mask the others. In a 14K-file scope, one early miss-then-cache wipes out the whole cluster.

## The narrow-vs-wide scope smoking gun

Here's the test that proved it. Same rule, same config, same `--no-cache` flag (so ESLint doesn't cache between runs — but our in-process cache is still active for the duration of the run):

```bash
# Wide scope: 2,363 files, includes everything in packages/
$ eslint --config flagship.config.mjs 'packages/**/*.{ts,tsx,js}'
# 0 import-next/no-cycle findings

# Narrow scope: 33 files, just the router-reducer directory
$ eslint --config flagship.config.mjs 'packages/next/src/client/components/router-reducer/**/*.ts'
# 5 import-next/no-cycle findings
```

The narrow run finds cycles. The wide run starts from a fresh process with a fresh cache too — but ESLint lints the 2,363 files in some order, and as it goes it fills up the `nonCyclicFiles` cache. By the time the pass reaches files that _do_ belong to cycles, a truncated DFS on some earlier neighbor has already marked them acyclic, and the cascade hides them. Scope isn't the cause; it's the amount of cache built up before the cyclic files are reached.

oxlint, being a different process with its own implementation, doesn't share our cache. It uses oxlint's own `ModuleGraphVisitorBuilder` and finds 17 cycles. (Why oxlint's 17 differs from `eslint-plugin-import`'s 0 is a separate story about `import type` edge-counting policy — I trace that in the [companion root-cause writeup](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it).)

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

Five lines. Re-running on next.js: **0 → 245 unique files in cycles, 914 unique (file, line) pairs**. The wide-scope correctness now matches the narrow-scope correctness.

The fix shipped in `eslint-plugin-import-next@2.3.6`. If you want the corrected detector in your own CI, this is the whole setup — no truncation default to lower, no cache flag to remember:

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
      // maxDepth defaults to Number.MAX_SAFE_INTEGER — leave it.
      // A depth-truncated run no longer poisons the cache, so a lower
      // cap (for stack-safety on dense graphs) is now safe to set.
      "import-next/no-cycle": "error",
    },
  },
];
```

Then the one-line test from the smoking-gun section above: run it on your whole repo, run it again on your gnarliest subdirectory, and compare the counts. If the subset finds more, your detector has this class of bug — fixed version or not.

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

## Why AI-generated code makes this worse

This bug fires on one condition: a real cycle sits deeper than the DFS depth limit. So anything that lengthens import chains makes a finite-depth detector more likely to truncate-then-cache — and AI assistants lengthen import chains by default.

Ask an LLM to "add a module" and you tend to get a barrel: an `index.ts` that re-exports a handful of siblings, each of which re-exports its own neighbors. Every barrel hop is another edge between the importer and the symbol it actually wants. A cycle that's 3 files apart logically can be 11 hops apart once the codegen-friendly re-export tree is in the path — past a `maxDepth: 10` default, invisible, and now cached as acyclic for every traversal that crosses it. The same pattern that makes AI-written modules look tidy is the pattern that hides their cycles from a depth-bounded detector.

The uncomfortable part: the detector doesn't error. It returns **0**, the build goes green, and the consensus of two linters agrees with it. If you let an assistant scaffold modules and trust a green `no-cycle` run, you are trusting exactly the number this bug fabricates. Run the narrow-vs-wide test above on any repo where a model has been generating files — that's where the cascade has the most room to grow. (For the broader pattern of AI assistants reintroducing fixed bugs, see [The AI Hydra problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).)

## Why this survived review

No reviewer was asleep. The bug survived because both halves of it are individually correct and they were written at different times.

The `if (depth >= maxDepth) return;` line is a textbook performance guard — every reviewer who's ever paged through a dense graph nods at it and moves on. The `if (allCycles.length === 0) cache.nonCyclicFiles.add(targetFile);` line reads in plain English as "we found no cycles, so remember this file is fine" — also obviously correct, in isolation. Neither line is wrong. The bug lives in the *gap between them*: the early return makes `allCycles.length === 0` mean two different things, and nothing in the diff for the cache write forced anyone to remember the early return existed. A diff-scoped review sees a correct line added to a correct function. You only catch this if you're holding the whole control-flow in your head at once — which is exactly what review at PR granularity optimizes against. The green unit tests and the two-linter consensus then certified the wrong answer, so there was no signal pulling anyone back to look.

Three takeaways from the diagnosis:

**Caches should never lie.** A cache entry should only encode information you've _proven_, not information you've _failed to disprove_. Our `nonCyclicFiles` cache encoded "DFS found no cycle" as "no cycle exists." Those aren't the same statement.

**Test the algorithm at the same scope you'll deploy at.** Our unit tests passed because the test fixtures are small and depth-bounded. The bug only surfaces at 2K+ files where the cache fills up enough for cascades to start. We need a stress test that mirrors production.

**An exact algorithm sidesteps a class of bugs that caches can introduce.** SCC-based cycle detection (eslint-plugin-import) and module-graph walking (oxlint) avoid the depth-limit interaction by construction. We hold our DFS approach for a reason — incremental analysis benefits from per-file caching — but the depth-limit + cache interaction is exactly the kind of bug the SCC approach can't have. Worth re-evaluating whether incrementality is worth that trade.

The fix is in [packages/eslint-devkit/src/resolver/dependency-analysis.ts](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-devkit/src/resolver/dependency-analysis.ts). The bench that exposed it is [`benchmarks/suites/ilb-flagship`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks/suites/ilb-flagship).

**Series — _Inside our linter benchmarks_.** This is one of three rule bugs the same bench sweep caught, and the second angle on this specific one:

- [import-next/no-cycle reported 0 cycles on next.js — we found why and fixed it](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it) — the same bug from the depth-limit side, including why oxlint's 17 and `eslint-plugin-import`'s 0 are both correct under different `import type` edge policies.
- [What ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) — the smoke-gate that exposed all three bugs at F1=1.00.
- [When entropy isn't enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) — 807 false credential findings on vercel/ai, the third bug in the sweep.

One question, because I suspect this is more common than anyone admits: **have you ever shipped a static-analysis result that was confidently, silently wrong — a "0 findings" that turned out to be a truncated traversal, a stale cache, or a scope you didn't realize you'd narrowed?** What was the number that should have scared you, and what finally made you check it? Drop it in the comments — I'm collecting failure modes for the bench corpus.

---

## 📊 About the author

I'm Ofri Peretz, building the Interlace ESLint ecosystem — a JavaScript static-analysis catalog that runs under ESLint and Oxlint with CI-enforced parity.

- 🔗 [Portfolio & live metrics](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=ilb-no-cycle-cache-poisoning)
- 📦 [eslint-plugin-import-next on npm](https://www.npmjs.com/package/eslint-plugin-import-next)
- 🐙 [GitHub: ofri-peretz/eslint](https://github.com/ofri-peretz/eslint)
- 📈 [Live impact dashboard](https://ofriperetz.dev/stats?utm_source=devto&utm_medium=article&utm_campaign=ilb-no-cycle-cache-poisoning)

{% user ofri-peretz %}
