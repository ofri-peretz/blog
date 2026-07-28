---
title: "Your ESLint security plugin is missing 58% of vulnerability classes — zero rules for 7 of 12. I have proof, and a correction: my own headline said 80%."
description: "A 4-way benchmark on one fixture (12 vulnerability classes): Oxlint's built-in rules, eslint-plugin-security, the Interlace plugins on ESLint, and the same Interlace rules on Oxlint. eslint-plugin-security has rules for 5 of 12 classes — a 58% class-coverage gap. The URL says 80% because the original headline did; the body stands behind the checkable number."
slug: "your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof"
canonical_url: "https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof"
tier: "T3"
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
  - "devsecops"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "ESLint Security Benchmark Series"
---

Last year, a senior engineer told me their ESLint security setup was clean. It was — for the 5 vulnerability classes their linter had rules for. Nobody on that team had checked the other 7.

First, the correction I owe you: this article's URL says "missing 80%" because my first headline did. That number failed its own blunder-check — the re-verify-before-you-move habit this whole series preaches — so here is what recounting gives you. Count vulnerability classes with zero rules and you get **7 of 12 — a 58% class-coverage gap** in the most popular ESLint security plugin. Count raw findings missed on the benchmark fixture (46 total, only 21 caught) and you get 54%. Neither route reaches a round 80. 58.3% is the real, checkable number, this article stands behind it, and the frozen slug above stays as the receipt for what publishing an unchecked one costs. Coverage you can't see the boundary of is worse than no coverage, because it ends the conversation. You have a passing security pipeline and a 58% class-coverage gap simultaneously.

I took one file with 12 classes of real vulnerabilities and ran it through four linter configurations. `eslint-plugin-security` — the security linter most Node teams ship, ~1.5M downloads a week — caught **21 of 46 issues**. That 21 number is not the interesting part. The interesting part is that 21 issues across 12 vulnerability classes means it has **rules for 5 of those 12 classes and zero coverage for the other 7** — a 58-percentage-point class-coverage gap.

Here are the raw numbers, before I explain anything:

| Config                               | Engine | Findings | Vulnerability classes covered |
| ------------------------------------ | ------ | -------- | ----------------------------- |
| Oxlint built-in                      | Oxlint | **1**    | 1 of 12 (8%)                  |
| Interlace flagship (parity-wired)    | Oxlint | **5**    | 3 of 12 (25%)                 |
| eslint-plugin-security (recommended) | ESLint | **21**   | 5 of 12 (42%)                 |
| Interlace plugins (4 combined)       | ESLint | **46**   | 12 of 12 (100%)               |

