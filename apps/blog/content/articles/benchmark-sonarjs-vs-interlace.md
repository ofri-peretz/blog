---
devto_url: "https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
devto_id: 3240739
title: "SonarJS Has 269 Rules. On 40 Vulnerabilities It Caught 14 — It Misses 65% of the Security Surface."
description: "A reproducible fixture benchmark: eslint-plugin-sonarjs (269 rules) vs the Interlace security plugins on 40 known vulnerabilities. SonarJS is one of the best quality linters in the ecosystem — which is exactly why a green run isn't a clean Node.js security bill. Recall 35%, the 26 it misses, why they survive review, and what happens when Claude and Gemini write them. Result JSON linked."
slug: "benchmark-sonarjs-vs-interlace"
published: true
date: 2026-05-30
cover_image: "https://ofriperetz.dev/og/cover/benchmark-sonarjs-vs-interlace"
social_image: "https://ofriperetz.dev/og/article/benchmark-sonarjs-vs-interlace"
tags:
  - security
  - ai
  - eslint
  - geminichallenge
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace
reading_time_minutes: 8
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

`eslint-plugin-sonarjs` ships **269 rules** and clears 3M+ weekly downloads.
I ran it against a fixture of **40 known Node.js vulnerabilities**. It caught
**14**. The Interlace security plugins caught **40 of 40** on the same file.

Against that 40-vuln baseline, SonarJS's recall is **35%** — it misses **65%**
of the security surface, and the 26 it misses are not edge cases. They are `fs`
path traversal, prototype pollution, PostgreSQL injection, unsafe
deserialization, DOM XSS, SSRF, timing attacks. The Node.js attack surface, the
part that actually ships to production.

If your security gate is "SonarJS is green," that 65% is the gap you're
shipping.

That's **not** a knock on SonarJS — it's a **scope** result. SonarJS is one of
the best _quality_ linters in the ecosystem that happens to carry a handful of
cross-language security rules. Node-specific security depth is a different
product. Here's the reproducible data, why each gap survives review, and why
"run both" is the only honest answer.

> Every number below is from two committed result files — SonarJS:
> [`results/fn-fp-comparison/2026-05-29.json`](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/fn-fp-comparison/2026-05-29.json),
> Interlace:
> [`2026-05-30.json`](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/fn-fp-comparison/2026-05-30.json).
> Each plugin runs in isolation against the identical fixture under its
> `recommended` preset; TP/FP/FN are computed by mapping violations to the 40
> vulnerable and 38 safe functions. Versions and the exact commands are at the
> bottom — run it on your own repo for an unbiased read.

## Detection — `vulnerable.js` (40 vulnerabilities, 14 categories)

| Config                                  | TP (of 40) | Recall | Misses |
| --------------------------------------- | ---------- | ------ | ------ |
| **eslint-plugin-sonarjs** (recommended) | **14**     | 35.0%  | 26     |
| Interlace security plugins (recommended)| **40**     | 100%   | 0      |

SonarJS's 14 true positives came from exactly the rules it ships for
cross-language security basics. Straight from the run's `byRule` block:
`sonarjs/os-command` (×4), `sonarjs/code-eval` (×2), `sonarjs/hashing` (×2),
`sonarjs/pseudo-random` (×2), `sonarjs/no-hardcoded-passwords` (×1),
`sonarjs/hardcoded-secret-signatures` (×2), `sonarjs/insecure-jwt-token` (×1),
`sonarjs/slow-regex` (×1). Those are genuinely good rules — `os-command` in
particular is best-in-class.

The 26 SonarJS misses are the **Node-specific depth** it has no rule for. The
Interlace run catches every one; a sample of which rule fires, from that run's
`byRule` block: `fs`-path traversal
(`node-security/detect-non-literal-fs-filename` ×4), object injection /
prototype-pollution (`secure-coding/detect-object-injection` ×4), PostgreSQL
injection (`pg/no-unsafe-query` ×4), unsafe deserialization
(`secure-coding/no-unsafe-deserialization` ×3), DOM XSS
(`browser-security/no-innerhtml` ×1), SSRF (`node-security/no-ssrf` ×2),
NoSQL injection (`mongodb-security/no-unsafe-query` ×2), timing attacks
(`secure-coding/no-insecure-comparison` ×2), and more.

If those rule IDs map to lines in your own codebase, you don't need to read to
the end first. Add the security half next to SonarJS now — it's additive, not a
replacement:

```bash
npm i -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-pg eslint-plugin-browser-security
```

