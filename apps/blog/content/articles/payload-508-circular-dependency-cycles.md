---
title: "Payload CMS Has 508 Circular Dependencies. Next.js Has 17. Here's Why They Form in Every Large JS Codebase."
description: "Circular dependencies accumulate silently in every large JavaScript codebase. Payload has 508, Next.js has 17, Strapi has 5. They bloat your bundle, slow your tests, and cause mysterious undefined errors at runtime that disappear when you add a console.log. Here is why they form and how to find them all."
slug: "payload-508-circular-dependency-cycles"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/payload-508-circular-dependency-cycles-og.jpg?v=b3"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/payload-508-circular-dependency-cycles.jpg?v=b3"
published: true
date: "2026-05-30"
published_at: "2026-05-30T19:19:59.485Z"
tags:
  - "eslint"
  - "javascript"
  - "typescript"
  - "node"
devto_id: 3785504
tier: "T3"
series: "Inside our linter benchmarks"
canonical_url: "https://ofriperetz.dev/articles/payload-508-circular-dependency-cycles"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

We ran [madge](https://github.com/pahen/madge) — a third-party, vendor-neutral cycle detector, not my plugin — across some of the most popular open-source JavaScript projects. Here is what we found:

| Project                                              | Stars | Files analyzed | Circular dependencies |
| ---------------------------------------------------- | ----- | -------------- | --------------------- |
| [Payload CMS](https://github.com/payloadcms/payload) | 33K   | 675            | **508**               |
| [Next.js](https://github.com/vercel/next.js)         | 131K  | 14,556         | 17                    |
| [Medusa](https://github.com/medusajs/medusa)         | 27K   | 803            | 8                     |
| [Strapi](https://github.com/strapi/strapi)           | 65K   | 259            | 5                     |
| [Twenty](https://github.com/twentyhq/twenty)         | 25K   | 5,702          | 0 ✅                  |

Payload CMS has 508 circular dependencies in 675 TypeScript files. That is not a typo.

_(Methodology: `npx madge --circular --extensions ts <path>`, default config, run 2026-05-30 against each repo's then-current `main` at the package root. Cycle counts drift as these repos and madge evolve — re-run the command to compare against the current tree.)_ And nobody who works on Payload wrote a single line with the intention of creating a cycle. Every one of those 508 paths through the import graph was the result of incremental, individually reasonable decisions.

This is how circular dependencies work. They accumulate silently. The build succeeds. The tests pass. The app ships. And somewhere in that import graph, modules are pulling in code they do not need, tests are loading the entire dependency tree, and a developer is staring at an `undefined` error that only happens during initialization and disappears the moment they add a `console.log`.

Circular dependencies are the silent technical debt of every large JavaScript codebase. Here is why they form, what they quietly break, and how to find all of them.

**Jump to:** [Why famous projects have hundreds](#why-famous-projects-have-hundreds-of-them) · [What cycles silently break](#what-circular-dependencies-silently-break) · [How to find every one](#how-to-find-all-of-them) · [How to fix them](#how-to-fix-them)

---

## What a circular dependency actually is

> **A circular dependency** exists when module A imports from module B, which imports — directly or transitively — from module A.

Nobody plans one. `user.service.ts` needs a formatter from `user.utils.ts`; three sprints later `user.utils.ts` needs a type from `user.service.ts`, and the loop closes. Two reasonable imports, one cycle nobody saw form — the [full mechanics have their own explainer](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained). This piece is the audit that shows how far the problem has already spread in real codebases, and how to find every cycle in yours.

---

## The 3 patterns that create them

Cycles come from three moves, each individually reasonable ([mechanics and before/after code for all three are in the explainer](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained#the-3-patterns-that-create-them)):

1. **Barrel files** (`index.ts` re-exports) — the biggest source. Every file in a feature imports from `../user` for a clean path, and any utility the barrel re-exports can no longer safely import from the barrel without closing a loop.
2. **Shared types modules** — a `types.ts` both sides of a boundary import, which quietly grows a value import back into a service. TypeScript hides this one: `import type` is erased at compile time, and many detectors (including `eslint-plugin-import/no-cycle`) skip `import type` edges entirely — so they can report **0 cycles** on a graph that is structurally circular.
3. **Cross-feature imports** — `OrderService` reaches into `User`, `UserService` reaches into `Order`. Architecturally wrong, but it emerges one reasonable import at a time; nobody refactors the boundary, they just add the import and move on.

Keep those three names. The audit below is just these patterns at scale.

---

## Why famous projects have hundreds of them

The table at the top is not an indictment — it is a pattern (get the per-project cycle paths with `madge --circular --json`). Payload's 508 cycles are almost entirely the shared-types pattern at scale. With 675 source files, their `admin/types.ts` participates in dozens of cycles because it imports from domain modules while being imported by nearly everything in the admin layer.

Strapi's 5 cycles in their core package trace directly to barrel files: `Strapi.ts → configuration/index.ts` closes a loop because the configuration barrel re-exports modules that import from `Strapi.ts`.

Medusa's 8 cycles in core-flows are the cross-feature pattern: customer steps import from customer workflows, and those workflows import from the step index — the classic `steps/index.ts → workflows/index.ts → steps/index.ts` loop that barrel files create.

**Twenty is the outlier at 0 cycles.** They enforce strict domain boundaries and avoid cross-domain barrel files. It is achievable from the start of a project. It becomes progressively harder to retroactively enforce as the codebase grows.

---

## What circular dependencies silently break

A cycle costs you three things, none of which show up as an error:

- **Bundle bloat.** Cycles can defeat tree-shaking — a bundler can't prove which exports are unused across a cycle, so it conservatively keeps both modules and everything they pull in. Adding one **value** import to a barrel that's already in a cycle can quietly grow your bundle with no other code change, which is why bundle-size regressions appear with no obvious cause.
- **Test isolation and speed.** Loading module A loads B loads A — the whole graph. A unit test for a 50-line utility ends up dragging in the ORM, the auth layer, and the HTTP client, and the suite gets slower with every feature. Teams blame "the test framework" or "the CI machine," not the import graph.
- **Initialization-order bugs.** The insidious one. Module-init order hands one file a **partial** view of the other's exports: silently `undefined` in CommonJS, a hard `ReferenceError: Cannot access 'X' before initialization` in native ESM. The failure surfaces far from the two files that caused it, and it vanishes the moment you add a `console.log` — a heisenbug whose [full CommonJS-vs-ESM mechanics live in the explainer](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained#what-circular-dependencies-silently-break).

---

## Why they accumulate undetected

Plenty of teams have `eslint-plugin-import/no-cycle` installed and see it reporting 0 cycles.

There are two reasons they're still there:

**Reason 1: Type-only cycles are architecturally circular but have zero runtime impact.** A cycle that closes through `import type { Foo }` is erased at compile time — no bundle edge, no module load edge at runtime. Whether your detector flags it or not is a policy question: the cycle is real in the source graph but invisible in the runtime graph. The risk is that a type-only cycle becomes a value cycle the moment someone adds a value export to the same file — and that transition is invisible in code review.

**Reason 2: Depth limits silently truncate the search.** Some cycle detectors impose a `maxDepth` limit on how deep the DFS traversal goes. Cycles longer than that limit are never found — the rule exits clean and nobody knows. (Both `eslint-plugin-import` and `import-next` default to unlimited depth; the truncation risk applies to any tool or config that sets a finite cap.)

---

## How to find all of them

If you've used `eslint-plugin-import/no-cycle` and it reports 0, that may not mean your codebase is clean — it may be a [false negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) the tool's defaults are hiding. We found exactly that cache bug in our own rule: [0 cycles reported on 14,556 files, 5 on a 33-file subset of the same repo](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale). The number of cycles reported depends heavily on which tool you use and how it's configured.

The standard `eslint-plugin-import/no-cycle` rule is battle-tested and ubiquitous — the right default for most projects. It recomputes each file's import resolution per run, so the cost compounds as a monorepo grows, and cycle detection is often the first check teams drop from CI once a repo gets large enough.

> **Disclosure.** `eslint-plugin-import-next` is the plugin I maintain (part of Interlace). The madge audit numbers above come from a third-party tool on public repos; the benchmark below is mine — harness linked so you can reproduce it.

`eslint-plugin-import-next` is built for scale: it persists its resolution and strongly-connected-components cache across the _entire_ lint run instead of recomputing per file. That makes it dramatically faster and — after a [cache-poisoning bug we found and fixed](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale) — deterministic across subset and full-repo runs. Migration is mechanical (uninstall, install, rename the `import/*` rule prefixes — covered below), not a rewrite.

The scale problem is real and measured. On the `no-cycle` rule alone, `eslint-plugin-import` spends **148.59s** finding cycles in a 5,000-file synthetic corpus; `eslint-plugin-import-next` does the same work in **2.71s** — **54.8× faster** (`eslint-plugin-import@2.32.0` vs `eslint-plugin-import-next@2.3.3`, measured 2026-01-02, n=3). At 1,000 files it's 27.03s → 1.05s (25.7×); at 10,000 the old plugin projects past four minutes per run. Two and a half minutes to lint 5,000 files is exactly why cycle detection is the first check teams drop from CI. The [full benchmark — error bands, the projection method, and an honest "I can't fully explain the last 2×" caveat — is in the performance write-up](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).

The rule also fixes a cache-poisoning bug that caused non-deterministic results: the same repo, back-to-back runs, reported different cycle counts. The fix ensures consistent results whether you lint the full repo or a subset.

|                                      | eslint-plugin-import | eslint-plugin-import-next |
| ------------------------------------ | -------------------- | ------------------------- |
| Battle-tested, ubiquitous            | ✅                   | — (newer)                 |
| Drop-in compatible                   | ✅                   | ✅                        |
| oxlint plugin entry                  | —                    | ✅                        |
| Cache-stable across subset/full runs | partial              | ✅                        |
| Tuned for 10K+ file monorepos        | —                    | ✅                        |

```bash
# Remove the old plugin first to avoid namespace conflicts
# npm
npm uninstall eslint-plugin-import && npm install --save-dev eslint-plugin-import-next
# yarn
yarn remove eslint-plugin-import && yarn add --dev eslint-plugin-import-next
# pnpm
pnpm remove eslint-plugin-import && pnpm add --save-dev eslint-plugin-import-next
```

After uninstalling, rename your `import/*` rule prefixes to `import-next/*` — the rule names and options are identical, only the namespace changes, so it's a find-and-replace (otherwise those rules silently stop running). Requires Node ≥ 18 and ESLint 8, 9, or 10. The `@typescript-eslint/parser` below is only needed if you lint `.ts`/`.tsx`; a pure-JS project can drop the `parser` line.

```javascript
// eslint.config.mjs — uses 'import-next' namespace to avoid conflicts
import importNext from "eslint-plugin-import-next";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    languageOptions: { parser: tsParser },
    plugins: { "import-next": importNext },
    rules: {
      "import-next/no-cycle": "error",
    },
  },
];
```

On **[Oxlint](https://oxc.rs)**? The plugin ships an `/oxlint` entry — register it in `.oxlintrc.json`:

```json
{ "jsPlugins": ["eslint-plugin-import-next/oxlint"] }
```

```bash
# ESLint:
npx eslint src/
# Oxlint:
npx oxlint src/
```

**Why ESLint over madge?** Madge is a great audit tool — run it once, see the landscape. ESLint with `no-cycle` runs on every file save, in CI on every PR, and integrates with your editor to flag cycles as you create them. Madge tells you what you have; ESLint prevents new ones from forming. The two complement each other: use madge to see the full picture, add `import-next/no-cycle` to your ESLint config to enforce going forward.

**Diagnostic test:** Run on a complex subdirectory and compare to the full-repo result. If the subset finds more cycles — your current tool's cache or depth is hiding cycles. This is a reproducible signal that predates any particular tool; the subset test reveals what the full run misses.

---

## How to fix them

Each pattern has a matching fix — [with worked before/after code in the explainer](https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained#how-to-fix-them):

- **Barrel cycles → direct imports.** Import `../user/user.service`, not `../user`. The single highest-impact change for most codebases; barrels are a convenience the linter and bundler pay for.
- **Shared-type cycles → a dedicated types layer.** Put shared types in a module with **zero imports from your own code** (only external packages). Both sides import down into it; neither imports the other.
- **Cross-feature cycles → inversion of control.** The domain that needs the dependency defines an interface; the other implements it. More work, but it removes the architectural coupling instead of hiding it.

---

## Where to start

Run the linter against your codebase and sort findings by how many files are in each cycle. Fix the largest cycles first — they're the ones with the most shared state and the most bundling impact.

A codebase with 50 circular dependencies usually has 3–5 that are responsible for most of the blast radius. Fix those and the bundler, the tests, and the initialization order bugs often improve measurably.

---

If your codebase has grown past 10K files and you've never run a cycle detector, start with the subset test: run `no-cycle` on one complex subdirectory and compare to the full repo. If the subset finds _more_, your tool has a depth or cache issue.

This audit is the wide-angle view in the _Inside our linter benchmarks_ series. If your subset test comes back dirtier than your full run, the deep-dive on why is here: [a cache-poisoning bug that made our own detector report 0 cycles on 14,556 files](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale). And if `no-cycle` is commented out in your config because it's too slow, [the 54.8× performance rewrite](https://ofriperetz.dev/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster) is why it doesn't have to be.

**Run `npx madge --circular --extensions ts` on your own repo and drop the number in the comments — I'll bet someone beats 508.** And what's the most surprising place you've found a cycle: the data layer, the domain layer, or somewhere you never expected? If you swap in `import-next/no-cycle` and it surfaces cycles your old config reported as 0, that's the cache bug — tell me your before/after count.

---

📦 [`eslint-plugin-import-next`](https://www.npmjs.com/package/eslint-plugin-import-next) · [Rule docs](https://eslint.interlace.tools/docs/quality/plugin-import-next)

<!-- markdownlint-disable MD034 -->

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**

<!-- markdownlint-enable MD034 -->

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
