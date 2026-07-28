---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/why-eslint-plugin-import-slow-fix.png"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/why-eslint-plugin-import-slow-fix.png"
title: "Why eslint-plugin-import Takes 58 Seconds on 10,000 Files — And Where the Time Actually Goes"
description: "A lint-performance post-mortem with the result JSON attached: 58.67s vs 11.26s on 10,000 files, and 148.59s vs 2.71s for no-cycle alone at 5,000 (eslint-plugin-import 2.32.0 vs eslint-plugin-import-next 2.3.3, measured 2026-01-02). What I can prove about the cause, and what I can't."
slug: "why-eslint-plugin-import-takes-45-seconds"
published: true
date: "2025-12-31"
tags:
  - "eslint"
  - "javascript"
  - "performance"
  - "typescript"
devto_id: 3137465
tier: "TOPIC"
series: "Inside our linter benchmarks"
canonical_url: "https://ofriperetz.dev/articles/why-eslint-plugin-import-takes-45-seconds"
author:
---

> **import-next series** · [Correctness: what the incumbent still gets wrong](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong) · [The full benchmark](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster) · **You are here: where the time goes** · [The cache bug that hid cycles →](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale)

**This article used to open with a bar chart: 45.0s against 0.4s, "100x faster, not a typo." There is no result file behind either number. So here is the same post-mortem with the JSON attached — and the honest version is worse for the incumbent and worse for my own plugin at the same time.**

The URL still says 45 seconds. It has readers, and breaking their links to make my filing look tidier is a bad trade. The chart is what got deleted.

## What the benchmark actually recorded

One run on generated fixtures, cache cleared between iterations: `eslint-plugin-import@2.32.0` against `eslint-plugin-import-next@2.3.3`, on Node v20.19.5 / ESLint 9.17.0 / darwin-arm64, **measured 2026-01-02**.

| Workload                           | `eslint-plugin-import` | `eslint-plugin-import-next` | Runs |
| ---------------------------------- | ---------------------- | --------------------------- | ---- |
| 9 core rules, 10,000 files         | **58.67s**             | 11.26s                      | n=5  |
| `recommended` preset, 10,000 files | **57.74s**             | 10.57s                      | n=3  |
| `no-cycle` only, 5,000 files       | **148.59s** ± 31.13s   | 2.71s ± 0.01s               | n=3  |
| `no-cycle` only, 1,000 files       | 27.03s ± 1.59s         | 1.05s ± 0.01s               | n=3  |

Two things fall out of that table before any theory does.

**45 seconds was never the ceiling.** It is a point on a curve that ends in minutes. And **one rule dominates everything**: nine rules across 10,000 files cost 58.67s, while [`no-cycle`](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules/no-cycle) alone, on half as many files, costs 148.59s. Switching off that single rule buys more than switching off the other eight combined — which is exactly why it is the rule teams switch off.

My plugin is not 0.4s either. It is 11.26s on the same 10,000 files: a 5.2x gap, not a 100x one. The 54.8x shows up only where the graph work is, on `no-cycle` at 5,000 files. I built the fast one, which makes me exactly the wrong person to take on trust about the slow one — so every number above has a result file behind it, and the one number that never did is the one I deleted from the top of this article.

## Where the time goes, and where it doesn't

**It is not a missing graph algorithm.** `eslint-plugin-import` is not naive. It builds a strongly-connected-components map and uses a same-SCC test as an O(1) "can these two files even form a cycle" guard before it goes looking for a path. I measured what that guard is worth instead of assuming: re-running the 1,000-file case with `disableScc: true` moved the wall clock by nothing I could measure. That is the one figure here I cannot hand you a file for — an ad-hoc re-run, not a recorded benchmark — so read it as a direction, not a measurement. The tidy story — old plugin brute-forces, new plugin is clever — is not what the stopwatch says.

**It is not that the fast plugin skips the work.** Once two files sit in the same component, a cycle is guaranteed to exist, and both plugins then run a real path search per edge, on every run (`detectCycle` in the incumbent, `findShortestCyclePath` in `eslint-plugin-import-next`). On a barrel-heavy graph that branch fires constantly for both of them.

**What I cannot prove** is which remaining factor accounts for the last order of magnitude: cheaper resolution, a smaller effective component after barrel-aware resolution, less garbage-collection pressure, or some mix. Settling it would mean bolting profiling hooks into two third-party packages, which is more than a benchmark should ask of the person running it. The result itself is measured and [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) from the linked JSON; the mechanism behind the tail of the gap stays open, and I would rather leave the hole visible than fill it with a guess that reads well.

