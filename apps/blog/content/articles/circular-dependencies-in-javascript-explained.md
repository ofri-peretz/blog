---
devto_url: "https://dev.to/ofri-peretz/what-are-circular-dependencies-in-javascript-and-why-they-break-things-51jd"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/circular-dependencies-in-javascript-explained-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/circular-dependencies-in-javascript-explained.jpg?v=b2"
title: "The Bug That Passes Every Toolchain Check: Circular Dependencies in JavaScript"
description: "Circular dependencies compile cleanly, pass tests, and ship to production. Here are the 3 patterns that create them, what Node.js, webpack, Rollup, and esbuild actually do with them, and how to stop them before they compound."
slug: "circular-dependencies-in-javascript-explained"
tier: "T1"
published: true
date: 2026-05-30
tags:
  - "javascript"
  - "typescript"
  - "eslint"
  - "node"
devto_id: 3785832
canonical_url: https://ofriperetz.dev/articles/circular-dependencies-in-javascript-explained
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A circular dependency is one of the few bugs that passes every check your toolchain runs.

TypeScript compiles it cleanly. The tests pass. The build succeeds. The app ships. And somewhere deep in your import graph, a developer is staring at a `TypeError: X is not a constructor` that disappears the moment they add a `console.log`.

Here are the three patterns that create them, what Node.js, webpack, Rollup, and esbuild actually do with them — they don't solve the problem, they each make a different tradeoff — and how to stop them from forming.

---

## What a circular dependency actually is

A circular dependency exists when module A imports from module B, which imports — directly or transitively — from module A.

```typescript
// user.service.ts
import { formatUser } from './user.utils';

// user.utils.ts
import { UserService } from './user.service'; // ← closes the loop
```

Neither developer planned this. `user.service.ts` needed a formatter. `user.utils.ts` needed the service type for a helper added three sprints later. Nobody saw the cycle form — they just saw two reasonable imports.

This is how every circular dependency is born: through incremental, individually sensible decisions.

---

## The 3 patterns that create them

### 1. Barrel files (`index.ts` re-exports)

Barrel files are the biggest source of accidental cycles in TypeScript projects.

```typescript
// features/user/index.ts — re-exports everything in the feature
export { UserService } from './user.service';
export { UserRepository } from './user.repository';
export { UserController } from './user.controller';
export { formatUser, validateUser } from './user.utils';
```

Now every file in the `user` feature imports from `../user` (the barrel) for cleaner paths. And any utility the barrel re-exports cannot safely import anything else from the barrel without creating a cycle.

```typescript
// user.utils.ts
import { UserService } from '../user'; // ← imports the barrel
// The barrel re-exports user.utils → user.utils imports the barrel → cycle
```

Teams adopt barrel files for developer convenience. They inadvertently create import graphs where everything is connected to everything else.

### 2. Shared types modules

A `types.ts` file that both sides of a feature boundary import looks harmless — it only contains type definitions, after all.

```typescript
// types.ts
import { UserService } from './user.service'; // needed for a return type

// user.service.ts
import { User, UserOptions } from './types'; // cycle
```

TypeScript makes this worse. `import type` declarations are erased at compile time, but the module graph your bundler or Node.js sees is determined at load time. Many cycle detectors skip `import type` edges entirely — reporting 0 cycles on a graph that has real structural problems. The risk: the moment someone adds a value export to that same file, the type-only cycle becomes a value cycle, and that transition is invisible in code review.

### 3. Cross-feature imports

As a codebase grows, features start borrowing from each other directly.

```typescript
// orders/order.service.ts
import { UserProfile } from '../users/user.service'; // orders imports users

// users/user.service.ts
import { OrderHistory } from '../orders/order.service'; // users imports orders → cycle
```

Neither import looks wrong in isolation. `OrderService` needs the user's profile. `UserService` needs to surface order history. Both make sense individually. Together they create an architectural cycle that neither domain should own.

---

## What Node.js, webpack, Rollup, and esbuild do with them

Runtimes and bundlers don't solve circular dependencies — they each make a different tradeoff, each with its own failure mode.

**Node.js (CommonJS):** Returns a partially-constructed `module.exports` for the module still being loaded. If module A is still evaluating when module B requires it, B gets an empty object `{}` — the exports haven't been assigned yet.

```javascript
// a.js
const { B } = require('./b');
exports.A = class A { method() { return new B(); } }

// b.js — requires a.js before a.js has finished evaluating
const { A } = require('./a'); // A is {} — not yet assigned
exports.DEFAULT_B = new A(); // TypeError: A is not a constructor
```

**Node.js (ESM):** Uses live bindings and the Temporal Dead Zone. ESM hoists imports and evaluates modules in post-order — child before parent. When a cycle exists, the module being waited on hasn't finished evaluating yet. Reading a binding that hasn't been initialized throws `ReferenceError`.

```typescript
// a.ts
import { B } from './b';
export class A { method() { return new B(); } }
export const DEFAULT_A = new A(); // top-level: runs at module load

// b.ts — evaluated before a.ts finishes
import { DEFAULT_A } from './a'; // a.ts is still loading
export const USES_A = DEFAULT_A; // ReferenceError: Cannot access 'DEFAULT_A' before initialization
```

Class instantiation in method bodies is fine (lazily resolved at call time, not load time). Only top-level evaluation — module-scope `const`, `let`, or class fields that run at class definition — breaks.

**Rollup / esbuild:** Bundle all modules into a single file and try to reorder them to resolve the cycle. This works for many cycles, but when a true circular dependency exists — where A genuinely needs B to be initialized before A finishes — no linear ordering can satisfy both. Rollup inserts a wrapper; esbuild typically uses IIFEs. The result: the bundle may produce different initialization order than Node.js, meaning a bug that appeared in Node.js may not appear in the Rollup bundle, and vice versa. You cannot test your way out of a cycle by relying on one runtime's ordering.

