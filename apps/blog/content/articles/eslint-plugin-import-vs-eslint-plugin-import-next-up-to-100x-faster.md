---
title: "eslint-plugin-import Spends 148s Finding Circular Deps in 5,000 Files. import-next Does It in 2.7s."
description: "A reproducible performance benchmark: eslint-plugin-import vs eslint-plugin-import-next across 1K/5K/10K files. The no-cycle rule goes from 148.59s to 2.71s at 5,000 files (54.8x measured, n=3). Both plugins compute strongly-connected components and both re-run per-edge BFS path-finding — I measured that disabling the old plugin's SCC check changes nothing, so the gap isn't 'no SCC at all'; the exact remaining cause is honestly unresolved, and the numbers are reproducible from the linked result JSON."
slug: "eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster-1afa"
devto_id: 3143536
published_at: "2026-01-02T14:46:40Z"
edited_at: "2026-02-05T05:32:55Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster-og.jpg"
reading_time_minutes: 4
tags:
  - "eslint"
  - "node"
  - "ai"
  - "devsecops"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Inside our linter benchmarks"
---

> **import-next series** · [← What it still gets wrong (correctness)](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong) · **You are here: the performance rewrite** · [The cache bug that hides cycles →](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale)

If your lint run takes 2+ minutes and your team skips it locally, the fix is a drop-in replacement — and it's **54.8x faster** at 5,000 files (148.59s → 2.71s, measured 2026-01-02, n=3).

Your `eslint.config.js` has a `no-cycle` rule that is commented out. Someone turned it off the week CI started timing out, left a `// TODO: too slow` next to it, and moved on.

Here is what that comment set in motion: the disabled rule wasn't blocking cycles from forming — it just stopped reporting them. Every circular dependency that landed after the comment-out shipped with zero signal. And while the rule was off, the graph kept growing.

