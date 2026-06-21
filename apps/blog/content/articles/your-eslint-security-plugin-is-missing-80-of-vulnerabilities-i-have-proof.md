---
title: "Same Vulnerable File, 4 Linters: Your Security Plugin Caught 21 of 46. Oxlint Native Caught 1."
description: "A 4-way benchmark on one fixture (12 vulnerability classes): Oxlint's built-in rules, eslint-plugin-security, the Interlace plugins on ESLint, and the same Interlace rules on Oxlint. Real current numbers, the false-positive breakdown, and the parity proof that the rules run on both engines."
slug: "your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof"
canonical_url: "https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof"
devto_url: "https://dev.to/ofri-peretz/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof-2lpm"
devto_id: 3117602
published_at: "2025-12-20T16:25:32Z"
edited_at: "2026-01-11T10:22:06Z"
cover_image: "https://ofriperetz.dev/og/cover/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof"
social_image: "https://ofriperetz.dev/og/article/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof"
reading_time_minutes: 7
tags:
  - "security"
  - "node"
  - "javascript"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Security Engineering Protocol"
---

The security linter most Node teams ship — `eslint-plugin-security`, ~1.6M
downloads a week — caught **21 of 46** issues on a file of known
vulnerabilities. That's not a typo and it's not a brag about my plugins: it's
the gap between "we run a security linter" and "we catch security bugs," and
almost nobody measures it.

I took one file with **12 classes of real vulnerabilities** and ran it through
four linter configurations — two engines (ESLint, Oxlint) crossed with the rules
you'd actually reach for. The detection spread on the same file:

- **Oxlint built-in rules: 1** finding
- **Interlace flagship rules (on Oxlint): 5** — the portability subset (see below)
- **eslint-plugin-security: 21**
- **Interlace plugins (on ESLint): 46**

The takeaway isn't "tool X wins." It's that **the engine is a commodity and the
rules are the product** — and the rules you pick should run on whichever engine
you choose. Here's the data, the false positives, and the parity proof — so you
can run the exact same comparison on your own code before you trust mine.

