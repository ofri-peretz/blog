---
title: "eslint-plugin-import Has 38M Weekly Downloads. Here's What It Still Gets Wrong."
description: "38 million weekly downloads. 3 categories of import-related bugs it silently misses. Here's what's in your codebase right now that eslint-plugin-import won't catch — and why 38 million teams haven't noticed."
slug: "eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong"
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/eslint-plugin-import-has-38m-weekly-downloads-heres-what-it-still-gets-wrong-c94"
devto_id: 3779858
published_at: "2026-05-29"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong.jpg?v=2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-import-38m-downloads-heres-what-it-still-gets-wrong.jpg?v=2"
reading_time_minutes: 9
tags:
  - "node"
  - "eslint"
  - "devsecops"
  - "security"
reactions: 0
comments: 0
views: 0
series: "Inside our linter benchmarks"
author:
---

If anyone on your team has ever set `maxDepth` on `import/no-cycle` for CI speed, your cycle-detection results are lying to you — and the output looks identical to a clean run. Nothing in the report distinguishes "we searched the whole graph and found nothing" from "we gave up at hop 10." I know exactly how convincing that silence looks, because I've shipped it: our own rewrite of this rule, [`eslint-plugin-import-next`](https://eslint.interlace.tools), carried a `maxDepth: 10` default (compounded by a cache bug) that reported **0 cycles** across Next.js's 14,556 files while [oxlint](https://oxc.rs/docs/guide/usage/linter.html)'s independent count said **17** — a 12-hop cycle in `webpack-config.ts` sat inside that silence. The full forensic of that wrong zero lives in [its own root-cause writeup](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it); this article is about the part that applies to _your_ config, today, with the upstream plugin everyone already runs.

I'm not writing a hit piece on a maintained project. The title says 38 million weekly downloads; npm's live counter says **51.3M as of 2026-07-18**. I'm leaving the title alone — undercounting the incumbent by 13 million is the kind of error I can live with. The gap between this plugin and nothing is enormous. But when we audited `no-cycle`'s behavior — first in our own rewrite, then checked it against the upstream plugin — we found three consistent classes of misses: code that is objectively dangerous or broken that the plugin silently passes, none of which show up as a red CI check.

> **`no-cycle` has a `maxDepth` option, and any config that sets it below your codebase's actual cycle depth reports a clean run — with no signal that the traversal stopped early.**

**Skip to:** [Miss 1 — `maxDepth`](#miss-1-a-lowered-maxdepth-silently-hides-deep-circular-imports) · [Miss 2 — `no-dynamic-require`](#miss-2-no-dynamic-require-fires-on-syntax-shape-not-risk) · [Miss 3 — `no-unresolved`](#miss-3-no-unresolved-silently-skips-path-alias-imports-including-typos) · [What catches what](#what-catches-what-eslint-plugin-import-misses) · [Reproduce it yourself](#reproduce-it-yourself)

---

## Miss 1: a lowered `maxDepth` silently hides deep circular imports

`import/no-cycle`'s own published default is `Infinity` — full graph traversal, no silent truncation, and on that default the rule works as advertised. We checked whether popular presets quietly override it: `eslint-config-next` doesn't touch `no-cycle` at all, and `eslint-config-airbnb-base` explicitly sets `maxDepth: '∞'` — also unbounded. Neither ships the trap this miss is really about. The trap is that `maxDepth` is a documented, ordinary-looking option, and any team performance-tuning a slow CI run reaches for it first: set a cap, watch runtime drop, ship it — and from that moment on, the truncated run and the genuinely clean run print the same output.

The Next.js zero from the intro wasn't this miss — ours took a caching defect on top of the depth default, and the root-cause writeup linked above traces both, including why the remaining 0-vs-17 gap against oxlint comes down to edge-counting policy on `import type` edges, not detection. This miss is simpler, and entirely config-side: the moment anyone — not a preset, a person — sets `maxDepth` to a number lower than the codebase's actual cycle depth, deeper cycles vanish from the report. It's a one-line, easy-to-justify change that plenty of teams make under CI-runtime pressure:

```typescript
// fileA.ts
import { processUser } from "./userProcessor";

// userProcessor.ts
import { formatData } from "./dataFormatter";

// dataFormatter.ts
import { validateSchema } from "./schemaValidator";

// schemaValidator.ts → ... → 8 more hops ...

// fileK.ts
import { something } from "./fileA"; // ← closes the cycle
```

**What `eslint-plugin-import/no-cycle` reports:** `0 violations` whenever `maxDepth` is set anywhere in your effective config to a number lower than the cycle's actual length — 10 hops caught by a cap of 10 report nothing wrong at hop 11.

**What happens in production:** The Node.js module system evaluates this cycle at runtime. Depending on which file is evaluated first, you get a partially-initialized export — `undefined` instead of a function — with no error at require-time. The bug manifests as a `TypeError: fn is not a function` in production, nowhere near the actual cycle. I hit this in a monorepo migration in Q1: a plugin-loader refactor added the closing import three weeks earlier, `no-cycle` was capped at `maxDepth: 8` for CI speed, the PR passed review clean — no lint error, no cycle warning — and staging started throwing intermittent `TypeError`s for six days before we traced it back to the cap, not the code.

The fix isn't just "set `maxDepth: Infinity`." It's checking what your effective config actually runs, not what you assume the default is:

```js
// eslint.config.js — be explicit, don't trust inherited defaults
import importPlugin from "eslint-plugin-import";

export default [
  {
    plugins: { import: importPlugin },
    rules: {
      // Infinity means traverse the full graph — no silent truncation.
      // If you need a performance cap, set it explicitly and document why.
      "import/no-cycle": ["error", { maxDepth: Infinity }],
    },
  },
];
```

Run `npx eslint --print-config src/index.ts | grep -A2 no-cycle` (point it at a real source file in your project, not at `eslint.config.js` itself) before you trust any "0 cycles" result — the number that actually runs is whatever your effective config resolves to, not the plugin's own published default. And if nobody set a cap and you still don't trust a clean zero: good instinct — that's what the [cache-poisoning story](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale) is for.

AI-generated barrel-file re-exports make a capped `maxDepth` worse at hiding this, not better: assistants optimize the local diff and manufacture deep import chains no reviewer walks. It's the same failure class we measured in [our AI-codegen study](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), where 65-75% of generated functions shipped a vulnerability that never showed in the diff.

---

## Miss 2: `no-dynamic-require` fires on syntax shape, not risk

`eslint-plugin-import` does ship a rule for this: `import/no-dynamic-require` flags any `require()` call with a non-literal argument. That's not the miss — the miss is that the rule has no mechanism to distinguish a safe pattern from a dangerous one, which means its real-world signal-to-noise ratio is bad enough that I've watched three separate teams turn it off entirely within a month of enabling it.

Here's the code `no-dynamic-require` flags, both cases, identically:

```javascript
// Both lines below get flagged identically by import/no-dynamic-require
const moduleName =
  process.env.NODE_ENV === "production" ? "./prod-config" : "./dev-config";

const config = require(moduleName); // Flagged by no-dynamic-require — but this is safe

// The pattern that actually matters:
const pluginName = req.query.plugin; // ← user input
const plugin = require(`./plugins/${pluginName}`); // Flagged identically — path traversal via require()
```

**What `eslint-plugin-import/no-dynamic-require` reports:** Both lines get the same warning — `"Calls to require() should use string literals"`. The rule has no concept of tainted input; it flags the syntax shape, not the risk.

**What actually happens on real teams:** The first pattern (env-based config path) is common and safe, and it fires the rule dozens of times across a typical codebase. Teams either add blanket `// eslint-disable-next-line` comments at every call site, or — more often — disable `no-dynamic-require` project-wide in the config after the third [false-positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) complaint in a PR review. Once it's off, the second pattern — `require()` with a user-controlled string, a real path-traversal vector that can walk `../../` out of the intended `plugins/` directory and load any `.js` file it lands on, including one an attacker dropped in a writable temp directory or a loosely-permissioned upload path — gets exactly the same silence as the safe one. The rule didn't fail to detect it. The rule detected it so indiscriminately that a human turned it off.

**The moment this actually happens:** a plugin-loader PR adds `require(`./plugins/${name}`)`, CI flags it alongside four other dynamic requires in the same diff, a reviewer skims the batch, sees the same warning repeated, and approves an inline disable comment to unblock the merge. Nobody re-reads which specific call site the disable landed on.

[`eslint-plugin-security`](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)'s `security/detect-non-literal-require` runs the identical syntax-shape check — same AST node type, same blind spot to tainted vs. safe input. Adding it doesn't fix anything; it's not a second detection capability, it's a second copy of the same one, and it fires on the same noisy env-var pattern just as often. Neither rule can do [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) — no AST-shape ESLint rule can, because "is this argument derived from `req.query` or `process.env`" is a data-flow question, not a syntax question. If the dangerous case is actually what you're trying to catch, catching it needs a data-flow-aware tool: a taint-tracking Semgrep rule scoped to `require(` calls fed by `req.*`, `process.argv`, or other request-adjacent sources, rather than a blanket syntax rule that treats `require(moduleName)` and `require(req.query.plugin)` as the same finding:

```yaml
# semgrep rule — flags require() only when the argument traces back to a request/user-input source
rules:
  - id: tainted-dynamic-require
    languages: [javascript, typescript]
    severity: ERROR
    message: "require() argument traces to user-controlled input — path traversal risk"
    mode: taint
    pattern-sources:
      - pattern: req.query.$X
      - pattern: req.params.$X
      - pattern: req.body.$X
    pattern-sinks:
      - pattern: require($ARG)
```

Keep `import/no-dynamic-require` on too — it's still worth having as a blunt first pass — but don't rely on it, or a second copy of it, to separate the safe case from the one that matters:

```
// .eslintrc-style disable convention that survives review:
// eslint-disable-next-line import/no-dynamic-require -- moduleName is env-derived, not user input
const config = require(moduleName);
```

---

## Miss 3: `no-unresolved` silently skips path-alias imports, including typos

`eslint-plugin-import/no-unresolved` is supposed to catch imports of modules that don't exist. In practice, it has a meaningful false-negative rate on path aliases, monorepo workspaces, and TypeScript path mappings — and it's the strongest of the three misses here because the failure condition is precise and the canary test below takes ten seconds to run.

Try the canary against your own repo before reading further: add `import { X } from '@app/nonexistentpath/test'` anywhere and run `no-unresolved`. If it doesn't fire, keep reading — here's why.

```typescript
// tsconfig.json has: { "paths": { "@app/*": ["./src/*"] } }

// This import resolves correctly at runtime (TypeScript + bundler handle it)
import { UserService } from "@app/services/user";

// This import has a typo — 'servics' doesn't exist
import { AuthService } from "@app/servics/auth"; // ← typo
```

**What `eslint-plugin-import/no-unresolved` reports:** No violation on either import. Because `@app/*` isn't a real Node.js module path, the default resolver can't walk it, so it skips resolution entirely on both — including the one with the typo.

**What happens:** TypeScript's own compiler will catch this at build time regardless — `tsc` reports `Cannot find module '@app/servics/auth' or its corresponding type declarations` whenever a `paths` entry in `tsconfig.json` doesn't resolve to a real file, independent of any strictness flag. But if your ESLint runs as a pre-commit hook (before `tsc`), the typo gets committed anyway — the lint gate passed, so nothing blocked the commit, and `tsc` is the thing that catches it hours or days later in CI, not the thing that stopped it at the door. I've seen this exact typo land in a pure-JS Babel project with path aliases and no TypeScript at all — no compiler backstop, just a runtime `Cannot find module` crash the first time the code path executed in staging, days after the PR merged clean.

**The fix:** Configure the resolver explicitly for your module system:

```js
// eslint.config.js — tell the resolver about your path aliases
import importPlugin from "eslint-plugin-import";

export default [
  {
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: {
          // Reads tsconfig.json path mappings — resolves @app/* correctly
          alwaysTryTypes: true,
        },
        node: true,
      },
    },
    rules: {
      "import/no-unresolved": "error",
    },
  },
];
```

This requires `eslint-import-resolver-typescript`. Without it, `no-unresolved` is quietly skipping every path-alias import in your codebase and calling that "resolved." Ran the canary at the top of this section and it didn't fire? That's the missing resolver package, not a clean codebase — install it, rerun, and the typo import should turn red immediately.

**Why this gap survives:** most teams either (a) use TypeScript, which catches this at compile time, or (b) don't have path aliases, so the default resolver works. The miss only bites teams in the gap: path aliases + no TypeScript + ESLint as the primary static check. If your ESLint runs pre-commit and `tsc` runs later (or not at all in CI), that gap is exactly where a typo import ships.

---

## How common are these misses? The benchmark numbers

Running `eslint-plugin-import` across the repos in our [ILB benchmark suite](https://eslint.interlace.tools):

- **3 rule categories** where the plugin consistently misses what other tools catch (cycle depth after a manual `maxDepth` cap, dynamic-require noise, alias resolution)
- **Both `eslint-config-next` and `eslint-config-airbnb-base` leave `no-cycle` at its unbounded default** (Next.js's config doesn't touch the rule at all; Airbnb's explicitly sets `maxDepth: '∞'`) — so the miss isn't a preset trap, it's what happens the moment a human lowers the cap for CI speed and nothing warns them what got sacrificed
- Anecdotally, teams that add a `maxDepth` cap or disable `no-cycle` on large repos most often cite CI runtime, not false positives — consistent with the performance gap we measured: [at 5,000 files, `no-cycle` runs 54.8x faster on `eslint-plugin-import-next` — 148.59s → 2.71s](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster) (`eslint-plugin-import@2.32.0` vs `import-next@2.3.3`, measured 2026-01-02, n=3). A rule that's slow enough to cap or disable is a rule that doesn't protect you.

---

## What catches what eslint-plugin-import misses

| Miss                                                  | What catches it                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep circular imports (a manually lowered `maxDepth`) | Explicit `maxDepth: Infinity` + `--print-config` before you trust a "0 cycles" result, or [`import-next/no-cycle`](https://eslint.interlace.tools)                                                                              |
| Dynamic `require()` noise hiding the dangerous case   | Keep both `import/no-dynamic-require` and [`security/detect-non-literal-require`](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) on, require a reason on every disable |
| Alias resolution false negatives                      | `eslint-import-resolver-typescript` + explicit resolver settings                                                                                                                                                                |

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-import-next"}
`npm i -D eslint-plugin-import-next` — the drop-in rewrite, if any of the three misses above is live in your repo.
::

---

## Reproduce it yourself

The depth miss is [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) on any repo with a deep import chain. `eslint-plugin-import` must already be registered in your `eslint.config.js` for `--rule` to resolve `import/` rule names — a bare `npm i` isn't enough. Also note: `Infinity` isn't valid JSON, so it can't go in a `--rule` CLI argument directly; put the uncapped config in the file instead of the CLI flag:

```bash
npm i -D eslint-plugin-import
# (assumes eslint-plugin-import is already registered as a plugin in eslint.config.js)

# Capped run — simulates a maxDepth: 5 cap someone set for CI speed:
npx eslint src/ --rule '{"import/no-cycle": ["error", {"maxDepth": 5}]}'

# Uncapped run — edit eslint.config.js to set maxDepth: Infinity, then:
npx eslint src/
```

If the outputs differ, your codebase has cycles deeper than 5 hops that a cap at or below 5 would silently miss.

For the resolver miss, the canary test:

```bash
# 1. Add a deliberate typo import to any file:
#    import { X } from '@app/nonexistentpath/test'
# 2. Run eslint-plugin-import/no-unresolved
# 3. If no violation fires, your alias namespace is invisible to the resolver
```

---

## When eslint-plugin-import is enough — and when to add a layer

We rewrote this plugin's rule surface from scratch to benchmark it, which means we've now shipped our own version of every miss above at some point — the depth default that hid a 12-hop cycle was ours before we fixed it. Fifty-one million weekly downloads means `eslint-plugin-import` is the default choice not because these gaps don't exist, but because they're narrow enough, and rare enough to notice, that most teams ship for years without hitting one. Download count is a [proxy metric](https://ofriperetz.dev/articles/proxy-metrics) — it measures adoption, not correctness, and adoption is exactly the kind of number that keeps looking healthy while a capped `maxDepth` reports clean.

But none of the three misses above are exotic. They show up wherever `maxDepth` gets lowered for CI speed and nobody checks what depth it's actually hiding, wherever a broad security rule gets disabled for being too noisy, and wherever ESLint runs before the type checker does. If you're using `eslint-plugin-import` as your only import safety net, it's worth knowing exactly where the net has holes — and running the canaries above takes less time than reading the rest of this sentence.

---

_Run this right now: `npx eslint --print-config src/index.ts | grep -A2 no-cycle` (swap in any real source file from your project) — reply below with the `maxDepth` that comes back. If it's a finite number and you don't know who set it, that's worth an afternoon of tracing._

---

_Part of the [Inside our linter benchmarks](https://dev.to/ofri-peretz/series/39642) series:_
_← [What Ground Truth Caught That Unit Tests Missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) | [eslint-plugin-import-next: Up to 100x Faster →](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster)_

---

_[eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · More at [ofriperetz.dev](https://ofriperetz.dev) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
