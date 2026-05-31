---
devto_url: "https://dev.to/ofri-peretz/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses-5gii"
devto_id: 3240750
title: "Microsoft's SDL ESLint Plugin Caught 3 of My Node Vulns; the Domain Plugins Caught 46 — It's a Frontend Tool"
description: "A reproducible benchmark: @microsoft/eslint-plugin-sdl (17 rules, Angular/Electron/browser-focused) vs the Interlace security plugins, on one Node fixture. SDL is a frontend-hardening tool — which is exactly why it's the wrong layer for a Node backend."
slug: "benchmark-microsoft-sdl-vs-interlace"
published: true
date: 2026-02-08
cover_image: https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop
tags:
  - security
  - eslint
  - javascript
  - benchmark
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace
reading_time_minutes: 7
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

`@microsoft/eslint-plugin-sdl` is Microsoft's Security Development Lifecycle
linter — 17 rules distilled from the SDL standard. I ran it against a file of 12
Node.js vulnerability classes alongside the Interlace security plugins. SDL
flagged **3** issues; the domain plugins flagged **46**.

That gap isn't a quality verdict — it's a **layer** mismatch. Look at SDL's rule
list and the result is obvious: it was built to harden **frontends**, not Node
backends.

## What SDL's 17 rules actually target

```text
no-angular-bypass-sanitizer        no-angularjs-bypass-sce
no-angular-sanitization-trusted-urls   no-angularjs-enable-svg
no-angularjs-sanitization-whitelist    no-electron-node-integration
no-inner-html      no-html-method     no-document-write    no-document-domain
no-cookies         no-insecure-url    no-insecure-random   no-unsafe-alloc
no-msapp-exec-unsafe   no-postmessage-star-origin   no-winjs-html-unsafe
```

Five are Angular/AngularJS-specific, one is Electron, two are WinJS/MSApp,
several are DOM/browser (`innerHTML`, `document.write`, `postMessage`,
cookies). That's a **frontend / MS-stack** security surface — and a good one for
that surface.

## Detection — `vulnerable.js` (12 Node vulnerability classes)

| Config                               | Engine | Security findings |
| ------------------------------------ | ------ | ----------------- |
| Oxlint built-in                      | Oxlint | 1                 |
| **@microsoft/eslint-plugin-sdl**     | ESLint | **3**             |
| Interlace flagship rules             | Oxlint | 5                 |
| eslint-plugin-security (recommended) | ESLint | 21                |
| Interlace (4 plugins, recommended)   | ESLint | 46                |

SDL's 3 came from the only rules that fit a backend file: `no-inner-html`,
`no-document-write`, and `no-cookies`. Its Angular, Electron, and WinJS rules had
nothing to match — there's no Angular in a Node API.

> **A robustness note, stated plainly.** Three SDL rules (`no-insecure-random`,
> `no-insecure-url`, `no-unsafe-alloc`) **threw** on the fixture's dynamic
> `require(variable)` — a `path.basename(undefined)` inside the rule. They're
> written around browser/Angular call shapes, not Node's dynamic module loading.
> It's a fair reminder that a linter only hardens the surface it was built for.

## What a Node backend needs instead

The 43 findings SDL has no rule for (46 total minus the 3 it caught) are the Node backend surface: SQL injection
(`pg/no-unsafe-query`), `fs` path traversal
(`node-security/detect-non-literal-fs-filename`), object injection /
prototype-pollution (`secure-coding/detect-object-injection`), unsafe
deserialization (`secure-coding/no-unsafe-deserialization`), command injection,
weak hashing, ReDoS, insecure comparisons. None are in SDL's scope.

## False positives — `safe-patterns.js`

| Config                       | False positives                                                        |
| ---------------------------- | ---------------------------------------------------------------------- |
| Oxlint built-in              | 0                                                                      |
| Interlace @ Oxlint           | 0                                                                      |
| @microsoft/eslint-plugin-sdl | 1 (`no-inner-html` on a DOMPurify-sanitized assignment — conservative) |
| Interlace @ ESLint           | 3 (a perf rule + a conservative-by-design rule)                        |
| eslint-plugin-security       | 5 (genuine — validated-key + path-validated)                           |

## Use the right layer

If you ship Angular, Electron, or a browser frontend, **SDL is a sensible
hardening layer for that code** — it encodes Microsoft's SDL guidance for those
surfaces. For the Node backend (APIs, data layer, crypto, serverless), reach for
the domain plugins. They're different layers of the same app:

```js
// eslint.config.mjs
import sdl from "@microsoft/eslint-plugin-sdl";
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";

export default [
  // frontend bundle — SDL where Angular/Electron/DOM code lives.
  // (SDL's configs are flat-config ARRAYS, so map files onto each entry —
  //  unlike the Interlace configs, which are single objects.)
  ...sdl.configs.common.map((c) => ({
    files: ["src/web/**", "src/electron/**"],
    ...c,
  })),
  // backend — the domain security plugins (their configs ARE single objects)
  { files: ["src/api/**", "src/db/**"], ...secureCoding.recommended },
  { files: ["src/**"], ...nodeSecurity.recommended },
  { files: ["**/db/**"], ...pg.recommended },
];
```

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 12 Node
vulnerability classes; `safe-patterns.js`), so they measure the Node backend
surface the Interlace rules target — SDL would score very differently on an
Angular/Electron fixture, which is its home turf. Versions (measured 2026-05-31):
`eslint@9.39`, `@microsoft/eslint-plugin-sdl@1.1.0` (17 rules),
`eslint-plugin-secure-coding@3.2.0`, `node-security@4.2.0`, `pg@1.4.3`,
`browser-security@1.2.3`. Each plugin's rules at `error`, `--format json`,
counted by `ruleId` (SDL's three throwing rules disabled so the rest could run).

```bash
npm i -D eslint@9 @microsoft/eslint-plugin-sdl eslint-plugin-secure-coding \
  eslint-plugin-node-security eslint-plugin-pg eslint-plugin-browser-security
npx eslint --config eslint.config.sdl.mjs test-files/vulnerable.js --format json
npx eslint --config eslint.config.interlace.mjs test-files/vulnerable.js --format json
```

Fixtures and both config files live in the repo's
[`packages/eslint-plugin-secure-coding/benchmark/`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding/benchmark).

The full 4-engine version (ESLint + Oxlint, built-in + plugins) is in
[the security-linter benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof).

---

## Compatibility

| Surface              | Support                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                                                                                                          |
| **Node**             | `>= 18.0.0`                                                                                                                                                                   |
| **ESLint**           | Interlace plugins `^8 \|\| ^9 \|\| ^10`; **`@microsoft/eslint-plugin-sdl` requires `^9`**. Flat config (on ESLint 8 the Interlace plugins need `ESLINT_USE_FLAT_CONFIG=true`) |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs`                                                                                                        |
| **Oxlint**           | Interlace flagship rules run via the `interlace-*` ports, parity-gated                                                                                                        |

---

## Links

- 📦 [secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📦 [@microsoft/eslint-plugin-sdl](https://www.npmjs.com/package/@microsoft/eslint-plugin-sdl) — the frontend layer
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Node backend needs more than a frontend security linter.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