_(Run: December 2025, for first publication — `eslint-plugin-security@4.0.0`; every version pinned in the [Methodology](#methodology--reproduce-it).)_

**Skip to:** [the 7 uncovered classes in code](#what-the-7-undetected-classes-look-like-in-code) · [full detection table](#the-full-detection-table) · [false positives](#false-positives--the-precision-side) · [methodology](#methodology--reproduce-it)

The fixture is 12 vulnerability classes: SQL injection, ReDoS, weak hashing, insecure randomness, unsafe deserialization, prototype pollution, `innerHTML` injection, path traversal, command injection, insecure comparisons, unsafe regex, and timing attacks. `eslint-plugin-security` has rules for 5 of them. For the other 7 — weak hashing (`md5`/`sha1` for passwords), insecure randomness (`Math.random()` in token generators), timing-safe comparisons, ReDoS, unsafe deserialization — it has no rules at all, not rules that miss some cases, **no rules**.

You have an ESLint security plugin. You have 58% of vulnerability classes undetected — zero rules, not partial coverage. Both of those are true simultaneously for most Node.js projects.

If you're shipping AI-generated code, this gap matters more than the number above suggests: the 7 missing classes are precisely the patterns Claude and Gemini emit by default — more on that below.

> Part of **The Security Engineering Protocol**. For the full 17-plugin landscape, see [I benchmarked 17 ESLint security plugins — only one found every vulnerability](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared). For the full `eslint-plugin-security` maintenance story — the dormant years, the v4 revival, and what the revival didn't fix — see [what nobody tells you about eslint-plugin-security](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h).

← [the eslint-plugin-security story](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) | [I benchmarked 17 ESLint security plugins →](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)

## Why teams don't know their coverage gap

I watched this exact sequence happen on the Node API team below: someone installed `eslint-plugin-security`, the CI check turned green, and "security lint" got checked off the list in the same standup it was raised in. Nobody asked what percentage of the threat model that check actually covered. We did.

The gap stays invisible because the mental model is wrong: "security plugin installed" reads as "security linting is done," not "security linting covers some subset of known vulnerability classes." The green CI check doesn't tell you. The `recommended` preset doesn't tell you. Nothing in the standard setup surfaces the coverage boundary.

I found this the hard way on a Node API service in a security review last October: `eslint-plugin-security` recommended, CI green, and a token generator built on `Math.random().toString(36)` had been shipping for four months. Nobody had written a bad line — the API call looks identical to a real UUID helper unless you already know `Math.random()` isn't CSPRNG-grade. The linter didn't know either; it has no rule for [CWE-338](https://ofriperetz.dev/articles/cwe-taxonomy-explained). The green check wasn't lying. It was answering a narrower question than anyone realized they were asking.

## The 58% gap is precisely defined

`eslint-plugin-security`'s recommended preset leaves 58% of vulnerability classes — 7 of 12 — without any rule coverage. **58% of vulnerability classes in the benchmark fixture have zero coverage from that preset.** This is a class-coverage claim, not a frequency or CVE-count claim. It's also exactly the shape of gap the October incident came from: the preset defines "covered" narrower than anyone on that team assumed.

The 12 classes in the fixture correspond to [OWASP Top 10](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules) categories (A01–A10) plus CWE-mapped patterns from real Node.js CVEs. They were chosen to represent the surface area a Node.js backend actually exposes — not exotic edge cases. SSRF and XXE didn't make the cut because they're server-config and XML-parser concerns respectively, not patterns a JS/TS linter can reliably catch at the AST level; the 12 here are the ones a static analysis rule can actually reach. If your threat model covers SQL injection, weak crypto, and injection patterns (and it should), the gap is real.

Coverage numbers:

- **`eslint-plugin-security` (most popular, ~1.5M weekly downloads): 42% class coverage**
- **Interlace full suite (4 domain plugins): 100% class coverage**
- **The gap: 58 percentage points on class coverage, 25 undetected findings on the same file**

Two of the 7 "zero coverage" classes deserve a caveat, not a footnote, because I checked the actual rule source rather than the rule name — and `eslint-plugin-security` ships two rules that sound closer than they are.

`detect-unsafe-regex` and `detect-non-literal-regexp` both exist in the `recommended` preset and both touch regex. Neither closes the ReDoS gap in this fixture. `detect-unsafe-regex` only flags regex _literals_ that are statically evaluable as catastrophic-backtracking-prone — under the hood it runs the `safe-regex` backtracking analysis, which requires a statically-known pattern string to evaluate. A variable can't be fed into that analysis, so it does not fire on `new RegExp(userInput)` at all — that's a structural limit of the rule, not a gap in its pattern list. `detect-non-literal-regexp` _does_ fire on `new RegExp(userInput)` — but read its check, not its name: it flags **any** non-literal `RegExp` construction, including `new RegExp(validatedPattern)` where `validatedPattern` was checked against an allowlist first. It has no attacker-control analysis; it fires identically on the dangerous line and the safe one. A rule that can't distinguish the two either gets disabled the first time it fires on validated code, or gets left on and trains the team to ignore its own warnings — both outcomes leave the actual ReDoS pattern uncaught in practice, which is why I still count this class as effectively zero-coverage rather than credit a rule that can't discriminate the failure mode it's supposedly catching.

`eslint-plugin-security` also ships `detect-possible-timing-attacks`, which sounds like it should catch `if (userToken === storedToken)`. I read the rule source directly rather than trusting the name: it only fires when the compared identifier's name is an exact, whole-word, case-insensitive match against a fixed list (`token`, `secret`, `password`, `hash`, `pass`, `auth`, `api`, `apiKey`) — a substring like `userToken` or `storedToken` does not match. So the rule stays silent on this fixture. Rename both variables to exactly `token` and `secret` — no other change — and the same rule fires on the identical comparison. That's not timing-attack detection; that's a variable-naming lint with a security-sounding name.

## What the 7 undetected classes look like in code

A senior reviewer would approve every one of these five lines in a normal diff review — that's what makes them dangerous:

```js
// CWE-327 — weak hashing. No eslint-plugin-security rule.
crypto.createHash('md5').update(password).digest('hex')

// CWE-338 — insecure randomness. No eslint-plugin-security rule.
const token = Math.random().toString(36).slice(2)

// CWE-208 — timing attack. No eslint-plugin-security rule.
if (userToken === storedToken) { ... }

// CWE-1333 — ReDoS (inefficient regex complexity). No eslint-plugin-security rule.
const re = new RegExp(userInput)

// CWE-502 — unsafe deserialization. No eslint-plugin-security rule.
const data = require('node-serialize').unserialize(req.body.config)
```

`crypto.createHash('md5')` is a real Node API doing exactly what it says — nothing in the line announces "this is the wrong primitive for a password." `Math.random()` returns a number; you have to already know it isn't CSPRNG-grade to flag it in a token generator — see [the 44K-star repo I found generating API keys this way](https://ofriperetz.dev/articles/math-random-api-keys) for how far that pattern travels unnoticed. A reviewer scanning forty files at 5pm pattern-matches on shape, and all of these have innocent shape. That's precisely the gap a domain rule closes: it knows this API, in this context, carries a CWE — so it doesn't depend on the reviewer having crypto taxonomy loaded in working memory at the moment they hit "Approve."

If one of these five looks familiar from a codebase you've worked in, that's the point — keep reading for the full table, or jump to the close for the exact question I want answered in the comments.

## The full detection table

Run across one file containing 12 vulnerability classes, the four linter configurations produce these results:

| Config                               | Engine | Findings | Notes                           |
| ------------------------------------ | ------ | -------- | ------------------------------- |
| Oxlint built-in                      | Oxlint | **1**    | `no-eval` only                  |
| Interlace flagship (3 wired rules)   | Oxlint | **5**    | the rules that are parity-wired |
| eslint-plugin-security (recommended) | ESLint | **21**   | the classic generic patterns¹   |
| Interlace (4 plugins, recommended)   | ESLint | **46**   | across 20 distinct rules        |

¹ Two `eslint-plugin-security` rules sound like they cover ReDoS and timing attacks but don't in practice on this fixture — see the caveat above `detect-unsafe-regex` / `detect-non-literal-regexp` / `detect-possible-timing-attacks`.

Oxlint's native ruleset caught a single security issue (`no-eval`) — because **Oxlint is an engine, not a security ruleset.** You pick it for speed, not coverage. The generic incumbent caught the well-known 21 across 5 vulnerability classes. The domain plugins, run together, caught 46 across 20 rules — covering all 12 classes including SQL injection (`pg/no-unsafe-query`), unsafe deserialization, ReDoS, weak hashing, insecure randomness, unsafe `innerHTML`, insecure comparisons, and more that a generic ruleset has no rule for.

Worth naming the asymmetry directly: this compares 4 domain-specific plugins against 1 generic plugin, so of course the combined set covers more ground — 4 focused tools should beat 1 generalist tool. The number that actually matters for a fair comparison is per-domain: does `eslint-plugin-pg`'s 13 SQL-focused rules alone beat what `eslint-plugin-security`'s single generic pattern-matching rule catches on the same SQL-injection surface? On this fixture, yes — `pg/no-unsafe-query` catches the interpolation pattern plus parameterization edge cases the generic rule doesn't model, because it's built against the `pg` client API instead of a generic string-concatenation heuristic. But that per-domain comparison is the one to run yourself before trusting the aggregate 46-vs-21 headline.

If you want to close the gap before reading further, the four plugins benchmarked here install as a drop-in alongside whatever you run today. If you only add one, start with whichever domain matches your stack's biggest blast radius — for most Node backends that's `eslint-plugin-node-security` (crypto, randomness, deserialization) or `eslint-plugin-pg` if you're running raw SQL:

```bash
npm i -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-pg eslint-plugin-browser-security
```

The flat-config block that wires all four (`recommended` presets) is in the [Methodology](#methodology--reproduce-it) section below — copy it, point ESLint at your `src/`, and you have the 46-finding configuration in about a minute.

## False positives — the precision side

Detection only counts if [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) holds. Run against a file of deliberately safe patterns:

| Config                 | False positives | On what                                                                                                                                 |
| ---------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Oxlint built-in        | **0**           | —                                                                                                                                       |
| Interlace @ Oxlint     | **0**           | —                                                                                                                                       |
| Interlace @ ESLint     | 3               | `pg/no-select-all` (a perf/clarity rule) ×2, conservative `browser-security/no-innerhtml` ×1                                            |
| eslint-plugin-security | **5**           | `security/detect-object-injection` on allowlist-validated keys ×3, `security/detect-non-literal-fs-filename` on path-validated reads ×2 |

The honest difference: the incumbent's 5 are **genuine [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn)** — `security/detect-object-injection` flags `obj[key]` even after `VALID_KEYS.includes(key)`, and `security/detect-non-literal-fs-filename` flags `fs.readFileSync(p)` even after `path.basename` + `startsWith` validation, because it pattern-matches the sink without seeing the guard. The Interlace "3" aren't security false positives: `no-select-all` is a performance/clarity rule firing on `SELECT *`, and `no-innerhtml` is conservative by design (it flags `innerHTML` even when the value is DOMPurify-sanitized — a deliberate choice you can disable with a documented comment).

## How Interlace rules run identically on ESLint and Oxlint

The Interlace flagship rules emit the **identical CWE-tagged finding** on both engines. [`pg/no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-query) on the same line, under ESLint and under Oxlint:

```text
🔒 CWE-89 OWASP:A03-Injection CVSS:9.8 | Unsafe SQL query detected. Variable interpolation found. | CRITICAL [SOC2,PCI-DSS,NIST-CSF]
   Fix: Use parameterized queries ($1, $2) instead of string concatenation. | https://node-postgres.com/features/queries#parameterized-queries
```

Same CWE, same OWASP category, same [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained), same compliance tags — character for character. You are **not locked to an engine**: run the full domain set on ESLint today, run the flagship rules on Oxlint for editor-speed feedback, and get the same security signal either way.

## How to read this (it's a landscape, not a leaderboard)

Oxlint is the right engine for speed but not for coverage; `eslint-plugin-security` is the familiar floor; the domain plugins add the depth the generic set has no rules for. None of these three facts is a verdict on its own — together they're a landscape:

- **Oxlint** is the right call when you want a fast engine — pair it with real security rules, because its built-in set isn't one.
- **eslint-plugin-security** is the familiar generic floor; it catches the classics but pattern-matches sinks, so it costs you false positives on validated code — and leaves 7 of 12 vulnerability classes uncovered.
- **The domain plugins** add depth (database, crypto, DOM, deserialization) the generic set has no rules for — that's the gap, not a verdict.
- **Portability** is the point: pick rules that run on both engines so the engine decision stays a performance choice, not a coverage lock-in.

## Why this gap is widening: AI-generated code hits exactly these patterns

Coding assistants emit `md5` for hashing, `Math.random()` for tokens, interpolated SQL, and unsanitized `innerHTML` by default — review-passing code that lands squarely on a CWE the incumbent linter has no rule for. When I ran this same fixture-style test on a generated NestJS service, [Claude's output alone carried 6 distinct security holes ESLint caught and TypeScript didn't](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes), and [running the identical prompt through Gemini instead of Claude changed the count from 6 to 2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) — same task, different model, different vulnerability surface. That's not a one-off: across 700 generated functions and 5 models, [65–75% of AI-written functions carried a vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), [the model that "wins" the aggregate score writes the most vulnerable database code](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain), and [one in three AI "fixes" introduces a new vulnerability class](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) rather than closing the original one. A domain rule that knows `crypto.createHash('md5')` carries CWE-327 regardless of who typed it is the guardrail that holds when the volume of generated code goes up — a generic linter that "passes" the PR is the worst possible signal precisely because it can't see what it has no rule for.

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 12 vulnerability classes; `safe-patterns.js`, validated-safe patterns), so these numbers measure coverage of the surface we designed the rules around — run it on your own code for an unbiased read. Versions (as run December 2025, for first publication): `eslint@9.39.4`, `oxlint@1.67.0`, `eslint-plugin-secure-coding@3.2.0` (27 rules), `node-security@4.2.0` (34), `pg@1.4.3` (13), `browser-security@1.2.3` (45), `eslint-plugin-security@4.0.0`. Method: each plugin's `recommended` preset, `--format json`, counted by `ruleId`. The fixtures and the `eslint-plugin-security` config live in the repo's [`packages/eslint-plugin-secure-coding/benchmark/`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-secure-coding/benchmark).

The Interlace side combines the four plugins in one flat config:

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

Config 4 (**Interlace @ Oxlint**) is the only step that needs the repo rather than npm: `git clone https://github.com/ofri-peretz/eslint && npx turbo run build`, then `npx oxlint -c .oxlintrc.flagship.json <file>` from the repo root.

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
- [I benchmarked 17 ESLint security plugins — only one found every vulnerability](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)
- [What nobody tells you about eslint-plugin-security (the maintenance story)](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)

**Going wider than one file:** once the config is in, point it at a codebase you didn't write — [the 30-minute security audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) walks the exact protocol I use to triage an unfamiliar repo with these rules on day one.

::dev-to-cta{url="https://www.npmjs.com/package/eslint-plugin-secure-coding"}
📦 `npm i -D eslint-plugin-secure-coding` — start with the first of the four plugins benchmarked here; the flat config above wires in the other three in about a minute. If the benchmark held up under your scrutiny, a [star on GitHub](https://github.com/ofri-peretz/eslint) helps too.
::

---

**The last security bug that reached your production — weak hashing, a `Math.random()` token, interpolated SQL, raw `innerHTML` — was it typed by a person at 5pm or pasted from Claude/Gemini, and did a green security check sign off on it on the way in?** Drop it in the comments; I read every one.

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [Twitter](https://twitter.com/ofriperetzdev) · [ofriperetz.dev](https://ofriperetz.dev)_
