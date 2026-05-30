---
title: "5 Cycles Invisible in 14,556 Files. The Cache Bug That Hid Them."
description: "We found 5 import cycles in 33 files that were invisible in 14,556. The cause: a 10-hop depth limit that wrote false non-cyclic entries into a shared cache, poisoning later traversals. Here is the bug, the fix, and how to test if your own cycle detector has the same class of failure."
slug: "import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it"
canonical_url: "https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it"
devto_url: "https://dev.to/ofri-peretz/import-nextno-cycle-reported-0-cycles-on-nextjs-we-found-why-and-fixed-it-5bbm-temp-slug-3055225"
devto_id: 3559911
published_at: "2026-05-29"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/p3u4p7ovajzkf7dwqamm.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/p3u4p7ovajzkf7dwqamm.png"
reading_time_minutes: 5
tags:
  - "eslint"
  - "javascript"
  - "node"
  - "typescript"
reactions: 0
comments: 0
views: 0
series: "Inside our linter benchmarks"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-452c-48a1-85e8-149459645ea5.png"
  twitter: "ofriperetzdev"
---

Run `no-cycle` on your full monorepo, then run it again on a known-complex subdirectory. If the subset finds more cycles than the full run — you have the same class of bug we had.

We found 5 import-graph cycles in 33 files that were invisible in 14,556 — next.js, 131K stars. The cause: a 10-hop depth limit that wrote false "non-cyclic" entries into a shared cache, poisoning later traversals. Large scope → more files processed before the subset → more false cache entries → more cycles hidden. Small scope → clean cache → same cycles visible.

The cache bug is confirmed in source; the fix is in `eslint-plugin-import-next@2.3.6`. The detected cycles are mixed-edge: one direction is a value import, the other is `import type`. `eslint-plugin-import/no-cycle` v2.32.0 skips `import type` edges by design (`importer.importKind === 'type'` check, line 93 of no-cycle.js), which is why its count differs from ours — different edge-counting policies, not a bug in either tool.

---

## The bug: a 10-hop depth limit that silenced 12-hop cycles — and poisoned the cache

The original default in `import-next/no-cycle` was `maxDepth: 10`.

Next.js's `webpack-config.ts` has an import cycle approximately 12 hops deep. With `maxDepth: 10`, the DFS reaches hop 10, stops, marks those boundary files as explored, and exits without finding the cycle. The closing import — the one that would have revealed it — is never reached.

```typescript
// What happens at maxDepth: 10
// A → B → C → D → E → F → G → H → I → J → [depth exceeded — stop]
//                                                  K → L → A  ← never reached
//
// Result: 0 cycles. The A→…→L→A cycle disappears.
```

The failure is invisible. The rule runs, reports no violations, exits 0. No warning that it stopped early. No indication that part of the graph wasn't examined.

**Two-part fix, in order of importance:**

**Fix 1 (the real bug): only cache a node as "acyclic" when the DFS was complete.** The depth cap itself isn't wrong — it's a legitimate performance escape hatch. What's wrong is marking a depth-truncated node as unconditionally acyclic. From the source:

```typescript
// Only cache as non-cyclic when the DFS was complete AND found no cycles.
// A depth-truncated DFS cannot prove acyclicity (the cycle may exist past
// the depth limit), and caching it poisons every future lint pass that
// traverses the same subtree.
if (allCycles.length === 0 && !depthLimitHit) {
  cache.nonCyclicFiles.add(targetFile);
}
```

This means: if you use a finite `maxDepth` after the fix, cycles deeper than your limit still won't be detected — but they also won't poison the cache for other traversals. The scope-dependent failure mode is gone.

**Fix 2 (the default): raise `maxDepth` to `Number.MAX_SAFE_INTEGER`.** The 10-hop default silenced the 12-hop `webpack-config.ts` cycle entirely. The new default matches `eslint-plugin-import` v2.32.0 (`Infinity`). oxlint v1.65.0 ships `import/no-cycle` under `--import-plugin` and traverses without an explicit depth cap.

**On stack safety:** The DFS is recursive. Recursion depth is bounded by the traversal path length — which on a dense 14K-file graph can reach hundreds of frames before hitting a leaf or cycle, well short of V8's ~10K-frame limit in practice. For very dense dependency graphs (generated code, large barrel-file trees), a finite `maxDepth` is a legitimate performance and stack-safety guard. Fix 1 ensures that finite cap no longer poisons the cache — you get a depth-limited result without false negatives cascading to other traversals.

**What the fix changes in `eslint-plugin-import-next@2.3.6`:** The ~12-hop cycle in `webpack-config.ts` is now caught. The 33-file router-reducer subset returns 5 cycles whether run in isolation or as part of the full 14,556-file repo. The gap that produced 0 on the full run is closed. Whether the fixed rule finds all 17 cycles oxlint reports is tracked via our [ground-truth corpus](https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b).

`eslint-plugin-import/no-cycle` already defaults to `maxDepth: Infinity`, so Fix 2 doesn't explain their 0 either. The explanation is their edge-counting policy: the rule explicitly skips `import type` edges (`importer.importKind === 'type'` check in the source). The detected cycles contain at least one `import type` edge — so our rule reports them and theirs doesn't. See "What the cycles actually are" below.

**On type-only imports:** `import-next/no-cycle` hooks all `ImportDeclaration` nodes including `import type`. The detected cycles contain mixed edges — at least one value import alongside a `import type` return edge. See "What the cycles actually are" below for the specific file-by-file verification.

**Why it shipped with the wrong default:** Unit tests use small, controlled graphs — never 12 hops deep. CI stayed green. The benchmark against next.js was what surfaced it, and only because we had oxlint's count as a reference. Without an independent comparison, the silence would have looked like a clean result.

---

## Why the subset found more than the full repo

