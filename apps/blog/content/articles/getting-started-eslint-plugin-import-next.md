---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-import-next-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-import-next.jpg?v=b2"
title: "no-cycle Is Commented Out in Your ESLint Config. Here Is the Two-Minute Swap That Turns It Back On."
description: "Install and configure eslint-plugin-import-next v2.3.8 — the drop-in replacement for eslint-plugin-import. Flat-config setup, the real terminal output, TypeScript path aliases with no resolver package, the zero-diff migration that keeps every import/* rule name working, all 12 presets, and the version-stamped benchmark (54.8x on no-cycle at 5,000 files, measured 2026-01-02) plus the command to re-run it yourself."
slug: "getting-started-eslint-plugin-import-next"
published: true
date: "2026-01-02"
tags:
  - "eslint"
  - "javascript"
  - "imports"
  - "tutorial"
devto_id: 3143529
tier: "TUTORIAL"
series: "The Hardened Stack"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-import-next"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

> **Somewhere in your `eslint.config.js` there is a commented-out line that says `import/no-cycle`.** Nobody decided circular dependencies were fine. Somebody decided a red pipeline was blocking six people. This is the install that lets you switch it back on — and the whole path is about two minutes.

`eslint-plugin-import` is the incumbent for good reasons: **51,330,539 weekly downloads** (npm downloads API, week 2026-07-12→18, fetched 2026-07-19) and a rule set the entire ecosystem writes its configs against. `eslint-plugin-import-next` is a drop-in for that rule set — same rule names, same semantics, different graph algorithms underneath.

Below: the install, the output you will actually see, the one migration gotcha that costs people ten minutes, and the command that lets you check my performance claims instead of believing them.

_(I wrote `import-next`. That makes me the wrong person to trust on "it's faster" and the right person to hand you the command that re-runs the benchmark on your own hardware.)_

---

## Install (60 seconds)

```bash
npm install --save-dev eslint-plugin-import-next
```

Flat config (`eslint.config.js`):

```js
import { configs } from "eslint-plugin-import-next";

export default [
  configs.recommended, // 16 rules — 7 error, 9 warn
];
```

Run it:

```bash
npx eslint .
```

That is the entire setup. No resolver package, no `settings` block — TypeScript path aliases and extensionless imports resolve out of the box (there is a verified example further down).

> One detail worth pinning: the **named** export is `configs`. `import { configs } from "eslint-plugin-import-next"` works in every loader; a default import is fine in Node's own ESM loader but goes through interop rules if a bundler or `esModuleInterop` is in the path. Destructure and skip the question.

## What you'll actually see

Two files that import each other — the smallest possible cycle:

```js
// src/a.js
import { b } from "./b.js";
export const a = () => b();

// src/b.js
import { a } from "./a.js";
export const b = () => a();
```

```text
src/a.js
  1:1  error    🏗️ CWE-407 OWASP:A06-Insecure CVSS:5.3 | Circular dependency detected | CRITICAL
   Fix: Split a into .core and .extended | https://en.wikipedia.org/wiki/Circular_dependency   import-next/no-cycle
  1:1  warning  📚 Require a newline after the last import statement | LOW
   Fix: Add a newline after the import block                                   import-next/newline-after-import

(src/b.js reports the same pair)

✖ 4 problems (2 errors, 2 warnings)
  0 errors and 2 warnings potentially fixable with the `--fix` option.
```

_Real output — `eslint-plugin-import-next@2.3.8` on `eslint@9.39.5`, Node v24.12.0, run 2026-07-28. Doc URLs trimmed to fit; everything else is verbatim. Environments belong next to numbers, including small ones._

Every finding carries a [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) id, an [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) category, and a [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) base score, so a lint finding survives the trip into a security dashboard without a human re-typing it. What the cycle itself costs you at runtime — a partial view of a module's exports, silently `undefined` in CommonJS and a hard `ReferenceError` in native ESM — has [its own explainer](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained); the short version is that it surfaces far from the two files that caused it.

