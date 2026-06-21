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
reading_time_minutes: 9
tags:
  - "eslint"
  - "node"
  - "javascript"
  - "ai"
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

Our cycle detector scanned 14,556 files of next.js and reported **0 import cycles**. The same rule, same config, on a 33-file subset of those exact files, found **5**. Adding files made cycles *disappear* — the inverse of how a linter is supposed to behave.

Here is the 30-second test that exposed it, and it works on any cycle detector: run `no-cycle` on your full monorepo, then run it again on a known-complex subdirectory. If the subset finds more cycles than the full run, you have the same class of bug we had.

The cause: a 10-hop depth limit that wrote false "non-cyclic" entries into a shared cache, poisoning later traversals. Large scope → more files processed before the subset → more false cache entries → more cycles hidden. Small scope → clean cache → same cycles visible. next.js, 131K stars, and the headline number on its dependency graph was a lie the cache told us.

The cache bug is confirmed in source; the fix shipped in `eslint-plugin-import-next@2.3.6`. This is the run-it-yourself half of a two-part story — the [full root-cause walkthrough is here](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale). If you only read one section, read [the diagnostic test](#what-this-means-for-your-own-cycle-detector): it works on any cycle detector, not just ours.

One thing this is **not**: a type-import disagreement. Our rule and `eslint-plugin-import/no-cycle` use the *same* edge policy — both exclude `import type` edges, because type-only imports are erased at compile time and can't form a runtime cycle (`eslint-plugin-import` v2.32.0 does it at `importer.importKind === 'type'`, no-cycle.js line 93; we do it both in the AST visitor and in the SCC graph builder, so a type-only back-edge never even enters the graph). The two tools agreed on next.js: **0 cycles each**. The gap that mattered was ours-vs-ours — the full run returned 0, the 33-file subset returned 5 — and that gap is the cache bug, end to end.

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

**What the fix changes in `eslint-plugin-import-next@2.3.6`:** The ~12-hop cycle in `webpack-config.ts` is now caught. The 33-file router-reducer subset returns 5 cycles whether run in isolation or as part of the full 14,556-file repo. The gap that produced 0 on the full run is closed. Whether the fixed rule finds all 17 cycles oxlint reports is tracked via our [ground-truth corpus](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed).

**Why `eslint-plugin-import` reported 0 too — and why that's a different story.** `eslint-plugin-import/no-cycle` already defaults to `maxDepth: Infinity`, so it isn't subject to our depth bug. (If you're choosing between cycle detectors for a broader ESLint audit, the [full 17-plugin benchmark](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) covers the tradeoffs in depth.) Its 0 on next.js is, as far as we can tell from the benchmark, a *correct-for-its-design* result given the same compile-time-edge policy we use — both tools drop `import type` edges before traversal. The number that exposed our bug wasn't theirs; it was oxlint's native Rust port reporting 17, which gave us an independent reference to measure against. The 0-vs-5 we had to explain was internal: same rule, same config, same files, different scope. That is the cache bug, not a tooling disagreement.

**On type-only imports — what the rule actually does.** `import-next/no-cycle` does *not* count `import type` edges. The AST visitor returns early on `node.importKind === 'type'`, and the dependency-graph builder skips type-only and dynamic edges entirely (`if (imp.dynamic || imp.typeOnly) continue;`) — so a `import type { Foo }` back-reference never even enters the SCC graph. That is deliberate: a type-only edge is erased by the compiler and cannot produce a runtime cycle, and including it would generate false positives. If your architectural review *wants* to treat type-only back-references as cycles, that is a real position — but it is not what this rule (or `eslint-plugin-import`) does today, and there is no `ignoreTypeImports`-style toggle to flip it on. The cycles we report are runtime edges.

**Why it shipped with the wrong default:** Unit tests use small, controlled graphs — never 12 hops deep. CI stayed green. The benchmark against next.js was what surfaced it, and only because we had oxlint's count as a reference. Without an independent comparison, the silence would have looked like a clean result.

**Why this survived our own review — the uncomfortable part.** A depth cap of 10 *looks* like the conservative choice. In code review, "bound the DFS so it can't blow the stack on a pathological graph" reads as defensive engineering, and a 10-hop default reads as generous — most real cycles are 2–4 hops. The reviewer's mental model was "the cap only ever skips cycles deeper than 10, and those are rare." What that model missed is the second-order effect: a depth-truncated node was *also* being written to the acyclic cache, so the cap didn't just skip deep cycles — it taught the cache a lie that then suppressed shallow cycles elsewhere. Nobody waves through `add(file)` as dangerous. It's one line, it's in the happy path, and it's the line that turned a local performance guard into a global correctness bug. If a senior engineer has ever approved a memoization write without asking "is this result actually *final*?", they've approved this bug.

If you're already running `import-next`, the fix is an upgrade — no config change needed (the new default is `maxDepth: Number.MAX_SAFE_INTEGER`):

```bash
npm install --save-dev eslint-plugin-import-next@^2.3.6
```

The full config block and the run-it-yourself diagnostic are [below](#what-this-means-for-your-own-cycle-detector).

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

The 5 cycles in the router-reducer subset are **runtime cycles** — every edge is a value import or a re-export (`export { X } from '...'`), the kind that survives compilation. That matters because it's the reason this is a real architectural finding and not a type-graph curiosity: these are modules that genuinely depend on each other at runtime, and the only reason the full-repo run reported them as clean was the poisoned cache.

Re-exports are the easy ones to miss. A cycle that closes through `export { foo } from './bar'` is invisible to a detector that only hooks `import` statements — so the graph builder treats `export … from` as a first-class edge. The next.js `client/router.ts` ↔ `client/with-router.tsx` cycle propagates *entirely* through re-exports; without that edge the DFS never sees it. (Type-only edges are the opposite case — deliberately excluded, as covered above.)

**Benchmark harness variance.** During post-fix validation, back-to-back runs produced 218→255→301. These are total violation rows (one per file-import pair), not distinct cycles. The variance was a harness bug: `pendingCycleReports` accumulated across runs in our test tooling, not in production ESLint. Fixed by resetting state between runs. The lesson generalizes: when your *measurement* tool has state, "the rule is flaky" and "my harness is flaky" look identical until you reset between runs and watch the number stop moving.

---

## Where this bites hardest: AI-generated code

The depth-and-cache bug needs two ingredients to hurt you: import graphs that are *deep* (so the depth cap fires) and *dense* (so falsely-cached intermediates sit on many paths). Hand-written code trends shallow — humans feel the pain of a 12-hop import chain and refactor it. AI-generated code does not.

This isn't a hunch. When I benchmarked **700 AI-generated functions across 5 models from Gemini and Claude** — 7 iterations each, 332 ESLint rules — the headline finding was that **65-75% of what these models write ships a vulnerability** ([the full corpus is here](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)). Structure is the same story as security: models optimize for what *looks* clean in the snippet in front of them, not for the global graph they can't see. A barrel file reads as "good public API" to **Gemini 2.5 Pro** the same way a missing input check reads as "concise" — locally tidy, globally a trap.

Ask Claude, Gemini, or Copilot to "add a barrel file," "re-export everything from this feature folder," or "wire these modules together," and you get exactly the shape that triggers this class of bug. And the model choice doesn't help you escape it — when I ran [the same NestJS security prompt through Claude and Gemini side-by-side](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors), both produced structurally similar barrel and re-export patterns that a depth-limited cycle detector would silently pass:

- **Barrel-file sprawl.** An `index.ts` that re-exports a folder, imported by another `index.ts` that re-exports *its* folder, is how a 3-hop logical dependency becomes a 12-hop physical one. Assistants reach for barrels by default because they read as "clean public API."
- **Re-export round-trips.** Generated code frequently has module A re-export a symbol that ultimately re-imports from A — the runtime cycle that closes through `export … from`, the exact edge naive detectors miss.
- **Confident silence.** When you ask an assistant "are there circular dependencies here?", it will reason over the snippet in front of it — it cannot see the 14K-file graph, and it has no depth cap to warn you about. A green `no-cycle` run becomes the evidence the assistant's "looks clean to me" was right, when both were blind to the same deep cycle.

This is the same thesis as the rest of this series: AI assistants don't invent new failure modes, they *industrialize old ones* by generating the structures (deep barrels, re-export chains) that the tooling's blind spots were waiting for. And which model you use doesn't save you — when I broke that 700-function benchmark down by domain, the "safest" model on aggregate fixed only **45%** of the bugs it wrote while the "most dangerous" one fixed **93%**, so the rankings *inverted* depending on what you asked it to build ([per-domain breakdown here](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)). There is no "use the smart model and skip the linter" shortcut.

**Run the diagnostic on AI output — including Gemini's.** The fix is the same regardless of who wrote the code:

```bash
# 1. Let an assistant scaffold a feature (e.g. gemini -p "add a barrel file re-exporting this folder")
# 2. Lint the new folder in isolation, then as part of the whole repo:
npx eslint src/features/new-thing/ --rule '{"import-next/no-cycle": "error"}'
npx eslint src/ --rule '{"import-next/no-cycle": "error"}'
# 3. If the subset finds cycles the full run doesn't, you have the bug this article is about.
```

For the broader pattern — fix one AI-generated bug, surface two more — see [The AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).

---

_What's your version of "adding more inputs made the problem disappear" — the bug where a tool got *more* confident as it got *more* wrong, because it was caching a result it never actually verified? And did you catch it yourself, or did an independent number (a second tool, a smaller scope, a colleague's run) force you to look? Drop the story below — the "we trusted the green checkmark" ones are the ones I learn the most from._

---

_Part of the [Inside our linter benchmarks](https://dev.to/ofri-peretz/series/inside-our-linter-benchmarks) series:_
_← [Our cycle detector reported 0. The real number was 245 files.](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale) | [What Ground Truth Caught That Unit Tests Missed →](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed)_

---

📦 [`eslint-plugin-import-next`](https://www.npmjs.com/package/eslint-plugin-import-next) · [Rule docs](https://eslint.interlace.tools/docs/imports/plugin-import-next)

<!-- markdownlint-disable MD034 -->
{% cta https://github.com/ofri-peretz/eslint %}
⭐ Star on GitHub
{% endcta %}
<!-- markdownlint-enable MD034 -->

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