The counterintuitive part: the 33-file subset found 5 cycles that the 14,556-file run missed.

The depth-limit bug explains it precisely. When the full-repo run processes files outside the 33-file subset first, it encounters some at hop 10 — the old depth limit. Without the cache fix, those files were incorrectly added to `nonCyclicFiles`:

```typescript
// OLD behavior (before fix): depth-truncated nodes marked as non-cyclic
if (allCycles.length === 0) {
  cache.nonCyclicFiles.add(targetFile); // ← wrong — subtree wasn't fully explored
}
```

Some of those falsely-marked files are **intermediate nodes** in cycles that pass through the 33-file subset. When the rule later encounters those cycles from files inside the subset, it hits line 975:

```typescript
if (cache.nonCyclicFiles.has(targetFile)) {
  return []; // ← early exit because the intermediate was wrongly marked clean
}
```

The DFS exits. The cycle disappears.

The 33-file subset run starts with a fresh `nonCyclicFiles` cache — none of the full-repo's false entries are present. Every path is traversed in full. The cycles surface.

Smaller scope → no false `nonCyclicFiles` entries from other traversals → cycles found. That is the exact signature of the premature-memoization bug.

**Cache lifetime:** `nonCyclicFiles` is a module-level object shared across every file processed in a single `npx eslint` invocation. It is not reset between files. File ordering follows ESLint's glob expansion (roughly lexical). Files earlier in the scan can poison entries for files processed later — reproducibly, not randomly.

---

## What this means for your own cycle detector

The test that exposed our bug works on any implementation:

1. Run `no-cycle` on your full monorepo — note the count
2. Pick a known-complex directory (dependency-heavy, many cross-imports) and run on just that subtree
3. If the subset finds cycles the full run doesn't, you have a cache or depth interaction affecting the broader scope

We found 5 in 33 files that were invisible in 14,556. The smaller scope, because it has a cleaner traversal state, shows you what the larger scope buried. Most teams never run this check because they assume "fewer files = fewer findings." For cycle detection with caching, the opposite can be true.

To run this on `eslint-plugin-import-next@2.3.6` (which has the fix):

```bash
npm install --save-dev eslint-plugin-import-next@2.3.6

# Full monorepo
npx eslint src/ --rule '{"import-next/no-cycle": "error"}'

# Specific subdirectory (the diagnostic test)
npx eslint src/components/ --rule '{"import-next/no-cycle": "error"}'
```

```javascript
// eslint.config.mjs — using 'import-next' namespace to distinguish from eslint-plugin-import
import importNext from 'eslint-plugin-import-next';

export default [
  {
    plugins: { 'import-next': importNext },
    rules: {
      'import-next/no-cycle': 'error',
      // maxDepth defaults to Number.MAX_SAFE_INTEGER — don't lower it
      // unless you understand the cache-poisoning tradeoff
    },
  },
];
```

---

## The pattern — and what it means for any cycle detector

Unit tests on small graphs won't catch this:

- A 6-file test cycle never exercises a 10-hop depth limit
- No unit test validates "subset finds ≥ full-repo count"

The only thing that caught it: a large real-world repo measured against an independent reference tool, plus running the subset test that makes the paradox visible. If your cycle detector reports silence on a large monorepo, run it on a known-complex subdirectory. The silence might be correct. Or it might be a depth limit and a poisoned cache you didn't know you had.

---

## What the cycles actually are

We verified the edge kinds against the next.js source. The cycle between `fetch-server-response.ts` and `set-cache-busting-search-param.ts` is a **mixed cycle**:

```typescript
// fetch-server-response.ts — VALUE import
import { setCacheBustingSearchParam } from './set-cache-busting-search-param'

// set-cache-busting-search-param.ts — TYPE-ONLY import
import type { RequestHeaders } from './fetch-server-response'
```

One edge is a value import (runtime dependency), one is `import type` (compile-time only, erased at runtime). This is the clean explanation for the 0-vs-5 gap:

- Our rule hooks all `ImportDeclaration` nodes including `import type` — so it sees the full cycle
- `eslint-plugin-import/no-cycle` v2.32.0 skips `import type` edges via `importer.importKind === 'type'` (no-cycle.js line 93) — it sees the value edge from `fetch-server-response.ts` but not the `import type` return edge, so no cycle is detected

Whether a mixed-edge cycle is "real" depends on your position. The value-import direction is a runtime dependency. The `import type` direction is compile-time only. We report both because circular dependencies in the source graph are an architectural concern regardless of whether every edge survives compilation. If you only care about runtime cycles, set `ignoreTypeImports: true` in the rule options.

**Benchmark harness variance.** During post-fix validation, back-to-back runs produced 218→255→301. These are total violation rows (one per file-import pair), not distinct cycles. The variance was a harness bug: `pendingCycleReports` accumulated across runs in our test tooling, not in production ESLint. Fixed by resetting state between runs.

---

_Has a lint rule ever returned different counts on the same codebase across back-to-back runs — or found more issues on a subset than the full repo? What was the first thing that made you look closer?_

---

_Part of the [Inside our linter benchmarks](https://dev.to/ofri-peretz/series/inside-our-linter-benchmarks) series:_
_← [no-cycle Finds 0 Cycles in Next.js (And Other Lies Caches Tell You)](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8) | [What Ground Truth Caught That Unit Tests Missed →](https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b)_

---

📦 [`eslint-plugin-import-next`](https://www.npmjs.com/package/eslint-plugin-import-next) · [Rule docs](https://eslint.interlace.tools/docs/imports/plugin-import-next)

<!-- markdownlint-disable MD034 -->
{% cta https://github.com/ofri-peretz/eslint %}
⭐ Star on GitHub
{% endcta %}
<!-- markdownlint-enable MD034 -->

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