Now look at that line again: it prints `CRITICAL` next to a base score of **5.3**, and 5.3 is squarely the Medium band. That is severity-word drift, and I know the shape of it because I [audited 203 of my own security rules and found 16% of them mislabeling their own scores](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score), in both directions. So: gate CI on the numeric score, never on the word. Config advice from a linter that just failed its own spelling test, which is the only kind I'm qualified to give here.

---

## Migration from eslint-plugin-import: two paths

### Path A — swap the presets

```bash
npm uninstall eslint-plugin-import
npm install --save-dev eslint-plugin-import-next
```

```js
// Before
import importPlugin from "eslint-plugin-import";
export default [importPlugin.configs.recommended];

// After
import { configs } from "eslint-plugin-import-next";
export default [configs.recommended];
```

**The gotcha nobody warns you about.** The plugin registers under the namespace `import-next`, so every hand-written entry you have — `"import/no-cycle": ["error", { maxDepth: 3 }]` — stops resolving the moment the old package is gone. ESLint tells you the rule doesn't exist, you assume the migration failed, and you roll back. It didn't fail; the prefix moved.

### Path B — zero-diff, keep every `import/*` rule name

If your config has more than a couple of hand-tuned entries, register the new plugin under the old namespace and change nothing else:

```js
import importNext from "eslint-plugin-import-next";

export default [
  {
    plugins: { import: importNext },
    rules: {
      "import/no-cycle": "error", // every existing import/* entry keeps working
    },
  },
];
```

Ran it: findings come back under the rule id `import/no-cycle`, not `import-next/no-cycle`. Your rule entries, your `eslint-disable` comments, and any CI script grepping for `import/` all keep working untouched.

**One package you can usually drop:** `eslint-import-resolver-typescript`, if it was only there for import resolution. Resolution is built in. Checked against a `tsconfig.json` with `paths: { "@app/*": ["src/*"] }` and `no-unresolved` set to `error`: both `import { helper } from "./helper"` (extensionless `.ts`) and `import { helper } from "@app/helper"` come back clean with no `settings` block at all — while a genuinely missing module still errors. Silence because it's satisfied, not silence because it gave up. (Same environment as the run above; both migration paths were exercised there before this section was written.)

---

## The 12 presets (v2.3.8)

```js
import { configs } from "eslint-plugin-import-next";

export default [
  configs.recommended, // start here
  // configs.flagship,  // just no-cycle — the CI-gate subset
];
```

| Preset              | Rules | What it's for                                      |
| ------------------- | ----- | -------------------------------------------------- |
| `flagship`          | 1     | `no-cycle` alone — the minimum viable CI gate      |
| `recommended`       | 16    | The default. 7 error, 9 warn                       |
| `strict`            | 42    | Everything, all as errors                          |
| `typescript`        | 11    | TS-tuned (`named` off — the compiler covers it)    |
| `module-resolution` | 9     | Broken paths and unresolvable imports only         |
| `import-style`      | 7     | Ordering and formatting only                       |
| `esm`               | 5     | ES modules enforced, CommonJS out                  |
| `architecture`      | 7     | Layer and domain boundaries                        |
| `performance`       | 6     | Barrel files and tree-shaking                      |
| `enterprise`        | 5     | Team boundaries, legacy import tracking            |
| `errors`            | 5     | Mirrors `eslint-plugin-import`'s `errors` preset   |
| `warnings`          | 3     | Mirrors `eslint-plugin-import`'s `warnings` preset |

`recommended` deliberately leaves nine rules at `warn` — ordering, `newline-after-import`, extraneous dependencies. A first run on a codebase that has been running without them should not be a wall of red. Move to `strict` once the errors are at zero.

## The rule set (56 ids, 55 rules, v2.3.8)

