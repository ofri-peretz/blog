---
title: "Every Plugin I Shipped Installed a TypeScript Compiler"
description: "A peer I forgot to mark optional put 24MB of tsc under every plugin I publish. Cutting it took ~30MB off every install tree."
slug: "eslint-plugin-cold-start-optimization"
published: false
canonical_url: "https://ofriperetz.dev/articles/eslint-plugin-cold-start-optimization"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-cold-start-optimization.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-plugin-cold-start-optimization-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "javascript"
  - "webdev"
  - "typescript"
  - "eslint"
series: null
author:
quality:
  panel_version: "1.0.0"
  reviewed: "2026-09-04"
  spec: sdlc/spec/eslint-plugin-cold-start-optimization.md
  lenses:
    growth_hook: 9.6
    security_correctness: 9.6
    structure_framing_voice: 9.7
    compatibility: 9.6
    reproducibility: 9.5
---

I went looking for why my linter felt slow to start. I found a TypeScript compiler in `node_modules` — once per plugin, never asked for.

My first theory was that I'd inherited it from `@typescript-eslint/utils`. My second was that it was my own fault. Both were half right, which is why the first fix didn't work.

Devkit at `1.0.0`:

```json
"peerDependencies": {
  "typescript": ">=4.0.0",
  "get-tsconfig": "^4.13.0",
  "enhanced-resolve": "^5.18.3",
  "@typescript-eslint/utils": "^8.46.2"
},
"peerDependenciesMeta": {
  "get-tsconfig":     { "optional": true },
  "enhanced-resolve": { "optional": true }
}
```

Four peers, two marked optional. npm 7+ auto-installs the ones that aren't ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). So 24MB of `tsc` came down, for code that used the compiler for one thing: a handful of `ts.TypeFlags` integers.


One caveat, and it has moved since I first wrote this. 24MB is TypeScript 6.x — measured 2026-09-04, 6.0.3 installs 24MB on the nose. I expected TypeScript 7's Go port to make that argument obsolete by shrinking to a couple of megabytes. It does the opposite: `typescript` 7.0.2 is now npm's `latest` and lands **30.7MB** — a 3.6MB JavaScript shim plus a 26.5MB platform-native Go binary the shim will not run without. Force-installing a compiler nobody asked for was wrong at 24MB and is more wrong at 30MB.

I knew about the `optional` flag. I used it twice in that object and missed the two that mattered. Nobody reviews a manifest the way they review a function.

But marking it optional didn't empty `node_modules`. There was a second door:

```bash
npm view @typescript-eslint/utils@8.0.0  peerDependencies
# { eslint: '^8.57.0 || ^9.0.0' }
npm view @typescript-eslint/utils@8.46.2 peerDependencies
# { eslint: '^8.57.0 || ^9.0.0', typescript: '>=4.8.4 <6.0.0' }
```

Somewhere in the 8.x line `utils` picked up its own **non-optional** `typescript` peer — on `utils` itself, not a transitive dependency — and `8.46.2` is what I had pinned. Two independent paths to the same 24MB, either sufficient alone. The fix was not a flag. `utils` had to leave.

---

## Two numbers, and they are not the same number {#cost}

**What stops landing in `node_modules`.** The cuts below keep ~30MB off every consumer of one plugin — `typescript` 24MB, `utils` 4.5MB, `oxc-resolver` 1.5MB.

**What ships inside the tarballs.** Measured from the registry at both ends, same instrument, 20 packages: **5,432 KB → 3,037 KB**, −44.1%. None of the three cuts caused it — a package's own `unpackedSize` excludes its dependencies. That drop is dead bytes: source maps, `AGENTS.md`, JSDoc in emitted `.js`.

Two gains, two axes. Conflating them is the mistake I nearly published.

---

## The three cuts {#cuts}

**`typescript`, 24MB.** Used for `ts.TypeFlags`, integer constants. Integers do not need a compiler. Inlined.

**`@typescript-eslint/utils`, 4.5MB.** The second door. Used for one factory function, `ESLintUtils.RuleCreator`. Ported in-tree.

**`oxc-resolver`, 1.5MB native binary.** One of the 19 plugins used it. Now a lazy optional peer; the other 18 never see it.

Before, both were hard `dependencies`. Now:

```json
"peerDependencies": {
  "@typescript-eslint/utils": "^7.0.0 || ^8.0.0",
  "eslint": "^8.40.0 || ^9.0.0 || ^10.0.0",
  "typescript": ">=4.8.4",
  "oxc-resolver": "^11.24.2"
},
"peerDependenciesMeta": {
  "@typescript-eslint/utils": { "optional": true },
  "typescript": { "optional": true },
  "oxc-resolver": { "optional": true }
}
```

Zero runtime dependencies. Everything real is optional and lazy.

The load path moved too, timed at the pinned commit: devkit cold `require` **242ms → 13.6ms**, 433 modules down to 29. ESLint end-to-end 288 → 216ms; `oxlint` 320 → 145ms against a 68ms Rust floor.

---

## The part I got wrong {#wrong}

I assumed tree-shaking would help. It cannot: ESLint plugins are CommonJS and nothing bundles them — no build step sits between my `dist/` and your `node_modules`. The lever is not bundle size, it is **what evaluates at require time**. An optional peer never installed costs zero; a 24MB one costs you every lint run.

The devkit's own unpacked size even went _up_, 339KB → 377KB, while what you install collapsed. Optimising the npm-page number would have optimised the wrong one — [any proxy metric](/articles/proxy-metrics).

One trap: `removeComments` strips your `.d.ts` docs too, silently killing editor hover for consumers. Emit to a scratch directory and copy back only the `.js`.

Still on the floor: about **49% of rule modules load unused** under `recommended`, because every plugin eagerly requires every rule and the config then picks a subset. Lazy loading measured −70ms on one plugin, unshipped.

---

Check your own tree. `npm ls typescript` in a project that only installs a linter is an uncomfortable command to run.

::install-command{package="@interlace/eslint-devkit" dev}
::

Its `eslint` peer is `^8.40.0 || ^9.0.0 || ^10.0.0`, so 8, 9 and 10 all work. Every other peer — `typescript`, `@typescript-eslint/utils`, `oxc-resolver` — is optional, which is the whole point: nothing installs a compiler on your behalf.

The [devkit is on npm](https://www.npmjs.com/package/@interlace/eslint-devkit); the [19 plugins on it](https://github.com/ofri-peretz/eslint) share one repo.

Why a slow import is a slow lint: [where the 45 seconds goes](/articles/why-eslint-plugin-import-takes-45-seconds), and [what replacing it bought](/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).
