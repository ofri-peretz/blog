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
---

I went looking for why my linter felt slow to start. I found a TypeScript compiler in `node_modules` — once per plugin, never asked for.

My first theory was that I'd inherited it from `@typescript-eslint/utils`. My second was that it was my own fault. Both were half right — which is why the first fix didn't work.

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

Four peers, two marked optional. npm 7+ auto-installs the ones that aren't. So 24MB of `tsc` came down, for code that used the compiler for one thing: a handful of `ts.TypeFlags` integers.

One caveat: 24MB is TypeScript 6.x; TypeScript 7's Go port is 2MB. The size changed, the decision did not — force-installing a compiler nobody asked for was wrong at 24MB and is still wrong at 2MB.

I knew about the `optional` flag. I used it twice in that same object and missed the two that mattered. Nobody reviews a manifest the way they review a function.

But marking it optional didn't empty `node_modules`. There was a second door:

```bash
npm view @typescript-eslint/utils@8.0.0  peerDependencies  # eslint
npm view @typescript-eslint/utils@8.46.2 peerDependencies  # eslint + typescript
```

Somewhere in the 8.x line `utils` picked up its own **non-optional** `typescript` peer — and `8.46.2` is what I had pinned. Two independent paths to the same 24MB, either sufficient alone. The fix was not a flag. `utils` had to leave.

---

## Two numbers, and they are not the same number {#cost}

**What stops landing in `node_modules`.** The decisions below keep roughly 30MB off every consumer installing one plugin — `typescript` 24MB, `@typescript-eslint/utils` 4.5MB, `oxc-resolver` 1.5MB.

**What ships inside the tarballs.** Measured from the registry at both ends, same instrument, 20 packages:

| | Unpacked |
|---|---:|
| Aug 2 | 5,432 KB |
| **Aug 23** | **3,037 KB** |

−44.1%. And none of the four cuts caused it: a package's own `unpackedSize` excludes its dependencies, so removing one cannot move this column. That drop is dead bytes: source maps for `.ts` files the tarball never shipped, `AGENTS.md`, JSDoc in emitted `.js`.

Two wins, two axes. Conflating them is the mistake I nearly published.

---

## The four cuts {#cuts}

**`typescript`, 24MB.** Used for `ts.TypeFlags`, integer constants. Integers do not need a compiler. Inlined.

**`@typescript-eslint/utils`, 4.5MB.** The second door. Used for `ESLintUtils.RuleCreator`, one factory function. Ported in-tree.

**`oxc-resolver`, 1.5MB native binary.** Exactly one of the 19 plugins used it. Now a lazily-loaded optional peer; the other 18 never see it.

Before:

```json
"dependencies": {
  "oxc-resolver": "^11.20.0",
  "@typescript-eslint/utils": "^7.0.0 || ^8.0.0"
}
```

Now:

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

The load path moved too, timed at the pinned commit: devkit cold `require` **242ms → 13.6ms**, 433 modules down to 29. ESLint end-to-end 288 → 216ms; `oxlint` 320 → 145ms against a 68ms Rust floor, its JS-plugin overhead 252 → 77ms.

---

## The part I got wrong {#wrong}

I assumed tree-shaking would help. It cannot: ESLint plugins are CommonJS, and nothing bundles them. No build step sits between my `dist/` and your `node_modules`.

The lever is not bundle size. It is **what evaluates at require time**. An optional peer that is never installed costs zero; a 24MB one that is costs you on every lint run.

The devkit's own unpacked size even went *up*, 339KB → 377KB, while what you install collapsed. Optimising the npm-page number would have optimised the wrong one — [any proxy metric](/articles/proxy-metrics).

One trap: `removeComments` strips your `.d.ts` docs too, silently killing editor hover for every consumer. Emit to a scratch directory and copy back only the `.js`.

## What is still on the floor {#remaining}

About **49% of rule modules still load unused** under `recommended`: every plugin eagerly requires every rule, then the config picks a subset. Lazy loading measured −70ms on one plugin, unshipped — harder to do without breaking the plugin's public shape than every cut above.

Stripping JSDoc from emitted `.js` was a size win only — load time moved 16.15 → 16.01ms. I kept the change and dropped the claim.

---

Check your own tree. `npm ls typescript` in a project that only installs a linter is an uncomfortable command to run.

```bash
npm i -D @interlace/eslint-devkit
```

The [devkit is on npm](https://www.npmjs.com/package/@interlace/eslint-devkit); the [19 plugins on it](https://github.com/ofri-peretz/eslint) share one repo.

Why a slow import is a slow lint: [where the 45 seconds goes](/articles/why-eslint-plugin-import-takes-45-seconds), and [what replacing it bought](/articles/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster).