_(I built `eslint-plugin-import-next` — which makes me the right person to benchmark it and the wrong person to trust uncritically on the numbers below. That's why the benchmark suite is public and the raw result JSON is linked in the Methodology section: check my arithmetic instead of taking 54.8x on trust.)_

### Why the disabled rule survived every code review

Nobody decided "we don't care about circular dependencies." What happened is more mundane, and that's exactly why it's universal:

1. The rule was on. It was fine at 800 files.
2. The codebase crossed a few thousand modules. Lint went from 20 seconds to two minutes. Pre-commit hooks started getting `--no-verify`'d.
3. Someone opened a PR that set `'import/no-cycle': 'off'` with the message _"unblock CI, re-enable when we have time."_

It was **approved in 40 seconds**, because the alternative was a red pipeline blocking six other people.

4. "When we have time" never arrived. The graph kept growing. New cycles landed with zero signal.

No reviewer waved through a _bug_ — they waved through a reasonable trade against a tool whose runtime got steep fast on a densely-connected graph. The fix isn't "be more disciplined in review." The fix is making the rule cheap enough that step 3 never happens.

### Why performance is a security problem

Teams don't switch because slow linting feels like a developer experience issue, not a security issue. It isn't. If lint takes 148 seconds and your engineers skip it locally, your security rules run at most once per PR — not during the hundred local edits where circular dependencies quietly accumulate. By the time a cycle surfaces, it's usually a production incident (the mechanics are in [Why no-cycle is Critical](#why-no-cycle-is-critical) below).

The performance number that should sting: **148.59s** to find cycles in 5,000 files. Once you see that number, you understand why someone turned it off. Once you see **2.71s**, you understand why they shouldn't have had to.

Here's how fast cycles accumulate once an AI assistant is writing imports: I ran `no-cycle` cold against a 1,000-file fixture built from the laziest-but-locally-correct pattern every AI codegen tool defaults to — re-exporting through the nearest barrel file — and got **273 flagged cyclic edges across 91 files**, in a corpus where every single import looked fine the moment it was written. Nobody would catch that in review. It has to be machine-checked.

> 🔄 **Drop-in replacement** — compatible with the `eslint-plugin-import` rule set, with faster graph algorithms, CWE/LLM-optimized messages, and fewer false positives/negatives.

## TL;DR

| Benchmark          | 1K Files | 5K Files  | 10K Files              |
| ------------------ | -------- | --------- | ---------------------- |
| Core Rules (9)     | 1.6x     | 3.3x      | **5.2x**               |
| Recommended Preset | 1.4x     | 3.0x      | **5.5x**               |
| **no-cycle Only**  | 25.7x    | **54.8x** | _~40-120x (projected)_ |

The **54.8x is measured** (5K: 148.59s ± 31.13s vs 2.71s ± 0.01s, n=3 — `eslint-plugin-import@2.32.0` vs `eslint-plugin-import-next@2.3.3`, measured 2026-01-02); the 10K column is a projection (we stopped running `eslint-plugin-import` at 5K — it was already ~2.5 minutes). Details, error bands, and the algorithm below.

---

## Why eslint-plugin-import is Slow

To be precise about what's actually being compared: `eslint-plugin-import` — I benchmarked the current release, `2.32.0` — is **not** naive. It already builds a strongly-connected-components (SCC) map via `@rtsao/scc` and uses it as an O(1) "are these two files even in the same SCC" pre-check before it tries to find a path — you can read the guard yourself in [`no-cycle.js`](https://github.com/import-js/eslint-plugin-import/blob/main/src/rules/no-cycle.js): `scc[myPath] === scc[imported.path]`. I ran it with that check enabled (the default; `disableScc` is off). Anyone who's read the source has grounds to call out a story that says otherwise, so here's the honest one, checked empirically rather than asserted from reading the code alone:

I re-ran the 1,000-file benchmark with `disableScc: true` to isolate what the SCC pre-check actually buys on this graph. The result: **no measurable difference** (~40s either way, across repeated runs). So on this fixture — every tenth file re-exporting through a shared barrel, which packs almost the entire graph into one giant SCC — the SCC pre-check isn't what's costing the time, and it isn't what import-next saves either. Both plugins still have to run real path-finding (`detectCycle` in the old plugin, `findShortestCyclePath` in the new one) for every edge inside a confirmed-cyclic SCC — that part is genuinely per-edge work in both, and this fixture's barrel pattern maximizes how often it fires. On 5,000 interconnected files the [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) rule alone takes **148.59s** doing that work.

## What import-next Does Differently — and What I Can't Fully Explain

`eslint-plugin-import-next` runs the same category of algorithm as the old plugin, including the same same-SCC pre-check shape. Its version is lazy and memoized per connected component — you can read it in [`computeSCCsFromFile` in `src/resolver/dependency-analysis.ts`](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-devkit/src/resolver/dependency-analysis.ts): the first file that touches a given subgraph triggers the Tarjan pass, every later file in that same subgraph is a `Map.get`, never a recompute. But I want to be precise about what this snippet does and doesn't explain, because I measured something that complicates the tidy version of this story:

```ts
// rules/no-cycle.ts — same-SCC pre-check, backed by a lazily-computed, memoized index
const srcSCC = sharedCache.sccIndex.get(normalizedFilename);
const tgtSCC = sharedCache.sccIndex.get(resolved);

// Different SCCs (or a singleton) ⇒ no cycle is possible ⇒ stop. No traversal.
if (srcSCC === undefined || tgtSCC === undefined || srcSCC !== tgtSCC) return;

// Only when the SCC guarantees a cycle exists do we pay for path-finding —
// the BFS is bounded by the SCC size, not the whole codebase, but it
// genuinely runs, per edge, every time this branch is hit.
const cyclePath = findShortestCyclePath(normalizedFilename, resolved, opts);
```

On this fixture, nearly every file lands in the same giant SCC, so the `srcSCC !== tgtSCC` early-return above rarely fires — most edges fall through to `findShortestCyclePath`, which is **not** memoized per pair; it runs a fresh, real BFS every time. That should make it more expensive on a dense graph, not less. And yet the measured result is 2.71s with a 0.01s stdDev.

Here's what I can and can't claim about why. I can prove, because I measured it directly, that the old plugin's SCC pre-check is not what's costing it time: running it with `disableScc: true` produces no measurable difference (~40s either way, repeatedly). Both plugins genuinely re-run BFS path-finding per same-SCC edge — that part of the algorithm is identical in shape between them. What I _cannot_ prove without adding profiling hooks to two third-party packages — past what a benchmark article should require of its author — is exactly which remaining factor accounts for the 54.8x: a cheaper resolver, a smaller effective SCC after import-next's barrel-aware resolution, less GC pressure from a leaner data structure, or some combination. I'd rather say that plainly than dress up a guess as an explanation. What isn't in question is the measured result itself, [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) from the linked result JSON.

Result: **2.71s** for the same 5,000 files, with a stdDev of 0.01s — tight and repeatable, even though the per-edge BFS is real work happening on every run.

---

## Benchmark 1: Core Rules (9 rules)

Both plugins configured with identical rules:

- [`no-unresolved`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-unresolved), [`named`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/named), [`namespace`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/namespace), [`default`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/default), [`export`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/export)
- [`no-named-as-default`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-named-as-default), [`no-named-as-default-member`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-named-as-default-member), [`no-duplicates`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-duplicates), [`order`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/order)

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup  |
| ------ | -------------------- | ------------------------- | -------- |
| 1,000  | 2.80s                | 1.78s                     | **1.6x** |
| 5,000  | 19.04s               | 5.76s                     | **3.3x** |
| 10,000 | 58.67s               | 11.26s                    | **5.2x** |

**Takeaway**: Even with basic rules, the performance gap grows with codebase size.

---

## Benchmark 2: Recommended Preset

Using the full `recommended` configuration from each plugin.

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup  |
| ------ | -------------------- | ------------------------- | -------- |
| 1,000  | 2.42s                | 1.78s                     | **1.4x** |
| 5,000  | 18.43s               | 6.07s                     | **3.0x** |
| 10,000 | 57.74s               | 10.57s                    | **5.5x** |

**Takeaway**: Recommended presets show similar scaling — 5.5x faster at 10K files.

---

## Benchmark 3: no-cycle Rule Only

This is where the difference is **massive**. The [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) rule detects circular dependencies.

| Files  | eslint-plugin-import (mean ± stdDev) | eslint-plugin-import-next (mean ± stdDev) | Speedup                |
| ------ | ------------------------------------ | ----------------------------------------- | ---------------------- |
| 1,000  | 27.03s ± 1.59s                       | 1.05s ± 0.01s                             | **25.7x**              |
| 5,000  | 148.59s ± 31.13s                     | 2.71s ± 0.01s                             | **54.8x**              |
| 10,000 | ~275-600s (projected)\*              | ~5-7s (projected)                         | _~40-120x (projected)_ |

_n=3, cache cleared between runs. The 5K old-plugin number carries a 21% coefficient of variation (±31s) — GC and resolver thrash dominate at ~2.5 min/run, so read 54.8x as "around 50x," not a precise constant. The new plugin's ±0.01s is the point: it isn't doing the expensive traversal, so there's almost nothing to vary._

_\*10K Projection Note: the measured 1K→5K growth (5x more files) is ~5.5x slower for the old plugin (27.03s → 148.59s) — closer to linear than the ~25x a clean O(n²) doubling-quadruples model would predict — so I'm projecting 275-600s at 10K (bracketing the measured trend against the chance a denser real graph pushes growth steeper past this point), not run directly because even the low end is 4-5 minutes per iteration. `eslint-plugin-import-next`'s 1K→5K growth (1.05s → 2.71s) is sub-linear here, so 5-7s at 10K is a reasonable band. Dividing the two ranges honestly gives ~40-120x, not a tighter number — a projection, not a measurement; the measured maximum is the 54.8x at 5K, and the title's "100x" sits inside this projected band, not the measured one._

> **The number that actually matters here isn't 54.8x — it's ±0.01s.** That's the new plugin's entire standard deviation at 5,000 files, and the BFS path-finding still runs, per edge, on every run — it's real work, not skipped work. A stdDev that tight on real, repeated per-edge traversal means that traversal is cheap and consistent, run after run, not that it isn't happening. The old plugin's ±31.13s (a 21% coefficient of variation) is a different signature entirely — GC pauses and resolver thrash from doing comparatively more expensive work per edge on the same dense graph. The variance gap is real and measured; I'm not claiming to know its full internal cause, only that it's consistent enough to trust the mean.

**Do both plugins agree on what's actually cyclic, or is one just doing less work?** I checked, because a faster wrong answer isn't a win. On the 1,000-file fixture: both plugins flag the exact same **91 files** as touched by a cycle — full agreement at the file level. They disagree on message _count_ (99 for the old plugin, 273 for the new one), but that's a reporting-granularity difference, not a detection difference: `eslint-plugin-import-next` reports once per cyclic import statement (so a file with two cycle-participating imports gets two findings), while `eslint-plugin-import` reports at most once per file — its `traversed` visited-set is shared across the whole file's checks, so once one cyclic import in a file has been reported, a second cyclic import in the same file can get silently skipped rather than separately flagged. Same 91 files, same cycles found; different granularity in how many lines get a squiggly underline.

**Takeaway**: If you use [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) (and you should), the speedup is 25x-120x depending on codebase size, with the measured maximum at 54.8x (5,000 files) — the title's "100x" sits inside the projected 10K band, not something I've clocked directly.

```text
┌────────────────────────────────────────────────────────────────┐
│ no-cycle Rule: 5,000 files                                     │
├────────────────────────────────────────────────────────────────┤
│ eslint-plugin-import:      148.59s ████████████████████████████│
│ eslint-plugin-import-next:   2.71s █                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Why no-cycle is Critical

A circular import doesn't announce itself as a bug — it announces itself as a production incident. The mechanics — module initialization order handing one file a **partial** view of the other's exports: silently `undefined` in CommonJS, a hard `ReferenceError` in native ESM — have [their own full explainer](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained), so one sentence here: the failure surfaces at runtime, far from the two files that caused it, in whichever module happened to load second. That distance is the entire cost — the on-call trace takes hours, the fix takes minutes, and the rule that would have caught it in 2.7 seconds was commented out eleven months earlier for an unrelated CI timeout.

Most teams **disable** [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) because it's too slow. But [even when the original plugin is enabled, it has correctness problems](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong) — [false negatives and false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) that give you a false sense of security. With `eslint-plugin-import-next`, you can finally enable it and trust it.

If your `no-cycle` is one of the disabled ones, this is the two-line swap that lets you turn it back on (full migration notes [below](#migration-takes-2-minutes)):

```bash
npm uninstall eslint-plugin-import
npm install --save-dev eslint-plugin-import-next
```

And once the rule is off, the cycles it _would_ have caught don't stay invisible — they just surface later, as the bugs described above. (Fair is fair, so here's the blunder-check on my own side of the board: the worst cache bug in this story was in _my_ plugin — `import-next/no-cycle` reported **0 cycles** on a 14,556-file Next.js monorepo that had them, because a depth-truncated DFS cached files as acyclic that it had never finished exploring. The five-line fix and the full forensic are in [no-cycle finds 0 cycles in Next.js (and other lies caches tell you)](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale).)

Need a framework for evaluating which rules to enable first? The [30-minute security audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) protocol walks through exactly this triage.

---

## Why AI-generated code creates circular dependencies faster

Here's why this stopped being a niche performance footnote for me. The rate at which new modules and imports enter a codebase used to be bounded by how fast humans type. It isn't anymore. When you ask an assistant — Claude, Copilot, Gemini — to "add a service," it does the locally-sensible thing every time: it re-exports through the nearest barrel (`index.ts`) and imports a sibling that imports back. Each edit looks clean in isolation and passes review. The cycle only exists in the _graph_ — which no single diff shows you and no reviewer holds in their head.

This isn't hypothetical at scale, either: [Payload CMS has 508 circular dependencies; Next.js has 17](https://ofriperetz.dev/articles/payload-508-circular-dependency-cycles) — cycles accumulate in every large JS codebase, AI-assisted or not, and the barrel-file habit is exactly what accelerates it.

The 273-cycle number from the opening is that pattern, measured: the benchmark fixture is **built from exactly this shape**. The generated 1,000-file corpus has every tenth file re-export through the shared `index.js` barrel — the AI move, encoded in a fixture, not cherry-picked after the fact. Reproduce it from the benchmark suite root (the local config already registers the plugin under the `import-next/` namespace, so a bare `npx eslint --rule` from an arbitrary directory will 404 on the rule):

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git && cd eslint-benchmark-suite
npm install && npm run generate:import
npx eslint "benchmarks/import/fixtures/1000/**/*.js" --format compact | grep -c no-cycle
# → 273
```

One caveat on how far this generalizes: every-10th-file-through-a-barrel packs files into a small number of large, densely-connected SCCs — measurably the fixture where the old plugin is slowest and the gap to import-next is widest (54.8x at 5,000 files). A sparser real-world graph — say 2% of files touching a cycle instead of this fixture's concentrated barrel pattern — will still win with `no-cycle`, but the multiple won't be 54.8x; expect something closer to the 25-30x range this benchmark shows at the smaller, less-dense 1,000-file size. The dense case matters most because it's the one AI-generated code actually produces: assistants converge on the same barrel-reexport habit, which is exactly what concentrates cycles into a few large SCCs instead of spreading them thin. That's the whole problem in one integer: barrel-re-export-plus-sibling-import is the default shape of machine-generated code, and it manufactures cycles by the hundred without a single diff ever looking wrong. It's the same failure class as the security one I measured in [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the model optimizes the local task, the global invariant is yours to enforce, [one fix quietly spawning the next](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more). You cannot review your way out of it: nobody eyeballs a 273-edge cycle set across 91 files, and certainly not on every AI-authored PR. It has to be machine-checked, and cheap enough to leave on permanently. A `no-cycle` that runs in 2.7s instead of 148s is what makes "leave it on for every AI-generated PR" a decision you can actually keep.

Want the delta on _your_ graph instead of a fixture? Take that 273 as your baseline, point your assistant of choice at the tree — _"add 10 services, each re-exporting through the nearest barrel and importing whatever siblings it needs"_ — apply the diff, re-run the `eslint --format compact | grep -c no-cycle` command above, and subtract. The increase is your model's contribution: edges that each passed review but closed a loop. Drop yours in the comments with the model and the count — I'm collecting them.

---

## Methodology

**Apple-to-apple comparison** — [full source code](https://github.com/ofri-peretz/eslint-benchmark-suite)

| Spec                  | Details                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Codebase sizes**    | 1,000 / 5,000 / 10,000 JavaScript files                                                                                                                                                                        |
| **Packages**          | `eslint-plugin-import@2.32.0` (SCC pre-check enabled — the default, `disableScc: false`) vs. `eslint-plugin-import-next@2.3.3`                                                                                 |
| **`no-cycle` config** | Default options on both — `maxDepth: Infinity` (unbounded traversal). A team running a bounded `maxDepth` (`{ maxDepth: 1 }` is a common cost/benefit setting) will see a narrower gap than the numbers below. |
| **Iterations**        | 3-5 runs per size, per plugin (the no-cycle benchmark below is n=3)                                                                                                                                            |
| **Fixtures**          | Realistic JS files with named/default imports, barrel files, cross-file dependencies                                                                                                                           |
| **Environment**       | Node v20.19.5, Apple Silicon (arm64), ESLint v9.17.0                                                                                                                                                           |
| **Run date**          | 2026-01-02 — every number in this article carries that stamp; re-run it before trusting it against newer releases                                                                                              |
| **Cache**             | Cleared between each run                                                                                                                                                                                       |
| **Variance**          | Reported as mean ± stdDev; raw runs in [the result JSON](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/import-no-cycle/2026-01-02.json)                                              |

The same suite is how I benchmark the rest of the ecosystem — including the security plugins, where I ran [17 of them against 40 real vulnerabilities](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) and published every honest loss. Same rule here: the result JSON is in the repo, so you can check my arithmetic rather than take the 54.8x on trust.

### Run It Yourself

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite
npm install
npm run generate:import
npm run benchmark:import
npm run benchmark:import-recommended
npm run benchmark:import-no-cycle
```

---

## Migration Takes 2 Minutes

```bash
# Remove old plugin
npm uninstall eslint-plugin-import

# Install new plugin
npm install --save-dev eslint-plugin-import-next
```

```javascript
// eslint.config.mjs — `configs` is a NAMED export (default export is the plugin)
import { configs } from "eslint-plugin-import-next";
export default [configs.recommended];
```

**Already had custom per-rule config under the old `import/` plugin?** The rule names are unchanged — only the namespace prefix moves from `import/` to `import-next/`. So a find-and-replace is the whole migration:

```javascript
// before — eslint-plugin-import
rules: { "import/no-cycle": ["error", { maxDepth: 3 }], "import/order": "warn" }

// after — eslint-plugin-import-next (same rule, same options, new prefix)
rules: { "import-next/no-cycle": ["error", { maxDepth: 3 }], "import-next/order": "warn" }
```

The plugin registers under the `import-next` key (you can see every rule keyed as `import-next/*` in [`configs.recommended`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-import-next)), so your existing rule options carry over verbatim — there is no per-rule option schema to relearn.

---

## Compatibility

| Surface              | Support                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                              |
| **Node**             | `>= 18.0.0`                                                                       |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0 (forthcoming, not yet GA)`, flat config          |
| **Compatibility**    | drop-in for the `eslint-plugin-import` rule set                                   |
| **Module system**    | Plugin ships CommonJS; your config can be `eslint.config.js` or `.mjs`            |
| **Oxlint**           | `no-cycle` flagship rule wired via the `interlace-import-next` port, parity-gated |

---

## Links

- 📦 [npm: eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next)
- 📊 [Benchmark suite](https://github.com/ofri-peretz/eslint-benchmark-suite)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-import-next)

## Your turn

I'm convinced the disabled-`no-cycle` config block is the single most common piece of "temporary" tech debt in large JS/TS repos — **the rule you turned off to make CI green is the one quietly costing you the most.** So I'll ask directly: **which rule did you disable to unblock CI — and how long has the `// TODO: re-enable` been sitting there?**

Drop the rule name and your file count in the comments. If it's `no-cycle`, add the before/after seconds from re-running the benchmark on your own graph — I'm collecting real-world ratios to see how far the 54.8x holds outside my fixtures. (PS: if you're not sure whether your team actually runs the full lint locally before pushing, that's usually its own answer.)

> **Part of the import-next series** — pair this with
> [eslint-plugin-import: 38M downloads, and here's what it still gets wrong](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong)
> (correctness) and
> [no-cycle finds 0 cycles in Next.js (and other lies caches tell you)](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale)
> (the cache bug that hides cycles entirely).

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever disabled `no-cycle` because it was too slow to run.
::

---

_[eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

I'm **Ofri Peretz**, a security engineering leader and the author of the Interlace ESLint ecosystem — domain-specific static analysis for security, reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