One caveat that cuts against my own numbers: the fixture is a worst case on purpose. Every tenth file re-exports through a shared barrel, which packs most of the graph into a few large, dense components — the shape that maximizes per-edge path-finding for both plugins. A sparser real-world graph narrows the gap. It is also the shape most machine-written code converges on, and it accumulates: [Payload CMS carries 508 circular dependency cycles; Next.js carries 17](https://ofriperetz.dev/articles/payload-508-circular-dependency-cycles).

## Why a slow rule becomes a deleted rule

Nobody switches off cycle detection because they stopped caring about cycles. They switch it off in a pull request titled "unblock CI", the pipeline turns green, and the number the team is judged on now reports a healthy codebase — [the textbook shape of a measure that has become a target](https://ofriperetz.dev/articles/goodharts-law-explained). The cycles keep landing; they just stop being reported, and they resurface later as a runtime failure far from the two files that caused it: [module initialization order handing one file a partial view of the other](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained), silently `undefined` in CommonJS, a hard `ReferenceError` in native ESM.

## The migration is two commands and one prefix

```bash
npm uninstall eslint-plugin-import
npm install --save-dev eslint-plugin-import-next
```

```javascript
// eslint.config.mjs — `configs` is a NAMED export; the default export is the plugin itself
import { configs } from "eslint-plugin-import-next";
export default [configs.recommended];
```

Already running custom per-rule options? Only the namespace prefix moves. Rule names and option schemas are unchanged, so find-and-replace is the whole migration:

```javascript
// before
rules: { "import/no-cycle": ["error", { maxDepth: 3 }], "import/order": "warn" }

// after
rules: { "import-next/no-cycle": ["error", { maxDepth: 3 }], "import-next/order": "warn" }
```

A correction while I am here: the snippet this article used to carry read `importNext.configs.recommended` off the default import. The default export is the plugin object — `meta` and `rules`, no `configs` — so that line fails at config load. The version above is the one that works. If you tried the old one and gave up, that was on me, not on your setup.

Where the two plugins disagree on findings rather than on wall clock is a separate question, with its own [false positives and false negatives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn); that comparison lives in [what eslint-plugin-import still gets wrong](https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong). Credit where it is due in the meantime: at 51,330,539 weekly downloads (npm downloads API, week of 2026-07-12 to 18) the incumbent is the most-installed plugin in this ecosystem by a distance. That number measures reach, not runtime — downloads are [a proxy metric](https://ofriperetz.dev/articles/proxy-metrics) — but it is reach the project earned.

## Don't take the table on trust

Our own claims registry flags the 25.7x row with "re-verify recommended": last verified 2026-01-02, well past the registry's 90-day threshold, and both packages have shipped releases since. A clean 100x is a winning position, and a winning position is exactly when a chess player checks the line one more time. I skipped that check for longer than I should have, and the worst bug in this story turned out to be mine: `import-next/no-cycle` reported **0 cycles** on a 14,556-file Next.js monorepo that had them, because a depth-truncated search cached unexplored files as clean. [Five-line fix, full forensic](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale).

So re-run the fixtures rather than trusting the table:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite
npm install
npm run generate:import
# n=3 matches the table above; the 10,000-file arm alone runs 10+ minutes on the incumbent
node scripts/run-benchmark.js import-no-cycle --iterations=3
```

Then run it where it actually decides something — your repository, both plugins, cold cache:

```bash
time npx eslint --no-cache .
```

If your delta looks nothing like mine, that is worth knowing: post your file count and both timings, and I will add them to the real-world ratios I am collecting.

**Read next:** if you just want this running today, the [getting-started guide](https://ofriperetz.dev/articles/getting-started-eslint-plugin-import-next) is the short path. If you want the error bands, the `disableScc` experiment and the raw result JSON, they are in [the full benchmark write-up](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-import-next"}
📦 `npm install --save-dev eslint-plugin-import-next` — then turn `no-cycle` back on and leave it on.
::

---

- 📦 [npm: eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next)
- 📊 [Benchmark suite + raw result JSON](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/import-no-cycle/2026-01-02.json)
- 📖 [Full rule docs](https://eslint.interlace.tools/docs/quality/plugin-import-next/rules)

---

_[eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

I'm **Ofri Peretz**, a security engineering leader and the author of the Interlace ESLint ecosystem — domain-specific static analysis for security, reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