> Part of **The Security Engineering Protocol**. This one is the head-to-head;
> for the incumbent's side in detail see
> [Same File: eslint-plugin-security Caught 21, the Domain Plugins Caught 46](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h),
> and for the whole field see
> [17 ESLint security plugins compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

## The four configurations

1. **Oxlint built-in** — the fast Rust engine's _own_ rules, no security plugin.
2. **eslint-plugin-security** — the generic incumbent (~1.6M weekly), on ESLint.
3. **Interlace @ ESLint** — the domain plugins (`secure-coding`, `node-security`,
   `pg`, `browser-security`) combined, so the scope fairly matches the incumbent's
   monolith.
4. **Interlace @ Oxlint** — the _same_ Interlace flagship rules, loaded into
   Oxlint's JS-plugin runner.

## Detection — `vulnerable.js` (12 vulnerability classes)

| Config                               | Engine | Findings | Notes                           |
| ------------------------------------ | ------ | -------- | ------------------------------- |
| Oxlint built-in                      | Oxlint | **1**    | `no-eval` only                  |
| Interlace flagship (3 wired rules)   | Oxlint | **5**    | the rules that are parity-wired |
| eslint-plugin-security (recommended) | ESLint | **21**   | the classic generic patterns    |
| Interlace (4 plugins, recommended)   | ESLint | **46**   | across 20 distinct rules        |

Oxlint's native ruleset caught a single security issue (`no-eval`) — because
**Oxlint is an engine, not a security ruleset.** You pick it for speed, not
coverage. The generic incumbent caught the well-known 21. The domain plugins, run
together, caught 46 across 20 rules — SQL injection (`pg/no-unsafe-query`),
unsafe deserialization, ReDoS, weak hashing, `Math.random()` for crypto, unsafe
`innerHTML`, insecure comparisons, and more that a generic ruleset has no rule
for.

### Why the extra 25 survive code review

The 25 the generic set misses aren't exotic. They're the ones that **look
correct to a senior reviewer reading a diff.** `crypto.createHash('md5')` is a
real Node API doing exactly what it says — nothing in the line announces "this
is the wrong primitive for a password." `Math.random()` returns a number; you
have to already know it isn't CSPRNG-grade to flag it in a token generator.
`pool.query('SELECT ... WHERE id = ' + id)` reads as plain string-building until
you ask where `id` came from three call-frames up. A reviewer scanning forty
files at 5pm pattern-matches on _shape_, and all of these have innocent shape.
That's precisely the gap a domain rule closes: it knows that this API, in this
context, carries a CWE — so it doesn't depend on the reviewer having crypto and
injection taxonomy loaded in working memory at the moment they hit "Approve."

If you want to close that gap before reading further, the four plugins
benchmarked here install as a drop-in alongside whatever you run today:

```bash
npm i -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-pg eslint-plugin-browser-security
```

The flat-config block that wires all four (`recommended` presets) is in the
[Methodology](#methodology--reproduce-it) section below — copy it, point ESLint
at your `src/`, and you have the 46-finding configuration in about a minute.

## False positives — `safe-patterns.js` (validated-safe code)

Detection only counts if precision holds. Run against a file of _deliberately
safe_ patterns:

| Config                 | False positives | On what                                                                                                               |
| ---------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Oxlint built-in        | **0**           | —                                                                                                                     |
| Interlace @ Oxlint     | **0**           | —                                                                                                                     |
| Interlace @ ESLint     | 3               | `pg/no-select-all` (a perf/clarity rule) ×2, conservative `browser-security/no-innerhtml` ×1                          |
| eslint-plugin-security | **5**           | `detect-object-injection` on allowlist-validated keys ×3, `detect-non-literal-fs-filename` on path-validated reads ×2 |

This is the honest difference. The incumbent's 5 are **genuine false positives**
— it flags `obj[key]` even after `VALID_KEYS.includes(key)`, and
`fs.readFileSync(p)` even after `path.basename` + `startsWith` validation,
because it pattern-matches the sink without seeing the guard. The Interlace "3"
aren't security false positives: `no-select-all` is a performance/clarity rule
firing on `SELECT *`, and `no-innerhtml` is conservative by design (it flags
`innerHTML` even when the value is DOMPurify-sanitized — a deliberate choice you
can disable with a documented comment).

## The parity proof: the same rule, both engines

This is the part that matters most. The Interlace flagship rules don't just _also
exist_ on Oxlint — they emit the **identical CWE-tagged finding** on both
engines. `pg/no-unsafe-query` on the same line, under ESLint and under Oxlint:

```text
🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | Unsafe SQL query detected. Variable interpolation found. | CRITICAL [SOC2,PCI-DSS,NIST-CSF]
   Fix: Use parameterized queries ($1, $2) instead of string concatenation. | https://node-postgres.com/features/queries#parameterized-queries
```

Same CWE, same OWASP category, same CVSS, same compliance tags — character for
character. So you are **not
locked to an engine**: run the full domain set on ESLint today, run the
flagship rules on Oxlint for editor-speed feedback, and get the same security
signal either way. (The full 119-rule set is ESLint-first; the flagship rules are
the ones wired + parity-gated on Oxlint so far.)

## How to read this (it's a landscape, not a leaderboard)

- **Oxlint** is the right call when you want a fast engine — pair it with real
  security rules, because its built-in set isn't one.
- **eslint-plugin-security** is the familiar generic floor; it catches the
  classics but pattern-matches sinks, so it costs you false positives on
  validated code.
- **The domain plugins** add depth (database, crypto, DOM, deserialization) the
  generic set has no rules for — that's the gap, not a verdict.
- **Portability** is the point: pick rules that run on both engines so the engine
  decision stays a performance choice, not a coverage lock-in.

## Why this gap is widening: AI writes the patterns the generic set can't see

Here's why the 21-vs-46 gap stopped being academic for me. The 25 issues the
generic set misses — `md5` for hashing, `Math.random()` for tokens, interpolated
SQL, unsanitized `innerHTML` — are exactly the patterns coding assistants emit by
default. Ask Claude or Gemini for "a function that hashes a password" or "build
the user lookup query" and you frequently get idiomatic, confident,
review-passing code that lands squarely on one of these CWEs. I've measured this
directly: when I let an assistant write a batch of functions,
[65–75% carried a security vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
and on the same NestJS prompt
[Claude shipped 6 security errors and Gemini 2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
— the model varies, the _class_ of bug doesn't.

So the generic linter that "passes" your AI-generated PR is the worst possible
signal: a green check on code statistically likely to contain a vuln it has no
rule for. A domain rule that knows `crypto.createHash('md5')` carries CWE-327
regardless of who typed it — human at 5pm or model at temperature 0.7 — is the
guardrail that actually holds when the volume of generated code goes up. That's
the real argument for depth over a generic floor in 2026.

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 12
vulnerability classes; `safe-patterns.js`, validated-safe patterns), so these
numbers measure coverage of the surface we designed the rules around — run it on
your own code for an unbiased read. Versions: `eslint@9.39.4`, `oxlint@1.67.0`,
`eslint-plugin-secure-coding@3.2.0` (27 rules), `node-security@4.2.0` (34),
`pg@1.4.3` (13), `browser-security@1.2.3` (45), `eslint-plugin-security@4.0.0`.
Method: each plugin's `recommended` preset, `--format json`, counted by `ruleId`
(restricted to the four plugins' rule IDs — a raw run also surfaces a couple of
core/TypeScript notices from the fixture).
The fixtures and the `eslint-plugin-security` config live in the repo's
[`packages/eslint-plugin-secure-coding/benchmark/`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding/benchmark);
the flagship Oxlint config is `.oxlintrc.flagship.json` at the repo root.

The Interlace side combines the four plugins (fair scope vs the monolith) in one
flat config:

```js
// eslint.config.mjs
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import pg from "eslint-plugin-pg";
import browserSecurity from "eslint-plugin-browser-security";

export default [
  {
    files: ["**/*.js"],
    plugins: {
      "secure-coding": secureCoding,
      "node-security": nodeSecurity,
      pg,
      "browser-security": browserSecurity,
    },
    rules: {
      ...secureCoding.configs.recommended.rules,
      ...nodeSecurity.configs.recommended.rules,
      ...pg.configs.recommended.rules,
      ...browserSecurity.configs.recommended.rules,
    },
  },
];
```

```bash
# install the engines + the plugins
npm i -D eslint@9 oxlint eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-pg eslint-plugin-browser-security eslint-plugin-security

# 1) Interlace @ ESLint — the eslint.config.mjs above
npx eslint test-files/vulnerable.js --format json

# 2) the incumbent — same shape, one plugin:
#    plugins: { security }, rules: { ...security.configs.recommended.rules }
npx eslint --config eslint.config.security.mjs test-files/vulnerable.js --format json

# 3) Oxlint built-in (npm-installed — reproducible as-is)
npx oxlint test-files/vulnerable.js
```

Config 4 (**Interlace @ Oxlint**) is the only step that needs the repo rather
than npm: the `interlace-*` Oxlint shims load each plugin's built `dist/`, so
reproduce it from a clone —
`git clone https://github.com/ofri-peretz/eslint && npx turbo run build`, then
`npx oxlint -c .oxlintrc.flagship.json <file>` from the repo root.

---

## Compatibility

| Surface              | Support                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Package managers** | npm, yarn, pnpm, bun                                                                       |
| **Node**             | `>= 18.0.0`                                                                                |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                             |
| **Oxlint**           | flagship rules run via the `interlace-*` JS-plugin ports, ESLint↔Oxlint parity-gated in CI |
| **Module system**    | Plugins ship CommonJS; your config can be `eslint.config.js` or `.mjs`                     |

```bash
# the four plugins benchmarked here
npm install --save-dev eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-pg eslint-plugin-browser-security
# yarn add -D … · pnpm add -D … · bun add -d …
```

---

## Links

- 📦 [secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📖 [Full rule docs (per-rule CWE)](https://eslint.interlace.tools)
- 💻 [Source + benchmark on GitHub](https://github.com/ofri-peretz/eslint)

**Same fixture, more challengers** (same 46-finding benchmark, different opponent):

- [SonarJS has 269 rules — it found 13 security issues on this file](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace)
- [Microsoft's SDL plugin caught 3 — same file, wrong layer](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you'd rather run security rules that aren't locked to one engine.
::

---

**Run the comparison on your own repo and tell me what you find:** which class of
the 25 — weak hashing, `Math.random()` tokens, interpolated SQL, raw `innerHTML` —
slips through your current security linter the most? And was the one that bit you
in production written by a person or pasted from an assistant? Drop it in the
comments — I read every one.

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
