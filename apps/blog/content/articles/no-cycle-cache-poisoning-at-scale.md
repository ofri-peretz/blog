---
devto_url: "https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3h7b-temp-slug-4255134"
devto_id: 3688612
title: "no-cycle finds 0 cycles in next.js (and other lies caches tell you)"
description: "Our import-next/no-cycle reported 0 cycles in next.js's 14K-file repo. oxlint reported 17. The same rule, run on a 33-file subset of the same repo, found 5+. The bug: cache pollution from a depth-truncated DFS marking files as 'known acyclic' that hadn't been fully explored."
published: true
tags:
  - "eslint"
  - "staticanalysis"
  - "performance"
  - "algorithms"
canonical_url: "https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale"
cover_image: ""
series: "Inside our linter benchmarks"
---

We benchmark `import-next/no-cycle` against `eslint-plugin-import/no-cycle` and oxlint's native Rust port on next.js (131K stars, 14,556 source files). The two ESLint plugins agreed: **0 cycles found**. oxlint disagreed: **17 cycles found**.

We trusted the consensus. Then we tested our own rule on a 33-file subset of the same repo (`packages/next/src/client/components/router-reducer/**`). It found **5+ cycles immediately**.

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
# 5+ import-next/no-cycle findings
```

The narrow run finds cycles. The wide run, run from a fresh process with a fresh cache, also produces a fresh cache — but ESLint linits files in some order, and as it processes the 2,363 files, it builds up the `nonCyclicFiles` cache. By the time the lint pass reaches files that _do_ belong to cycles, those cycles have been falsely marked acyclic via cascade.

oxlint, being a different process with its own implementation, doesn't share our cache. It uses oxlint's own `ModuleGraphVisitorBuilder` and finds 17 cycles.

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

## What I'd do differently next time

Three takeaways from the diagnosis:

**Caches should never lie.** A cache entry should only encode information you've _proven_, not information you've _failed to disprove_. Our `nonCyclicFiles` cache encoded "DFS found no cycle" as "no cycle exists." Those aren't the same statement.

**Test the algorithm at the same scope you'll deploy at.** Our unit tests passed because the test fixtures are small and depth-bounded. The bug only surfaces at 2K+ files where the cache fills up enough for cascades to start. We need a stress test that mirrors production.

**An exact algorithm sidesteps a class of bugs that caches can introduce.** SCC-based cycle detection (eslint-plugin-import) and module-graph walking (oxlint) avoid the depth-limit interaction by construction. We hold our DFS approach for a reason — incremental analysis benefits from per-file caching — but the depth-limit + cache interaction is exactly the kind of bug the SCC approach can't have. Worth re-evaluating whether incrementality is worth that trade.

The fix is in [packages/eslint-devkit/src/resolver/dependency-analysis.ts](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-devkit/src/resolver/dependency-analysis.ts). The bench that exposed it is [`benchmarks/suites/ilb-flagship`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks/suites/ilb-flagship).

This is one of three rule bugs caught by the same bench sweep. The companion writeups: [What ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) (the smoke-gate piece) and [When entropy isn't enough](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) (807 false credential findings on vercel/ai).

---

## 📊 About the author

I'm Ofri Peretz, building the Interlace ESLint ecosystem — a JavaScript static-analysis catalog that runs under ESLint and Oxlint with CI-enforced parity.

- 🔗 [Portfolio & live metrics](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=ilb-no-cycle-cache-poisoning)
- 📦 [eslint-plugin-import-next on npm](https://www.npmjs.com/package/eslint-plugin-import-next)
- 🐙 [GitHub: ofri-peretz/eslint](https://github.com/ofri-peretz/eslint)
- 📈 [Live impact dashboard](https://ofriperetz.dev/stats?utm_source=devto&utm_medium=article&utm_campaign=ilb-no-cycle-cache-poisoning)

{% user ofri-peretz %}