**webpack:** Behaves similarly to Node.js CJS semantics for CommonJS modules — partially-constructed exports at the point of the cycle. For ESM modules bundled by webpack, live bindings are preserved, and the same TDZ behavior applies.

The diagnostic is the same in every runtime: `console.log` changes execution timing just enough to alter the evaluation order — the bug appears or disappears based on load order, which changes when any import is added anywhere in the graph.

---

## What circular dependencies silently break

### Bundle size at barrel boundaries

Bundlers tree-shake based on export usage — but when a value-exporting barrel is part of a cycle, the barrel module becomes a side-effectful unit. Because the barrel is reachable through the cycle regardless of which specific exports are used, its siblings can get pulled in. The practical result: adding a single value import to a barrel file that participates in a cycle can expand your bundle without a warning. No error. No size diff in the PR. Just a larger bundle and slower load times at next deploy.

### Test isolation and speed

Unit tests work by loading a module and its dependencies in isolation. Circular dependencies make isolation impossible — loading module A loads module B loads module A, pulling in the entire graph.

A test for a 50-line utility ends up loading the ORM, the auth layer, and the HTTP client. Test suites get slower with every feature added, and teams blame "the test framework" rather than the import graph.

### Initialization order bugs that survive review

The `console.log` disappearing-bug pattern above is the tell. Because each runtime handles cycles differently, the same cycle can produce different behavior depending on the bundler target, the build mode, and the import order — all of which can change between feature branches without touching the cyclic code.

---

## Why they accumulate undetected

Most teams have `eslint-plugin-import/no-cycle` installed. Most of those teams have it reporting 0 cycles. [This is not because their codebase is clean.](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8)

Two reasons cycles hide:

**Type-only cycles are invisible at runtime.** A cycle that closes through `import type { Foo }` is erased at compile time — no bundle edge, no module load edge. The risk: the moment someone adds a value export to that file, the type-only cycle becomes a value cycle silently.

**Depth limits silently truncate the search.** Some detectors impose a `maxDepth` on DFS traversal. Cycles longer than that limit are never reported — the rule exits clean and nobody knows. The [cache bug we found in our own rule](https://dev.to/ofri-peretz/no-cycle-finds-0-cycles-in-nextjs-and-other-lies-caches-tell-you-3ld8) is a concrete example of this: the rule reported 0 cycles on 14,556 files while correctly finding 5 on a 33-file subset.

---

## How to fix them

### Barrel file cycles: use direct imports

```typescript
// Before (causes cycles through the barrel):
import { UserService } from '../user';

// After (direct import, no barrel in the path):
import { UserService } from '../user/user.service';
```

The most impactful change for most codebases. Barrel files are a developer convenience that bundlers and linters pay the cost for.

### Shared type cycles: extract a dedicated types layer

```typescript
// domain-types.ts — zero imports from your own code
export interface User { id: string; email: string; role: UserRole; }
export type UserRole = 'admin' | 'user';

// types.ts imports from domain-types.ts safely
// service.ts imports from domain-types.ts safely — no cycle
```

Types that need to be shared across a boundary belong in a module with zero imports from your own codebase.

### Cross-feature cycles: inversion of control

```typescript
// Before: orders/ imports from users/, users/ imports from orders/ → architectural cycle

// After: orders/ defines an interface it needs
export interface OrderUserAddress {
  street: string; city: string; country: string;
}
// users/ implements the interface in its own adapter
// orders/ accepts the interface — no import of the User domain
```

---

## How to detect and prevent them

Two tools, two roles:

- **[madge](https://github.com/pahen/madge)** for a one-time audit: see every cycle in your codebase today
- **ESLint** for ongoing prevention: catches cycles as you create them, in CI on every PR

```bash
# Audit what you have today
npx madge --circular --extensions ts src/
```

For CI prevention, `eslint-plugin-import-next` is the fast-tier replacement for `eslint-plugin-import` — it resolves each file's import graph once and caches globally, instead of re-traversing from every entry point. [The benchmark](https://dev.to/ofri-peretz/eslint-plugin-import-vs-eslint-plugin-import-next-up-to-100x-faster-1afa) (M2 MacBook Pro, synthetic corpus): at 10K files, the original plugin was terminated after 10 minutes without completing; `import-next` finishes in ~6 seconds.

```bash
npm install --save-dev eslint-plugin-import-next
```

```javascript
// eslint.config.mjs
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

```bash
npx eslint src/
```

Madge tells you what you have. ESLint prevents new ones from forming.

---

For the full data — cycle counts across Payload, Next.js, Medusa, Strapi, and Twenty, with per-project breakdowns of which pattern creates the most cycles — see the [companion piece](https://ofriperetz.dev/articles/payload-508-circular-dependency-cycles).

*Where do circular dependencies hide in your codebase — data layer, domain layer, or somewhere you didn't expect? The `console.log` trick is usually the tell.*

---

_Next: [We Scanned Payload, Next.js, and 3 More OSS Projects for Circular Dependencies →](https://ofriperetz.dev/articles/payload-508-circular-dependency-cycles)_

---

📦 [`eslint-plugin-import-next`](https://www.npmjs.com/package/eslint-plugin-import-next) · [Rule docs](https://eslint.interlace.tools/docs/quality/plugin-import-next)

<!-- markdownlint-disable MD034 -->
{% cta https://github.com/ofri-peretz/eslint %}
⭐ Star on GitHub
{% endcta %}
<!-- markdownlint-enable MD034 -->

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
