---
title: "Our no-cycle Rule Reported 0 Cycles on Next.js. oxlint Found 17. Here's the Bug."
description: "Our cycle detector returned 0 on a 14K-file Next.js repo. oxlint found 17. Auditing our own rule surfaced two bugs we've since fixed and shipped: a maxDepth:10 default that silently truncated deep cycles, and a cache populated from a partial DFS that made cycle counts non-deterministic across runs. Source diffs included; the full 0-vs-17 reconciliation is honestly flagged as still-open."
slug: "eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-import-has-38m-weekly-downloads-heres-what-it-still-gets-wrong-h21-temp-slug-1598490"
devto_id: 3779858
published_at: "2026-05-29"
cover_image: ""
social_image: ""
reading_time_minutes: 7
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
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

We ran `import-next/no-cycle` against `eslint-plugin-import/no-cycle` and oxlint on next.js — 131K stars, 14,556 source files. Both ESLint plugins agreed: **0 cycles**. oxlint disagreed: **17 cycles**.

We trusted the consensus. Then we scoped our rule to a small subset of the same repo and ran it again. It started reporting cycles — on files a whole-repo run had called clean.

Same config. Same files. Different scope. Different answer.

That's not a fluke — it's a symptom. We audited the rule and found two bugs, **both now fixed and shipped**. This post is the post-mortem on those two fixes. (The full 0-vs-17 reconciliation against oxlint is a separate, still-open piece of work; I'll be precise below about which part is shipped and which part is still measurement.)

This matters more now than it did two years ago. Circular imports used to creep in slowly, one careless `index.ts` re-export at a time. Now an AI assistant generates a barrel file in seconds — and the rule that's supposed to catch the cycle is the one quietly lying to you. If your cycle detector is wrong, the tool meant to be a backstop against AI-generated import graphs is the weakest link in the chain. (More on that below.)

---

## Bug 1: A depth limit of 10 that silently swallowed deep cycles

The original default in `import-next/no-cycle` was `maxDepth: 10`. Reasonable assumption: most import chains are shallow. Real codebases disagree.

Next.js has import chains that close into a cycle deeper than 10 hops (the one we traced through `webpack-config.ts` was around a dozen hops — I'm giving you the order of magnitude, not a benchmarked constant). With `maxDepth: 10`, the DFS stops at hop 10, marks those files as explored, and reports no cycle. The traversal never reaches the closing edge that would have revealed it.

The failure mode is invisible. The rule runs, finds no violations, exits 0. No error. No warning. No indication that it stopped early and left part of the graph unexamined.

```typescript
// Old behavior (maxDepth: 10)
// File A → B → C → D → E → F → G → H → I → J → [STOP — depth exceeded]
//                                                       ↑
//                                               K → L → A  ← never reached
// Result: 0 cycles reported. The A→…→L→A cycle doesn't exist as far as the rule knows.
```

**The fix:** Make the default effectively unlimited, matching `eslint-plugin-import`'s default of `Infinity` and oxlint's `u32::MAX`. The rule now traverses the full graph unless you explicitly set a lower limit.

```typescript
// In import-next/no-cycle, after the fix.
// defaultOptions uses Infinity; the JSON-schema default is
// Number.MAX_SAFE_INTEGER (a finite stand-in ESLint's schema validation
// accepts) — both mean "don't cap traversal".
maxDepth: Infinity,
// schema default — quoted verbatim from the rule source:
// "Lower values are a performance escape hatch — but with our nonCyclicFiles
// cache, traversal cost is amortized, and a low cap silently misses cycles
// deeper than the limit. Set to a finite number only on huge graphs where
// the bench latency hurts you."
```

**Why it survived for months:** The rule shipped with green tests. Unit tests use small, controlled graphs — never 12 hops deep. CI passed. The benchmark against next.js was what surfaced it, and only because we had oxlint's output as a reference. Without a ground-truth comparison, the silence would have looked like a passing grade.

If you're running any `no-cycle` rule today, the first thing worth checking is your effective `maxDepth`. Here's the config that traverses the full graph instead of stopping early:

```bash
npm i -D eslint-plugin-import-next
```

```js
// eslint.config.js (flat config)
import importNext from "eslint-plugin-import-next";

export default [
  {
    plugins: { "import-next": importNext },
    rules: {
      // Default is now Number.MAX_SAFE_INTEGER. Pin it explicitly so a future
      // default change can't silently cap traversal on your monorepo.
      "import-next/no-cycle": ["error", { maxDepth: Number.MAX_SAFE_INTEGER }],
    },
  },
];
```

If you're on `eslint-plugin-import`, the equivalent is `"import/no-cycle": ["error", { maxDepth: Infinity }]` — its default already is `Infinity`, so Bug 1 doesn't apply to it (more on that below). Either way, do not ship a finite `maxDepth` you can't justify against your deepest real import chain.

---

## Bug 2: Cache contamination that made results non-deterministic

The second bug was subtler and harder to reproduce: back-to-back runs of the same rule on the same files returned different cycle counts. The exact counts drifted run to run — same config, same files, same machine, different answer each time. (I'm describing the shape of the failure, not citing a committed benchmark number — the determinism work predates the result files I'd be willing to point you at, so treat the drift as the symptom, and the source diff below as the evidence.)

The discrepancy traced to the `nonCyclicFiles` cache — a shared set that records files already confirmed acyclic, allowing O(1) rejection on repeat visits. The intent is performance, and it's the whole reason this rule is fast: in our committed no-cycle benchmark it runs **25.7x faster than `eslint-plugin-import` at 1,000 files and 54.9x faster at 5,000** (Node v20.19.5, M1; `results/import-no-cycle/2026-01-02.json` in the benchmark repo). Once a file's import graph is known clean, don't re-traverse it. That speed is exactly what made the fix delicate — the naive determinism patch throws it away.

The original implementation populated that set from a depth-first traversal as it ran. The problem: a DFS from one file could mark a file non-cyclic _before_ another traversal had finished exploring the edges that closed a cycle through it. When a later visit checked the cache, it got a hit on a file it would otherwise have walked — and skipped it. If that skipped file sat on a cycle path, the cycle disappeared from the report. Because the order files get walked in isn't fixed, the set of cycles you "kept" shifted from run to run.

Non-deterministic lint output on the same unchanged codebase is a trust-destroying result for a tool whose purpose is CI enforcement.

The wrong fix — the one I tried first, and the one you'd reach for instinctively — is to clear the cache per file so a stale entry can't leak across traversals:

```typescript
// ❌ What I tried first — and why it's wrong.
// Clearing nonCyclicFiles per file does make output deterministic,
// but it destroys the O(1) fast path: every file re-walks the graph
// from scratch, and on a 14K-file repo that's the whole reason the
// rule was fast in the first place. Determinism bought with an O(n²)
// regression isn't a fix — it's a different bug.
sharedCache.nonCyclicFiles.clear();
```

The actual fix makes the cache **correct-by-construction** instead of resetting it. We stopped populating `nonCyclicFiles` from an in-progress DFS and started populating it from Tarjan's strongly-connected-components result, which is computed once per connected component and is authoritative: a file in a singleton SCC is *provably* non-cyclic, so it can be cached for the whole run; a file in a multi-file SCC is on a cycle, so it's removed from the set if an earlier incomplete pass ever added it.

```typescript
// eslint-devkit/src/resolver/dependency-analysis.ts — computeSCCsFromFile()
// Populate nonCyclicFiles from the authoritative SCC, not a partial DFS:
for (const result of newResults) {
  if (result.hasCycle) {
    // Multi-file SCC → these files ARE on a cycle. Undo any earlier
    // incomplete-DFS guess that wrongly marked them clean.
    for (const file of result.files) cache.nonCyclicFiles.delete(file);
  } else {
    // Singleton SCC → provably non-cyclic → safe to cache for the run.
    for (const file of result.files) cache.nonCyclicFiles.add(file);
  }
}
```

```typescript
// no-cycle.ts — per file, we deliberately do NOT clear nonCyclicFiles:
// it's now correct-by-construction from the SCC, so clearing it would
// only throw away the O(1) fast path. Only the per-file report-dedup
// state resets.
sharedCache.pendingCycleReports.clear();
// sharedCache.nonCyclicFiles, sccs, sccIndex — intentionally NOT reset.
```

The determinism comes from the source of truth, not from a reset: SCC membership doesn't depend on file-walk order, so two runs over the same files now agree.

**Why this matters for ground-truth benchmarking:** a tool that reports different cycle counts on the same codebase across runs can't serve as a benchmark reference — it can't tell you whether a discrepancy against oxlint is a real false negative or just scheduling noise. Making the output deterministic was a prerequisite for trusting any correctness comparison at all. You can read the determinism story in more depth in [no-cycle: cache poisoning at scale](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale).

---

## What the two fixes change, and what's still open

After both fixes — unlimited depth, deterministic traversal — `import-next/no-cycle` now traverses the deep chain in next.js that the old `maxDepth: 10` silently truncated, and it returns the same answer on every run instead of a different count each time. The scoped-subset run that first tipped us off now reproduces cleanly: the cycles it surfaces are stable, and they're the ones the depth limit had been hiding.

That's the part I'm willing to put my name on as **done and shipped**. Here's the part that is honestly *not* done: I can't yet tell you the rule returns exactly **17** on whole-repo next.js and matches oxlint cycle-for-cycle. Establishing that requires a ground-truth corpus — a set of cycles verified by hand, independent of any single tool's output — so that a disagreement can be adjudicated as a real false negative rather than a difference in how two tools define a "cycle" (re-export edges, type-only imports, and dynamic imports are all places two correct implementations can legitimately disagree). That corpus work is tracked as part of the [ILB flagship benchmark](https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b) ([blog mirror](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed)). I'd rather ship the two fixes I can defend than claim a reconciliation I haven't earned.

---

## Why this rule matters more in the AI era

Here's the part that turns this from a niche linter bug into something you should care about today.

Circular imports are exactly the kind of defect an AI assistant introduces without noticing. Ask Copilot or Claude to "add a helper that formats the user object," and a very common move is to drop it into the nearest barrel file — `utils/index.ts` — which re-exports a module that, three hops away, already imports `utils`. The model is optimizing for "this line type-checks and reads naturally in isolation." It has no global view of the import graph. It cannot see the cycle it just closed, because the cycle only exists across files it never had in context at once.

I've watched this happen repeatedly while reviewing AI-generated code: each individual edit is locally reasonable, and the cycle emerges from the *combination*. It's the same dynamic I wrote about in [the AI hydra problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) — you fix one structural issue, the assistant's next suggestion quietly reintroduces it somewhere adjacent. Import cycles are structural, invisible per-edit, and accumulate fastest precisely when code is being generated fast.

That makes the `no-cycle` rule a backstop for AI-assisted development — and a backstop that returns `0` when the real answer is `17` is worse than no backstop at all. It doesn't just miss the cycle; it actively tells the reviewer the import graph is clean. A human waving through an AI-authored PR now has a green check confirming a property that isn't true.

So the practical test, if you're letting an assistant write code into a real monorepo: scope the rule to the directory the AI just touched and run it in isolation. Don't trust a whole-repo `0`. The scoped subset that tipped us off is the same trick — a small, focused scope exercises traversal paths a whole-repo run can silently skip.

**Want to take this further than I have?** The natural next experiment is to make the AI the independent variable: ask Gemini, Claude, and Copilot each to add a helper into a barrel file in the same fixture repo, then run the scope-isolation test above and count which models close a cycle and how deep it goes. That turns this post's qualitative observation into a reproducible model-vs-model benchmark — and with a Gemini model as one of the arms plus this correctness framing, it slots straight into the [Build with Gemini](https://dev.to/challenges) challenge under `#googleai #geminichallenge`. I'm flagging the adaptation rather than claiming it: this article is the bug post-mortem; the model leaderboard is a separate piece I haven't run yet.

---

## What this means for `eslint-plugin-import`

`eslint-plugin-import/no-cycle` defaults to `maxDepth: Infinity` — so Bug 1 (the 10-hop limit) doesn't apply. Their rule already traverses the full graph. Whatever produced *their* 0-cycle result on next.js, it isn't the depth limit we fixed in ours.

I want to be careful here: I have not audited `eslint-plugin-import`'s internals, so I'm making **no claim** about why it returns 0 — not that it shares Bug 2, not that it's wrong in the same way, nothing. Diagnosing another maintainer's rule from the outside, on the strength of one disagreeing tool, is exactly the kind of unevidenced claim this whole post is arguing against. The only honest statement I can make about it is the one below.

What I can say: two ESLint implementations, same config, same files, both disagreeing with oxlint's 17. At least one of the three is wrong on at least some cycles. I know precisely which two bugs I fixed in mine, and I've shown you the source for both — that's the standard the rest of the comparison has to meet before I'll publish a verdict on it.

---

## Reproduce it yourself

I'd rather hand you the machinery than ask you to trust a screenshot. Two things are reproducible today:

```bash
# 1. The speed delta that motivated the rewrite (committed result + runner).
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite && npm install
npm run benchmark:import          # no-cycle config: benchmarks/import/configs/import-next-no-cycle.config.js
# Committed run (Node v20.19.5, M1): 25.7x at 1K files, 54.9x at 5K — results/import-no-cycle/

# 2. The depth bug, on any repo with a deep import chain:
npx eslint . --rule '{"import-next/no-cycle":["error",{"maxDepth":10}]}'   # old default — may report 0
npx eslint . --rule '{"import-next/no-cycle":["error",{"maxDepth":1e15}]}' # full traversal — finds the deep cycle
```

What I am **not** handing you yet is a committed `0-vs-17` corpus result — that file doesn't exist, because the ground-truth corpus that would make it authoritative isn't built. I'm being explicit about that gap on purpose: the speed numbers and the depth behavior are reproducible from committed artifacts; the cross-tool cycle count is an honest open item, not a published claim.

## The lesson from both bugs

Unit tests with small graphs miss both of these. A 6-file test graph never builds a chain deep enough to hit a depth limit, and it never builds an import graph big enough for a partial DFS to cache a wrong answer before the cycle-closing edge is walked.

The only thing that caught them was a large, real-world repo compared against an independent reference tool. That's the ground-truth methodology — not test coverage on controlled inputs, but measurement against real codebases where the correct answer is known independently. It's the same lesson from a different angle in [what ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed).

If your lint rule reports silence on a 10K-file monorepo, it's worth asking whether it's doing the same work it does on 100 files. Sometimes the silence is correct. Sometimes it's a depth limit you didn't know you hit.

For the determinism half of this story in more depth — why a performance optimization made the rule lie, and the full cache-poisoning failure mode — see [no-cycle: cache poisoning at scale](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale). If you're weighing `import-next` against the original on a large repo, [the speed comparison is here](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).

---

_What's the worst false `0` a tool has ever handed you — a linter, a test suite, a coverage report that said everything was fine on code you later found was broken? And if you're shipping AI-generated code right now: have you actually scoped your structural rules to what the assistant touched, or are you trusting a whole-repo green check? Tell me below — I collect these._

---

_Part of the [Inside our linter benchmarks](https://dev.to/ofri-peretz/series/inside-our-linter-benchmarks) series:_
_← [What Ground Truth Caught That Unit Tests Missed](https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b) | [no-cycle Finds 0 Cycles in Next.js (And Other Lies Caches Tell You) →](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8)_

---

📦 [`eslint-plugin-import-next`](https://www.npmjs.com/package/eslint-plugin-import-next) · [Rule docs](https://eslint.interlace.tools/docs/imports/plugin-import-next)

{% cta <https://github.com/ofri-peretz/eslint> %}
⭐ Star on GitHub
{% endcta %}

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
