---
title: "import-next/no-cycle Reported 0 Cycles on Next.js. We Found Why — and Fixed It."
description: "Our cycle detector returned 0 on a 14K-file repo. oxlint found 17. We audited the rule and found two bugs: a 10-hop depth limit that silenced cycles longer than 10 hops, and a cache contamination bug that made results non-deterministic across runs."
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
  - "javascript"
  - "node"
  - "webdev"
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

We benchmarked `import-next/no-cycle` against `eslint-plugin-import/no-cycle` and oxlint on next.js — 131K stars, 14,556 source files. Both ESLint plugins agreed: **0 cycles**. oxlint disagreed: **17 cycles**.

We trusted the consensus. Then we scoped the same rules to a 33-file subset of the same repo and ran again. Our rule found 5+ cycles immediately.

Same config. Same files. Different scope. Different answer.

That's not a fluke — it's a symptom. We audited the rule and found two bugs. Both are now fixed. Here's what they were.

---

## Bug 1: A depth limit of 10 that silently missed 12-hop cycles

The original default in `import-next/no-cycle` was `maxDepth: 10`. Reasonable assumption: most import chains are shallow. Real codebases disagree.

Next.js's `webpack-config.ts` has a cycle approximately 12 hops deep. With `maxDepth: 10`, the DFS stops at hop 10, marks those files as explored, and reports no cycle. The traversal never reaches the closing edge that would have revealed it.

The failure mode is invisible. The rule runs, finds no violations, exits 0. No error. No warning. No indication that it stopped early and left part of the graph unexamined.

```typescript
// Old behavior (maxDepth: 10)
// File A → B → C → D → E → F → G → H → I → J → [STOP — depth exceeded]
//                                                       ↑
//                                               K → L → A  ← never reached
// Result: 0 cycles reported. The A→…→L→A cycle doesn't exist as far as the rule knows.
```

**The fix:** Change the default to `Number.MAX_SAFE_INTEGER` — effectively unlimited, matching `eslint-plugin-import`'s default of `Infinity` and oxlint's `u32::MAX`. The rule now traverses the full graph unless you explicitly set a lower limit.

```typescript
// In import-next/no-cycle — defaults after the fix
maxDepth: Number.MAX_SAFE_INTEGER,
// "Lower values are a performance escape hatch — but with our nonCyclicFiles cache,
// traversal cost is amortized, and a low cap silently misses cycles deeper than the
// limit. Set to a finite number only on huge graphs where the bench latency hurts you."
```

**Why it survived for months:** The rule shipped with green tests. Unit tests use small, controlled graphs — never 12 hops deep. CI passed. The benchmark against next.js was what surfaced it, and only because we had oxlint's output as a reference. Without a ground-truth comparison, the silence would have looked like a passing grade.

---

## Bug 2: Cache contamination that made results non-deterministic

The second bug was subtler and harder to reproduce: back-to-back runs of the same rule on the same files returned different cycle counts.

Run 1: 218 cycles.
Run 2: 277 cycles.
Run 3: 301 cycles.

The discrepancy traced to the `nonCyclicFiles` cache — a shared set that records files already confirmed acyclic, allowing O(1) rejection on repeat visits. The intent is performance: once a file's import graph is known clean, don't re-traverse it.

The problem: with a parallel file walk, the DFS from one file can populate the cache with entries from its traversal _before_ a sibling traversal has finished. When the sibling later checks the cache, it gets a hit on a file it would have visited — and skips it. If that skipped file was part of a cycle path, the cycle disappears from the report.

The result is that the cycle count depends on file processing order, which depends on the OS scheduler. Non-deterministic lint output on the same unchanged codebase is a trust-destroying result for a tool whose purpose is CI enforcement.

```typescript
// The fix: reset analysis-state caches per-file for determinism
sharedCache.nonCyclicFiles.clear();
sharedCache.pendingCycleReports.clear();
sharedCache.sccComputed = false;
// ... other cache resets

// "With oxlint's parallel file walk, file ordering is non-deterministic —
// a stale nonCyclicFiles entry from a sibling worker's DFS made the second
// (or third) lint run skip files the first run had analyzed, producing
// 218/277/301-range variance across back-to-back runs."
```

We pay one re-walk per file to get deterministic findings. Cross-run performance optimization is deferred to a run-id-keyed cache that won't contaminate across concurrent walkers.

**Why this matters for ground-truth benchmarking:** The 218/277/301 variance is why we couldn't trust our own rule's output when comparing against oxlint. A tool that reports different cycle counts on the same codebase across runs can't serve as a benchmark reference — it can't tell you whether a discrepancy is a real false negative or just scheduling noise. Fixing the non-determinism was a prerequisite for trusting the correctness comparison.

---

## What the fixed rule finds

After both fixes — unlimited depth, deterministic traversal — `import-next/no-cycle` now catches the 12-hop cycle in next.js's `webpack-config.ts` that the old version silently missed. The 33-file subset finding (5+ cycles) was the first confirmation that the fix was working correctly.

Whether it catches all 17 that oxlint reports is still under active measurement — that comparison requires a reproducible ground-truth corpus (manual cycle verification, not one tool's output) to be authoritative. That work is tracked as part of the [ILB flagship benchmark](https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b).

---

## What this means for `eslint-plugin-import`

`eslint-plugin-import/no-cycle` defaults to `maxDepth: Infinity` — so Bug 1 (the 10-hop limit) doesn't apply. Their rule already traverses the full graph.

Their 0-cycle result on next.js has a different root cause that we haven't isolated yet. It could be a different caching interaction, a difference in how they handle barrel exports, or something else entirely. We're not claiming Bug 2 applies to them without evidence — that's the analysis gap the ground-truth corpus is designed to close.

What we can say: two implementations, same config, same files, different answers from oxlint. At least one of the ESLint implementations is wrong on at least some cycles. We know which bug we fixed in ours.

---

## The lesson from both bugs

Unit tests with small graphs miss both of these. A 6-file test graph doesn't exercise 12-hop depth limits. A single-threaded test runner doesn't expose parallel cache contamination.

The only thing that caught them was a large, real-world repo compared against an independent reference tool. That's the ground-truth methodology — not test coverage on controlled inputs, but F1 measurement against real codebases where the correct answer is known independently.

If your lint rule reports silence on a 10K-file monorepo, it's worth asking whether it's doing the same work it does on 100 files. Sometimes the silence is correct. Sometimes it's a depth limit you didn't know you hit.

---

_Has a lint rule ever silently failed on your codebase — returning no errors on code you later found was wrong? What was the signal that made you look closer?_

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