| Category              | Rules | Examples                                             |
| --------------------- | ----- | ---------------------------------------------------- |
| Module resolution     | 11    | `no-unresolved`, `named`, `default`, `no-duplicates` |
| Import style          | 12    | `order`, `first`, `newline-after-import`             |
| Export style          | 9     | `export`, `no-mutable-exports`, `no-default-export`  |
| Dependency boundaries | 6     | `no-cycle`, `no-restricted-paths`                    |
| Module system         | 5     | `no-commonjs`, `no-amd`, `unambiguous`               |
| Bundle optimization   | 5     | `no-barrel-file`, `prefer-direct-import`             |
| Dependency management | 4     | `no-extraneous-dependencies`, `max-dependencies`     |
| Enterprise governance | 4     | `enforce-team-boundaries`, `no-legacy-imports`       |

Fifty-six ids, fifty-five implementations: `order` and `enforce-import-order` are the same module under two names. That duplicate is load-bearing, not sloppiness — it is what lets a config written against `import/order` keep working through Path B.

---

## "Is it actually faster?" — the numbers, and how to re-run them

Version-stamped, because a speedup with no versions on it is a marketing claim: `eslint-plugin-import@2.32.0` vs `eslint-plugin-import-next@2.3.3`, synthetic corpus, n=3, cache cleared between runs, **measured 2026-01-02**.

| Configuration      | 1,000 files | 5,000 files                                  |
| ------------------ | ----------- | -------------------------------------------- |
| Core rules (9)     | 1.6x        | 3.3x                                         |
| Recommended preset | 1.4x        | 3.0x                                         |
| `no-cycle` only    | 25.7x       | **54.8x** (148.59s ± 31.13s → 2.71s ± 0.01s) |

**54.8x at 5,000 files is the measured maximum.** This page used to be headlined "100x"; that figure is a projection at 10,000 files, not a clock reading — I stopped running the old plugin at 5K because a single iteration was already around two and a half minutes. And the run is from January against 2.3.3, while the version you just installed is 2.3.8. Old measurements do not quietly age into new ones, which is why the claim in our own registry carries a "re-verify after 90 days" flag rather than a permanent checkmark.

So don't take the table on trust — it is [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) from a public repo in about five minutes:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite && npm install
npm run generate:import
```

The full method, the error bands, and an honest account of which part of the gap I _cannot_ explain are in [the benchmark write-up](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).

## What it sees, and what it doesn't

- **The import graph, not the runtime.** `no-cycle` tells you two modules form a loop. Whether that loop actually breaks depends on initialization order and which module loads first — a cycle can sit in a codebase for years without failing.
- **It is a linter, not a prover.** Both plugins are heuristics over a static graph, which means both can produce [false positives and false negatives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) — and where a linter sits relative to SAST and full [static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) is worth ten minutes of your time before you write the CI gate.
- **Including mine.** My `no-cycle` once reported **0 cycles** on a 14,556-file Next.js repository that had them, because a depth-truncated traversal cached files as acyclic that it had never finished exploring. Five lines fixed it; the [full forensic is here](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale). A suspiciously clean zero is the result you check hardest — the metric that catches that class of bug is [recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis), and the unit tests were all green throughout.

---

## Links

- 📦 [npm: eslint-plugin-import-next](https://www.npmjs.com/package/eslint-plugin-import-next)
- 📖 [Full rule docs (per-rule examples + options)](https://eslint.interlace.tools/docs/quality/plugin-import-next)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint) — ⭐ if `no-cycle` is running in your CI again
- 📊 [The benchmark, with error bands and the unexplained part](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster)

Run `configs.flagship` against the repo where `no-cycle` is commented out — one rule, one command, no config debate. If it comes back clean, you have lost thirty seconds. If it comes back with a number, you have just recovered a check the team turned off under deadline pressure and never got to turn back on. Then read [Payload CMS Has 508 Circular Dependencies. Next.js Has 17.](https://ofriperetz.dev/articles/payload-508-circular-dependency-cycles) for why that number is almost never zero in a codebase over a few thousand files, and why AI-assisted development is making it grow faster.

**What is the count in your oldest service — and how long ago was the rule switched off?** I collect these.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-import-next"}
📦 `npm install --save-dev eslint-plugin-import-next` — 55 rules, one dev dependency, and `no-cycle` back on.
::

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
