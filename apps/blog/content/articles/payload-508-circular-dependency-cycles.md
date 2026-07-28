---
title: "Payload CMS Has 508 Circular Dependencies. Next.js Has 17. Here's Why They Form in Every Large JS Codebase."
description: "Circular dependencies accumulate silently in every large JavaScript codebase. Payload has 508, Next.js has 17, Strapi has 5. They bloat your bundle, slow your tests, and cause mysterious undefined errors at runtime that disappear when you add a console.log. Here is why they form and how to find them all."
slug: "payload-508-circular-dependency-cycles"
published: true
date: "2026-05-30"
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

| Project | Stars | Files analyzed | Circular dependencies |
|---------|-------|----------------|-----------------------|
| [Payload CMS](https://github.com/payloadcms/payload) | 33K | 675 | **508** |
| [Next.js](https://github.com/vercel/next.js) | 131K | 14,556 | 17 |
| [Medusa](https://github.com/medusajs/medusa) | 27K | 803 | 8 |
| [Strapi](https://github.com/strapi/strapi) | 65K | 259 | 5 |
| [Twenty](https://github.com/twentyhq/twenty) | 25K | 5,702 | 0 ✅ |

Payload CMS has 508 circular dependencies in 675 TypeScript files. That is not a typo.

*(Methodology: `npx madge --circular --extensions ts <path>`, default config, run 2026-05-30 against each repo's then-current `main` at the package root. Cycle counts drift as these repos and madge evolve — re-run the command to compare against the current tree.)* And nobody who works on Payload wrote a single line with the intention of creating a cycle. Every one of those 508 paths through the import graph was the result of incremental, individually reasonable decisions.

This is how circular dependencies work. They accumulate silently. The build succeeds. The tests pass. The app ships. And somewhere in that import graph, modules are pulling in code they do not need, tests are loading the entire dependency tree, and a developer is staring at an `undefined` error that only happens during initialization and disappears the moment they add a `console.log`.

Circular dependencies are the silent technical debt of every large JavaScript codebase. Here is why they form, what they quietly break, and how to find all of them.

---

## What a circular dependency actually is

> **A circular dependency** exists when module A imports from module B, which imports (directly or transitively) from module A.

```typescript
// user.service.ts
import { formatUser } from './user.utils';

// user.utils.ts
import { UserService } from './user.service'; // ← closes the loop
```

Neither developer planned this. `user.service.ts` needed a formatter. `user.utils.ts` needed the service type for a helper function added three sprints later. Nobody saw the cycle form — they just saw two reasonable imports.

This is how every circular dependency is born: through incremental, individually sensible decisions.

---

## The 3 patterns that create them in JavaScript and TypeScript

### 1. Barrel files (`index.ts` re-exports)

Barrel files are the biggest source of accidental cycles in TypeScript projects.

```typescript
// features/user/index.ts — re-exports everything in the feature
export { UserService } from './user.service';
export { UserRepository } from './user.repository';
export { UserController } from './user.controller';
export { formatUser, validateUser } from './user.utils';
```

Now every file in the `user` feature imports from `../user` (the barrel) for convenience. And any utility that the barrel re-exports cannot safely import anything else from the barrel without creating a cycle.

```typescript
// user.utils.ts
import { UserService } from '../user'; // ← imports the barrel
// The barrel re-exports user.utils → user.utils imports the barrel → cycle
```

Teams adopt barrel files for cleaner import paths. They inadvertently create import graphs where everything is connected to everything else.

### 2. Shared types modules

A `types.ts` or `interfaces.ts` file that both sides of a feature boundary import seems harmless — it only contains type definitions, after all.

```typescript
// types.ts
import { UserService } from './user.service'; // needed for a type

// user.service.ts
import { User, UserOptions } from './types'; // and now we have a cycle
```

TypeScript makes this worse. `import type` declarations are erased at compile time — they don't exist at runtime — but the module graph your bundler or Node.js sees is determined at load time, before the TypeScript compiler's type-erasure runs. Many cycle detectors (including `eslint-plugin-import/no-cycle`) skip `import type` edges entirely, so they may report 0 cycles on a graph that has real structural issues.

### 3. Cross-feature imports

As a codebase grows, features start borrowing from each other. `OrderService` needs a user's address, so it imports from the `User` domain. `UserService` tracks order history, so it imports from the `Order` domain.

```typescript
// orders/order.service.ts
import { UserAddress } from '../users/user.types';

// users/user.service.ts
import { OrderHistory } from '../orders/order.types'; // cycle complete
```

This is architecturally wrong (neither domain should own the other), but it emerges naturally as product requirements evolve. Nobody refactors the boundary; they just add the import and move on.

---

## Why famous projects have hundreds of them

The table at the top is not an indictment — it is a pattern (get the per-project cycle paths with `madge --circular --json`). Payload's 508 cycles are almost entirely the shared-types pattern at scale. With 675 source files, their `admin/types.ts` participates in dozens of cycles because it imports from domain modules while being imported by nearly everything in the admin layer.

Strapi's 5 cycles in their core package trace directly to barrel files: `Strapi.ts → configuration/index.ts` closes a loop because the configuration barrel re-exports modules that import from `Strapi.ts`.

Medusa's 8 cycles in core-flows are the cross-feature pattern: customer steps import from customer workflows, and those workflows import from the step index — the classic `steps/index.ts → workflows/index.ts → steps/index.ts` loop that barrel files create.

**Twenty is the outlier at 0 cycles.** They enforce strict domain boundaries and avoid cross-domain barrel files. It is achievable from the start of a project. It becomes progressively harder to retroactively enforce as the codebase grows.

---

## What circular dependencies silently break

### Bundle bloat

Circular import graphs can defeat tree-shaking. When module A and B form a cycle, bundlers must conservatively include both — along with everything they depend on — because they cannot statically prove which exports are actually used in the presence of the cycle.

In practice: adding a **value import** (not a type import — those are erased at compile time) to a barrel file that is already part of a cycle can pull unexpected code into your bundle. No error. No warning. Just a larger bundle and slower load times. This is why bundle size regressions often appear with no obvious code change — the added import closed a cycle path that the bundler's tree-shaking couldn't see through.

### Test isolation and speed

Unit tests work by loading a module and its dependencies in isolation. Circular dependencies make isolation impossible — loading module A loads module B loads module A, pulling in the entire graph.

A test for a 50-line utility function ends up loading the ORM, the authentication layer, and the HTTP client. The test suite gets slower with every feature added, and teams blame "the test framework" or "the CI machine" rather than the import graph structure.

### Initialization order bugs

This is the most insidious failure mode. At runtime, Node.js resolves circular dependencies by returning an **incomplete module** — an empty object or a partially initialized class — at the point of the cycle.

```typescript
// a.ts
import { B } from './b';
export class A {
  method() { return new B(); }
}

// b.ts
import { A } from './a';
export class B {
  // When b.ts loads, A is not yet defined — the cycle gives b.ts an empty object
  parent = new A(); // ← undefined at module initialization time
}
```

The result: `TypeError: A is not a constructor`. Or worse — `parent` is `undefined` silently, and the error surfaces 10 function calls later in code that has nothing to do with the import.

These bugs are notoriously hard to reproduce. They appear and disappear based on load order, which can change when a new import is added anywhere in the graph. Adding a `console.log` changes the timing and the bug disappears — classic heisenbug.

### CommonJS vs ESM: how the failure differs

Circular imports cause the most confusing bugs when top-level code in one module references something from a circular counterpart before that counterpart has finished evaluating.

**In CommonJS (`require`):** Node.js returns a partially-constructed `module.exports` for the module still being loaded. The result: you get `undefined` where you expect a class — at the top level of the file, before anything instantiates.

```javascript
// a.js
const { B } = require('./b');
exports.A = class A { method() { return new B(); } }

// b.js — loads a.js before a.js has finished
const { A } = require('./a'); // A is undefined — a.js hasn't exported yet
exports.DEFAULT_B = new A(); // TypeError: A is not a constructor — at module load time
```

**In ESM (`import`):** Top-level code that references a circularly-imported value before its source module has finished evaluating throws `ReferenceError: Cannot access 'X' before initialization` — the TDZ.

```typescript
// a.ts
import { B } from './b';
export class A { method() { return new B(); } }
export const DEFAULT_A = new A(); // ← top-level: runs at module load

// b.ts
import { DEFAULT_A } from './a'; // a.ts is still loading — DEFAULT_A not yet evaluated
export class B {}
export const USES_A = DEFAULT_A; // ReferenceError: Cannot access 'DEFAULT_A' before initialization
```

Class instantiation in method bodies is fine (lazily resolved); it is only top-level evaluation — module-scope `const`, `let`, or inline class fields that execute at class *definition* time — that breaks.

The diagnostic in both cases: the error disappears when you add `console.log` or reorder imports — that changes evaluation timing just enough to hide the cycle. Teams work around it with lazy imports or `setTimeout` hacks that mask the structure problem rather than resolving it.

---

## Why they accumulate undetected

Plenty of teams have `eslint-plugin-import/no-cycle` installed and see it reporting 0 cycles.

There are two reasons they're still there:

**Reason 1: Type-only cycles are architecturally circular but have zero runtime impact.** A cycle that closes through `import type { Foo }` is erased at compile time — no bundle edge, no module load edge at runtime. Whether your detector flags it or not is a policy question: the cycle is real in the source graph but invisible in the runtime graph. The risk is that a type-only cycle becomes a value cycle the moment someone adds a value export to the same file — and that transition is invisible in code review.

**Reason 2: Depth limits silently truncate the search.** Some cycle detectors impose a `maxDepth` limit on how deep the DFS traversal goes. Cycles longer than that limit are never found — the rule exits clean and nobody knows. (Both `eslint-plugin-import` and `import-next` default to unlimited depth; the truncation risk applies to any tool or config that sets a finite cap.)

---

## How to find all of them

If you've used `eslint-plugin-import/no-cycle` and it reports 0, that may not mean your codebase is clean — it may mean the tool's defaults are hiding cycles from you. We found a specific cache bug in our own rule that caused the same behavior: [0 cycles on 14,556 files, 5 on a 33-file subset](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8). The number of cycles reported depends heavily on which tool you use and how it's configured.

The standard `eslint-plugin-import/no-cycle` rule is battle-tested and ubiquitous — the right default for most projects. It recomputes each file's import resolution per run, so the cost compounds as a monorepo grows, and cycle detection is often the first check teams drop from CI once a repo gets large enough.

> **Disclosure.** `eslint-plugin-import-next` is the plugin I maintain (part of Interlace). The madge audit numbers above come from a third-party tool on public repos; the benchmark below is mine — harness linked so you can reproduce it.

`eslint-plugin-import-next` is built for scale: it persists the strongly-connected-components graph and resolution cache across the *entire* lint run instead of recomputing per file — which is what makes it both faster and deterministic. Migration is mechanical (uninstall, install, rename the `import/*` rule prefixes — covered below), not a rewrite.

**Benchmark: `no-cycle` rule only, synthetic corpus, M2 MacBook Pro (median of repeated runs):**

| Codebase size | eslint-plugin-import | eslint-plugin-import-next | Speedup |
|---|---|---|---|
| 1,000 files | 27ms | 1.05ms | **~26×** |
| 5,000 files | 149ms | 2.7ms | **~55×** |
| 10,000 files | >10 min (terminated) | ~6s | **>100×** |

At 10K files in this synthetic run, `eslint-plugin-import` was terminated at an operator-imposed 10-minute cap (lower bound, not a measured completion); `import-next` finished in ~6 seconds. That gap is why cycle detection gets dropped from CI on large repos — and why import-next is built so it doesn't have to be.

The rule also fixes a cache-poisoning bug that caused non-deterministic results: the same repo, back-to-back runs, reported different cycle counts. [We documented this in detail](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8) — the fix ensures consistent results whether you lint the full repo or a subset.

| | eslint-plugin-import | eslint-plugin-import-next |
|--|---------------------|--------------------------|
| Battle-tested, ubiquitous | ✅ | — (newer) |
| Drop-in compatible | ✅ | ✅ |
| oxlint plugin entry | — | ✅ |
| Cache-stable across subset/full runs ([details](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8)) | partial | ✅ |
| Tuned for 10K+ file monorepos | — | ✅ |

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
import importNext from 'eslint-plugin-import-next';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
    languageOptions: { parser: tsParser },
    plugins: { 'import-next': importNext },
    rules: {
      'import-next/no-cycle': 'error',
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

### Fix barrel file cycles: explicit imports

```typescript
// Before (causes cycles through the barrel):
import { UserService } from '../user';

// After (direct import, no barrel in the path):
import { UserService } from '../user/user.service';
```

This is the most impactful change for most codebases. Barrel files are a developer convenience that bundlers and linters pay the cost for.

### Fix shared type cycles: extract a dedicated types layer

```typescript
// Before:
// types.ts imports from service.ts → service.ts imports from types.ts → cycle

// After:
// domain-types.ts — no imports from your own code, only external packages
export interface User { id: string; email: string; role: UserRole; }
export type UserRole = 'admin' | 'user';

// types.ts can import from domain-types.ts safely
// service.ts can import from domain-types.ts safely
// No cycle
```

The pattern: types that need to be shared across a boundary belong in a module with zero imports from your own codebase.

### Fix cross-feature cycles: inversion of control

```typescript
// Before:
// orders/order.service.ts imports from users/
// users/user.service.ts imports from orders/
// → architectural cycle

// After: neither domain imports the other
// orders/ defines an interface it needs:
export interface OrderUserAddress {
  street: string; city: string; country: string;
}
// users/ implements the interface in its own adapter
// orders/ accepts the interface — no import of the User domain
```

This is a domain boundary fix. It takes more work but removes the architectural coupling that causes the cycle.

---

## Where to start

Run the linter against your codebase and sort findings by how many files are in each cycle. Fix the largest cycles first — they're the ones with the most shared state and the most bundling impact.

A codebase with 50 circular dependencies usually has 3–5 that are responsible for most of the blast radius. Fix those and the bundler, the tests, and the initialization order bugs often improve measurably.

---

If your codebase has grown past 10K files and you've never run a cycle detector, start with the subset test: run `no-cycle` on one complex subdirectory and compare to the full repo. If the subset finds more — your tool has a depth or cache issue, like the one [we found and fixed in our own rule](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8).

For context on ESLint cycle detection at scale — including a 100x speedup benchmark and the cache bug we fixed — see [Engineering the 100x Speedup: A Static Analysis Performance Report](https://dev.to/ofri-peretz/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster-1afa).

**Run `npx madge --circular --extensions ts` on your own repo and drop the number in the comments — I'll bet someone beats 508.** And what's the most surprising place you've found a cycle: the data layer, the domain layer, or somewhere you never expected? If you swap in `import-next/no-cycle` and it surfaces cycles your old config reported as 0, that's the [cache bug](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8) — tell me your before/after count.

---

📦 [`eslint-plugin-import-next`](https://www.npmjs.com/package/eslint-plugin-import-next) · [Rule docs](https://eslint.interlace.tools/docs/quality/plugin-import-next)

<!-- markdownlint-disable MD034 -->
**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**
<!-- markdownlint-enable MD034 -->

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)