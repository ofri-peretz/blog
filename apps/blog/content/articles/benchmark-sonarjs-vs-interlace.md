---
devto_url: "https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
devto_id: 3240739
title: "SonarJS Has 269 Rules and Found 13 Security Issues Where the Domain Plugins Found 46 — It's a Quality Linter"
description: "A reproducible 5-way benchmark: eslint-plugin-sonarjs (269 rules) vs the Interlace security plugins, on one fixture. SonarJS is one of the best quality linters in the ecosystem — and that's exactly why its security coverage is a different scope."
slug: "benchmark-sonarjs-vs-interlace"
published: true
date: 2026-02-08
cover_image: https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop
tags:
  - security
  - eslint
  - javascript
  - benchmark
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace
reading_time_minutes: 8
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

`eslint-plugin-sonarjs` is one of the best linters in the ecosystem — 269 rules,
3M+ weekly downloads, SonarSource's analysis engine distilled into ESLint. So I
ran it against a file of 12 vulnerability classes alongside the Interlace
security plugins. SonarJS flagged **13** security issues on that file; the domain
plugins flagged **46** (different finding counts on the same file — not a shared
scorecard).

That's not a knock on SonarJS. It's a **scope** result: SonarJS is a _quality_
linter that happens to carry a handful of security rules. Security depth is a
different product. Here's the reproducible data, and why "use both" is the real
answer.

## Detection — `vulnerable.js` (12 vulnerability classes)

| Config                                  | Engine | Security findings |
| --------------------------------------- | ------ | ----------------- |
| Oxlint built-in                         | Oxlint | 1                 |
| Interlace flagship rules                | Oxlint | 5                 |
| **eslint-plugin-sonarjs** (recommended) | ESLint | **13**            |
| eslint-plugin-security (recommended)    | ESLint | 21                |
| Interlace (4 plugins, recommended)      | ESLint | 46                |

SonarJS's 13 came from exactly the rules it ships for cross-language security
basics: `sonarjs/os-command` (×3) + `no-os-command-from-path` (×1),
`sonarjs/sql-queries` (×2), `sonarjs/code-eval` (×2), `sonarjs/slow-regex` (×2),
`sonarjs/hashing` (×2), `sonarjs/pseudo-random` (×1). Those are genuinely good
rules — `os-command` in particular is best-in-class. The same run also produced
**25 quality findings** (`no-unused-vars`, `no-dead-store`, …) — which is the
point: SonarJS spends its 269 rules on _quality_, and a few of them overlap
security.

The Interlace plugins surfaced 33 more findings — the **Node-specific
depth** SonarJS has no rule for: `fs`-path traversal
(`node-security/detect-non-literal-fs-filename`), object injection /
prototype-pollution (`secure-coding/detect-object-injection`), PostgreSQL
injection (`pg/no-unsafe-query`), unsafe deserialization
(`secure-coding/no-unsafe-deserialization`), DOM XSS
(`browser-security/no-innerhtml`), insecure comparisons, and more.

## False positives — `safe-patterns.js`

| Config                 | False positives                                 |
| ---------------------- | ----------------------------------------------- |
| eslint-plugin-sonarjs  | **0** (security)                                |
| Oxlint built-in        | 0                                               |
| Interlace @ Oxlint     | 0                                               |
| Interlace @ ESLint     | 3 (a perf rule + a conservative-by-design rule) |
| eslint-plugin-security | 5 (genuine — validated-key + path-validated)    |

SonarJS is **precise** — its 10 findings on the safe file were all quality
(`no-unused-vars`), zero security false alarms. That precision is part of why
it's a great quality tool.

## Where SonarJS is the right call

- ✓ **Cognitive complexity** — one of the best implementations anywhere.
- ✓ **Dead code / unused assignments / redundant logic** — the `no-dead-store`,
  `no-unused-collection`, all-identical-comparison family.
- ✓ **Code smells** — duplicate branches, collapsible conditionals.
- ✓ **The security basics** — command injection, eval, weak hashing, insecure
  randomness, the SQL-string and slow-regex patterns above.

## Where you need domain security rules

SonarJS has no rule for the Node-specific attack surface: `fs` path traversal,
prototype pollution, NoSQL/Mongo injection, SSRF, open redirect, timing attacks,
JWT claim validation, unsafe deserialization. Those are the gaps the
domain plugins fill — not because SonarJS is weak, but because it was built for
the **breadth of JavaScript quality**, not the **depth of Node.js security**.

## The real answer: run both

SonarJS for quality, the domain plugins for security. They don't overlap enough
to conflict, and together they cover both axes:

```js
// eslint.config.mjs
import sonarjs from "eslint-plugin-sonarjs";
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";
import { configs as browserSecurity } from "eslint-plugin-browser-security";

export default [
  sonarjs.configs.recommended, // quality
  secureCoding.recommended, // general security
  nodeSecurity.recommended, // crypto, supply-chain, SSRF, fs
  pg.recommended, // PostgreSQL
  browserSecurity.recommended, // DOM / browser
];
```

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 12
vulnerability classes; `safe-patterns.js`, validated-safe patterns), so they
measure coverage of the surface the Interlace rules target — run it on your own
code for an unbiased read. Versions (measured 2026-05): `eslint@9.39`,
`oxlint@1.67`, `eslint-plugin-sonarjs@4.0.3` (269 rules),
`eslint-plugin-secure-coding@3.2.0`, `node-security@4.2.0`, `pg@1.4.3`,
`browser-security@1.2.3`. Each plugin's `recommended` preset, `--format json`,
counted by `ruleId` (security rule IDs for the security totals).

```bash
npm i -D eslint@9 oxlint eslint-plugin-sonarjs eslint-plugin-secure-coding \
  eslint-plugin-node-security eslint-plugin-pg eslint-plugin-browser-security
npx eslint --config eslint.config.sonarjs.mjs test-files/vulnerable.js --format json
npx eslint --config eslint.config.interlace.mjs test-files/vulnerable.js --format json
npx oxlint test-files/vulnerable.js   # Oxlint built-in row
```

(On ESLint 8, set `ESLINT_USE_FLAT_CONFIG=true` to load `eslint.config.mjs`;
ESLint 9+ uses flat config by default. The Interlace-flagship-on-Oxlint row is
reproduced from the repo per the [4-way benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof).)

The full 4-engine version of this benchmark (ESLint + Oxlint, built-in + plugins)
is in [the security-linter benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof).

---

## Compatibility

| Surface              | Support                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                   |
| **Node**             | `>= 18.0.0`                                                            |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                         |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs` |
| **Oxlint**           | Interlace flagship rules run via the `interlace-*` ports, parity-gated |

---

## Links

- 📦 [secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📦 [eslint-plugin-sonarjs](https://www.npmjs.com/package/eslint-plugin-sonarjs) — the quality half
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you run SonarJS for quality and want the security half to match.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