The full flat-config block — SonarJS for quality, these four for security in the
same run — is [below](#the-real-answer-run-both).

## False positives — `safe-patterns.js` (38 safe functions)

| Config                                  | Security false positives                          |
| --------------------------------------- | ------------------------------------------------- |
| Interlace security plugins              | **0** (FPR 0.0%)                                   |
| **eslint-plugin-sonarjs** (recommended) | **5** (FPR 13.2%)                                  |

This one cut against my prior. SonarJS is usually held up as the precise tool,
but on the safe fixture it raised **5** security false positives — from the
run's safe-file `byRule`: `sonarjs/no-os-command-from-path` (×3) on validated /
no-shell spawn calls, plus `sonarjs/pseudo-random` (×1) on a non-crypto shuffle
and `sonarjs/slow-regex` (×1) on a simple regex. They're defensible heuristics,
not bugs — but they are noise on safe code, so "SonarJS is the precise one" is
not what the numbers say here. The Interlace security run flagged **0** of the
38 safe functions (precision 100% on this fixture).

## Where SonarJS is the right call

- ✓ **Cognitive complexity** — one of the best implementations anywhere.
- ✓ **Dead code / unused assignments / redundant logic** — the `no-dead-store`,
  `no-unused-collection`, all-identical-comparison family.
- ✓ **Code smells** — duplicate branches, collapsible conditionals.
- ✓ **The security basics** — command injection, eval, weak hashing, insecure
  randomness, hardcoded-secret signatures, the slow-regex pattern. These are the
  14 it caught.

## Where you need domain security rules

SonarJS has no rule for most of the Node-specific attack surface: SQL string
concatenation, `fs` path traversal, prototype pollution, NoSQL/Mongo injection,
SSRF, open redirect, timing attacks, JWT claim validation (no-algorithm /
no-expiry), unsafe deserialization. Every one of those is in the run's
`missedVulnerabilities` list. Those are the gaps the domain plugins fill — not
because SonarJS is weak, but because it was built for the **breadth of
JavaScript quality**, not the **depth of Node.js security**.

## Why these 26 survive code review

None of the 26 SonarJS-misses are exotic. They survive review because of a
process gap I've watched play out on real teams, not a knowledge gap.

A senior reviewer opens the PR. CI is green — SonarJS, the linter with 269
rules, found nothing. The diff is a `fs.readFile(path.join(base, req.query.f))`
or a `pool.query('SELECT * FROM users WHERE id = ' + id)`. The reviewer's brain
runs the same shortcut everyone's does under a full sprint: _"the security
linter would have caught it if it mattered."_ Green tool, trusted name, big
rule count — approve.

That's the trap. SonarJS being **excellent at what it does** is exactly what
makes its silence on `fs` traversal read as a clean bill of health. The reviewer
isn't being careless — they're trusting a tool whose scope they never checked.
A 269-rule linter that finds zero security issues feels like proof of safety. It
isn't. It's proof you ran a quality linter.

The fix isn't "review harder." It's making the gate's scope honest: a
Node-security rule that fails the build on the exact line, with the CWE attached,
so "CI is green" actually means the Node attack surface was checked.

## What happens when AI writes the code

This stopped being only a human-reviewer problem the day a model started writing
the diff. AI assistants reproduce the Node-specific classes SonarJS has no rule
for, because the unsafe form is the most common form in their training data:
`fs`/`path.join` straight onto request input, `pg` queries built by string
concatenation, prototype-pollution sinks, unsafe deserialization. (SonarJS does
catch the cross-language basics it ships rules for — `os-command`, weak hashing,
`eval` — which is exactly why a green run lulls everyone past the gaps it can't
see. Note it did **not** catch the SQL-injection class on this fixture: all four
`vuln_sql_*` cases are in its `missedVulnerabilities` list.) I've measured the
model side of this directly —
[65-75% of Claude-generated Node functions shipped with a
vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
and the same SonarJS-blind classes recurred when [Claude wrote a full NestJS
service](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).

### It is not a Claude problem — Gemini reproduces the same blind spots

To be sure this wasn't one vendor, I ran the same generate-then-scan harness on
Gemini. Asked to write 195 ordinary Node.js functions (database access,
auth, file I/O, command execution, secrets) at 10 samples per prompt,
**`gemini-3-pro-cli` shipped a vulnerability in 113 of them — a 58%
vulnerability rate, average CVSS 8.9**
([checkpoint JSON](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/ai-security/checkpoints/checkpoint-gemini-3-pro-cli-treatment-10iter.json)).
The rules that fired on Gemini's code are the exact families SonarJS has no rule
for: `pg/no-unsafe-query`, `secure-coding/detect-object-injection`,
`node-security/detect-non-literal-fs-filename`, `node-security/no-ssrf`,
`jwt/require-expiration`, `jwt/require-algorithm-whitelist`. Same prompt class,
same blind spot, different model. (I split the model-vs-model detail out into a
[Claude-vs-Gemini NestJS
comparison](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
if you want the per-error breakdown.)

So the loop tightens: the model — Claude or Gemini — emits a `pg` injection,
TypeScript compiles, SonarJS stays green, the human applies the "the linter
would've caught it" shortcut, and it ships. Every layer is individually
reasonable; the surface nobody owns is Node-specific security. That's the layer
the domain plugins are built for — and it's the layer that has to hold when the
author isn't a human who can be asked "did you sanitize this?"

## The real answer: run both

SonarJS for quality, the domain plugins for security. They don't overlap enough
to conflict, and together they cover both axes:

```js
// eslint.config.mjs
import sonarjs from "eslint-plugin-sonarjs";
import { configs as secureCoding } from "eslint-plugin-secure-coding";
import { configs as nodeSecurity } from "eslint-plugin-node-security";
import { configs as pg } from "eslint-plugin-pg";
import { configs as jwt } from "eslint-plugin-jwt";
import { configs as mongodbSecurity } from "eslint-plugin-mongodb-security";
import { configs as browserSecurity } from "eslint-plugin-browser-security";

export default [
  sonarjs.configs.recommended, // quality
  secureCoding.recommended, // general security, proto-pollution, deserialization
  nodeSecurity.recommended, // crypto, SSRF, fs, child_process
  pg.recommended, // PostgreSQL
  jwt.recommended, // JWT claim/algorithm validation
  mongodbSecurity.recommended, // NoSQL injection
  browserSecurity.recommended, // DOM / browser
];
```

## Methodology — reproduce it

Honest disclosure: the fixtures are **team-authored** (`vulnerable.js`, 40
vulnerabilities across 14 categories; `safe-patterns.js`, 38 validated-safe
functions), so they measure coverage of the surface the Interlace rules target —
run it on your own code for an unbiased read.

The numbers are not asserted; they're in two committed result files you can
diff line-by-line:
[SonarJS run](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/fn-fp-comparison/2026-05-29.json)
and
[Interlace run](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/fn-fp-comparison/2026-05-30.json).
Versions are pinned from each file's `installedVersions` block:
`eslint-plugin-sonarjs@3.0.6` (269 rules) for the SonarJS run;
`eslint-plugin-secure-coding@3.0.2`, `eslint-plugin-node-security@4.2.0`,
`eslint-plugin-pg@1.4.3`, `eslint-plugin-jwt@2.2.3`,
`eslint-plugin-mongodb-security@8.2.3`, `eslint-plugin-browser-security@1.2.3`
for the Interlace run. Each plugin runs in isolation under its `recommended`
preset, `--format json`, and violations are mapped to the 40 vulnerable / 38
safe functions to compute TP / FP / FN.

```bash
npm i -D eslint-plugin-sonarjs@3.0.6 eslint-plugin-secure-coding@3.0.2 \
  eslint-plugin-node-security@4.2.0 eslint-plugin-pg@1.4.3 \
  eslint-plugin-jwt@2.2.3 eslint-plugin-mongodb-security@8.2.3 \
  eslint-plugin-browser-security@1.2.3
npx eslint --config eslint.config.sonarjs.mjs test-files/vulnerable.js --format json
npx eslint --config eslint.config.interlace.mjs test-files/vulnerable.js --format json
```

(On ESLint 8, set `ESLINT_USE_FLAT_CONFIG=true` to load `eslint.config.mjs`;
ESLint 9+ uses flat config by default. For the Oxlint and `eslint-plugin-security`
rows on the same fixtures, see the
[4-way benchmark](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof) —
in the comprehensive 17-plugin run, `eslint-plugin-security` scored 0 true
positives on this fixture.)

## More in the ESLint Security Benchmark Series

This is the SonarJS cut of a larger comparison set — same fixtures, same
`recommended`-preset methodology, one tool per article:

- [I Benchmarked 17 ESLint Security Plugins. Only One Found Every
  Vulnerability.](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared)
  — the full field, SonarJS included, ranked by detection.
- [Your ESLint Security Plugin Is Missing 80% of
  Vulnerabilities](https://ofriperetz.dev/articles/your-eslint-security-plugin-is-missing-80-of-vulnerabilities-i-have-proof)
  — the multi-engine version of this benchmark (ESLint + Oxlint, built-in +
  plugins) on the same fixtures.
- [Microsoft SDL vs
  Interlace](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)
  — the same scope question for a different "respected name with a few security
  rules."
- [Same NestJS Prompt: Claude Got 6 Security Errors, Gemini Got
  2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
  — the per-model breakdown behind the Gemini result above (`#googleai`
  `#geminichallenge`).
- [The AI Hydra Problem: Fix One AI Bug, Get Two
  More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)
  — why a green linter plus an AI "fix" can still leave you exposed.

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

## Your turn

Pull the last `fs`, `child_process`, or `pool.query` bug that made it to
production in your codebase. Go back to that PR. Was the security linter green
when it was approved? I'd bet it was — and I want to hear the one that got
through. What was the line, and what tool said it was fine? Drop it in the
comments.

---

## Links

- 📦 [secure-coding](https://www.npmjs.com/package/eslint-plugin-secure-coding) · [node-security](https://www.npmjs.com/package/eslint-plugin-node-security) · [pg](https://www.npmjs.com/package/eslint-plugin-pg) · [browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
- 📦 [eslint-plugin-sonarjs](https://www.npmjs.com/package/eslint-plugin-sonarjs) — the quality half
- 📖 [Full rule docs](https://eslint.interlace.tools)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you run SonarJS for quality and want the Node.js security half — the layer that has to hold when AI is writing the diff — to match.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
