---
title: "eslint-plugin-import Spends 148s Finding Circular Deps in 5,000 Files. import-next Does It in 2.7s."
description: "A reproducible performance benchmark: eslint-plugin-import vs eslint-plugin-import-next across 1K/5K/10K files. The no-cycle rule goes from 148.59s to 2.71s at 5,000 files (54.9x measured, n=3) — because an O(n²) per-file graph walk became an O(V+E) Tarjan SCC pass."
slug: "eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster-1afa"
devto_id: 3143536
published_at: "2026-01-02T14:46:40Z"
edited_at: "2026-02-05T05:32:55Z"
cover_image: "https://ofriperetz.dev/og/cover/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
social_image: "https://ofriperetz.dev/og/article/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster"
reading_time_minutes: 4
tags:
  - "eslint"
  - "performance"
  - "typescript"
  - "ai"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

> **import-next series** · [← What it still gets wrong (correctness)](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong) · **You are here: the performance rewrite** · [The cache bug that hides cycles →](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it)

Somewhere in your `eslint.config.js` there is a `no-cycle` rule that is commented
out. Someone turned it off the week CI started timing out, left a `// TODO: too
slow` next to it, and moved on. That was the right call at the time — and it's
the reason circular dependencies have been quietly accumulating in your graph ever
since.

Here's the part that should sting: that rule wasn't just slow, it was *silently
expensive*. Every cycle that landed after the comment-out shipped with zero
signal — and on the 5,000-file run below it would have cost **~145 seconds of CI
wall-clock per lint** to keep catching them (148.59s vs 2.71s). So the real bill
isn't one number. It's *both*: the CI minutes you'd burn if you left it on, and
the cycles you've been blind to because you didn't. The rewrite stops you paying
either one.

The `no-cycle` rule on 5,000 files (n=3, cache cleared between runs):
`eslint-plugin-import` takes **148.59s ± 31.13s**; `eslint-plugin-import-next`
takes **2.71s ± 0.01s** — **54.9x measured**, because an O(n²) per-file graph
walk became an O(V+E) strongly-connected-components pass. That ±31s is a real 21%
coefficient of variation on the old plugin: GC pauses and resolver thrash at 148s
are noisy, so treat 54.9x as "≈50x, comfortably," not a stopwatch-exact constant.
The new plugin's 0.01s stdDev is the tell — it isn't doing the expensive thing at
all. At 10K files the gap projects past 100x (we stopped measuring
`eslint-plugin-import` at 5K — it was already taking ~2.5 minutes per run). Full
numbers, methodology, and a drop-in migration below.

> 🔄 **Drop-in replacement** — compatible with the `eslint-plugin-import` rule set,
> with faster graph algorithms, CWE/LLM-optimized messages, and fewer false
> positives/negatives.

## TL;DR

| Benchmark          | 1K Files | 5K Files  | 10K Files           |
| ------------------ | -------- | --------- | ------------------- |
| Core Rules (9)     | 1.6x     | 3.3x      | **5.2x**            |
| Recommended Preset | 1.4x     | 3.0x      | **5.5x**            |
| **no-cycle Only**  | 25.7x    | **54.9x** | _~120x (projected)_ |

The **54.9x is measured** (5K: 148.59s ± 31.13s vs 2.71s ± 0.01s, n=3); the 10K
column is a projection (we stopped running `eslint-plugin-import` at 5K — it was
already ~2.5 minutes). Details, error bands, and the algorithm below.

---

## Why eslint-plugin-import is Slow

The original `eslint-plugin-import` runs cycle detection **per visited file**.
For every `ImportDeclaration` it walks the dependency graph outward looking for a
path back to the current file:

1. **For each file**, parse all imports
2. **For each import**, resolve the full module path
3. **For [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle)**, do a fresh depth-first walk of the reachable graph — once per file

Step 3 is the killer. There is no shared "is this pair even in the same cycle?"
structure across files, so the same edges get re-traversed thousands of times.
With `n` files each fanning out across the graph, you get roughly **O(n²)**
behavior — which is why the 5K→10K jump is *projected* to quadruple the wall-clock
time rather than double it (we measured through 5K; the 10K old-plugin run is the
one projection in this piece, flagged again where it appears in the table). On
5,000 interconnected files the
[`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle)
rule alone takes **148.59s**.

## How eslint-plugin-import-next Fixes This

The rewrite replaces the per-file re-traversal with **one** strongly-connected-components
(SCC) pass over the graph, then a cheap membership check per import. The SCC pass is
genuine **Tarjan's algorithm** — you can read it in
[`computeSCCsFromFile` in `@interlace/eslint-devkit`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-import-next)
(`src/resolver/dependency-analysis.ts`); the state object is the textbook Tarjan
shape, `index` / `stack` / `onStack` / `indices` / `lowlinks`, and it runs in
O(V+E) where V = files and E = imports.

The mechanism that actually buys the speedup is what happens **per import** once
the SCCs exist. Two files can only be in a cycle if they're in the same SCC, so
the rule checks that first and bails out in O(1) for the overwhelming majority of
edges (the source comment puts it at "~99% of imports … without reading a single
file"):

```ts
// rules/no-cycle.ts — the O(1) pre-check that replaces the per-file graph walk
const srcSCC = sharedCache.sccIndex.get(normalizedFilename);
const tgtSCC = sharedCache.sccIndex.get(resolved);

// Different SCCs (or a singleton) ⇒ no cycle is possible ⇒ stop. No traversal.
if (srcSCC === undefined || tgtSCC === undefined || srcSCC !== tgtSCC) return;

// Only when the SCC guarantees a cycle exists do we pay for path-finding —
// and the BFS is bounded by the SCC size, not the whole codebase.
const cyclePath = findShortestCyclePath(normalizedFilename, resolved, opts);
```

So the expensive graph walk (`findShortestCyclePath`) runs **only inside an SCC
that is already proven cyclic**, never across the full graph. Singleton SCCs are
marked `hasCycle: false` once and never looked at again. That's the whole O(n²) →
O(V+E) story in one `if`: the old plugin asked "is there a cycle from here?"
`n` times by walking the graph; the new one answers it from a precomputed integer
map.

Result: **2.71s** for the same 5,000 files — and a stdDev of 0.01s, because for
non-cyclic edges it never does the costly thing at all.

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

| Files  | eslint-plugin-import (mean ± stdDev) | eslint-plugin-import-next (mean ± stdDev) | Speedup             |
| ------ | ------------------------------------ | ----------------------------------------- | ------------------- |
| 1,000  | 27.03s ± 1.59s                       | 1.05s ± 0.01s                             | **25.7x**           |
| 5,000  | 148.59s ± 31.13s                     | 2.71s ± 0.01s                             | **54.9x**           |
| 10,000 | ~600s (projected)\*                  | ~5s (projected)                           | _~120x (projected)_ |

_n=3, cache cleared between runs. The 5K old-plugin number carries a 21%
coefficient of variation (±31s) — GC and resolver thrash dominate at ~2.5 min/run,
so read 54.9x as "around 50x," not a precise constant. The new plugin's ±0.01s is
the point: it isn't doing the expensive traversal, so there's almost nothing to
vary._

_\*10K Projection Note: 5K→10K doubles the file count, so O(n²) roughly quadruples `eslint-plugin-import`'s time (148.59s × 4 ≈ 600s ≈ 10 minutes) — we didn't run it because 10+ minutes per iteration is impractical. `eslint-plugin-import-next` is O(V+E) (linear in the graph), so its time roughly doubles (2.71s × 2 ≈ 5s). 600 / 5 ≈ 120x — a projection, not a measurement; the measured maximum is the 54.9x at 5K._

**Takeaway**: If you use [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) (and you should), the speedup is 25-100x depending on codebase size.

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

Circular dependencies cause:

- **Build failures** with tree-shaking
- **Runtime bugs** with undefined imports
- **Memory leaks** in bundlers
- **Test flakiness** from initialization order

Most teams **disable** [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) because it's too slow. With `eslint-plugin-import-next`, you can finally enable it.

### Why the disabled rule survived every code review

Nobody decided "we don't care about circular dependencies." What happened is more
mundane, and that's exactly why it's universal:

1. The rule was on. It was fine at 800 files.
2. The codebase crossed a few thousand modules. Lint went from 20 seconds to two
   minutes. Pre-commit hooks started getting `--no-verify`'d.
3. Someone opened a PR that set `'import/no-cycle': 'off'` with the message
   _"unblock CI, re-enable when we have time."_ It was approved in 40 seconds,
   because the alternative was a red pipeline blocking six other people.
4. "When we have time" never arrived. The graph kept growing. New cycles landed
   with zero signal.

No reviewer waved through a *bug* — they waved through a reasonable trade against a
tool that scaled quadratically. The fix isn't "be more disciplined in review." The
fix is making the rule cheap enough that step 3 never happens. That's the whole
point of the O(V+E) rewrite: it removes the incentive to turn the check off.

If your `no-cycle` is one of the disabled ones, this is the two-line swap that lets
you turn it back on (full migration notes [below](#migration-takes-2-minutes)):

```bash
npm uninstall eslint-plugin-import
npm install --save-dev eslint-plugin-import-next
```

And once the rule is off, the cycles it *would* have caught don't stay invisible —
they just surface later, as the bugs in the list above. (Caches make this worse:
a stale resolver cache can report **0 cycles** on a graph that has several. I dug
into one such case on a 14,556-file Next.js monorepo in
[5 Cycles Invisible in 14,556 Files: The Cache Bug That Hid Them](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it),
and the broader cache-poisoning failure mode in
[no-cycle finds 0 cycles in Next.js (and other lies caches tell you)](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale).)

---

## The AI-codegen angle nobody is pricing in

Here's why this stopped being a niche performance footnote for me. The rate at
which new modules and imports enter a codebase used to be bounded by how fast
humans type. It isn't anymore. When you ask an assistant — Claude, Copilot,
Gemini — to "add a service," it does the locally-sensible thing every time: it
re-exports through the nearest barrel (`index.ts`) and imports a sibling that
imports back. Each edit looks clean in isolation and passes review. The cycle only
exists in the *graph* — which no single diff shows you and no reviewer holds in
their head.

I can put a number on how fast that compounds, because the benchmark fixture is
**built from exactly that pattern**. The generated 1,000-file corpus has every
tenth file re-export through the shared `index.js` barrel — the AI move, encoded
in a fixture. Run `no-cycle` on it cold and you get a delivered, reproducible
count:

```bash
npx eslint "benchmarks/import/fixtures/1000/**/*.js" \
  --rule '{"import-next/no-cycle": "error"}' --format compact | grep -c no-cycle
# → 273
```

**273 cyclic imports across 91 files**, in a corpus where every single import
"looked fine" the moment it was written. That's the whole problem in one integer:
barrel-re-export-plus-sibling-import is the default shape of machine-generated
code, and it manufactures cycles by the hundred without a single diff ever looking
wrong. It's the same failure class as the security one I measured in
[I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
— the model optimizes the local task, the global invariant is yours to enforce,
[one fix quietly spawning the next](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).
You cannot review your way out of it: nobody eyeballs a 273-edge cycle set across
91 files, and certainly not on every AI-authored PR. It has to be machine-checked,
and cheap enough to leave on permanently. A `no-cycle` that runs in 2.7s instead
of 148s is what makes "leave it on for every AI-generated PR" a decision you can
actually keep.

Want the delta on *your* graph instead of a fixture? Take that 273 as your
baseline, point your assistant of choice at the tree — *"add 10 services, each
re-exporting through the nearest barrel and importing whatever siblings it needs"*
— apply the diff, re-run the one-liner above, and subtract. The increase is your
model's contribution: edges that each passed review but closed a loop. Drop yours
in the comments with the model and the count — I'm collecting them. For the
correctness side of this story — what `eslint-plugin-import` still gets wrong even
when it *is* enabled — see
[eslint-plugin-import: 38M downloads, and here's what it still gets wrong](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong).

---

## Methodology

**Apple-to-apple comparison** — [full source code](https://github.com/ofri-peretz/eslint-benchmark-suite)

| Spec               | Details                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| **Codebase sizes** | 1,000 / 5,000 / 10,000 JavaScript files                                              |
| **Iterations**     | 3-5 runs per size, per plugin (the no-cycle benchmark below is n=3)                  |
| **Fixtures**       | Realistic JS files with named/default imports, barrel files, cross-file dependencies |
| **Environment**    | Node v20.19.5, Apple Silicon (arm64), ESLint v9.17.0                                 |
| **Cache**          | Cleared between each run                                                             |
| **Variance**       | Reported as mean ± stdDev; raw runs in [the result JSON](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/import-no-cycle/2026-01-02.json) |

The same suite is how I benchmark the rest of the ecosystem — including the
security plugins, where I [ran 17 of them against 40 real vulnerabilities and
published every honest loss](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).
Same rule here: the result JSON is in the repo, so you can check my arithmetic
rather than take the 54.9x on trust.

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

**Already had custom per-rule config under the old `import/` plugin?** The rule
names are unchanged — only the namespace prefix moves from `import/` to
`import-next/`. So a find-and-replace is the whole migration:

```javascript
// before — eslint-plugin-import
rules: { "import/no-cycle": ["error", { maxDepth: 3 }], "import/order": "warn" }

// after — eslint-plugin-import-next (same rule, same options, new prefix)
rules: { "import-next/no-cycle": ["error", { maxDepth: 3 }], "import-next/order": "warn" }
```

The plugin registers under the `import-next` key (you can see every rule keyed as
`import-next/*` in [`configs.recommended`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-import-next)),
so your existing rule options carry over verbatim — there is no per-rule option
schema to relearn.

---

## Compatibility

| Surface              | Support                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                              |
| **Node**             | `>= 18.0.0`                                                                       |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                    |
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

I'm convinced the disabled-`no-cycle` config block is the single most common
piece of "temporary" tech debt in large JS/TS repos — **the rule you turned off
to make CI green is the one quietly costing you the most.** So I'll ask directly:
**which rule did you disable to unblock a red pipeline, what was the commit
message that justified it, and how long has the `// TODO: re-enable` been
sitting there?** Drop the trio in the comments. If it's `no-cycle`, re-run the
benchmark above on your own graph and tell me the before/after seconds — I'm
collecting real-world ratios to see how far the 54.9x holds outside my fixtures.

> **Part of the import-next series** — pair this with
> [eslint-plugin-import: 38M downloads, and here's what it still gets wrong](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong)
> (correctness) and
> [5 Cycles Invisible in 14,556 Files: The Cache Bug That Hid Them](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it)
> (the cache bug that hides cycles entirely).

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever disabled `no-cycle` because it was too slow to run.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
