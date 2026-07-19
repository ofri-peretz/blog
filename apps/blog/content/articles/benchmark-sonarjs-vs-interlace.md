---
devto_url: "https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
devto_id: 3240739
title: "SonarJS Has 269 Rules. It Still Missed 26 of My 40 Node.js Vulnerabilities."
description: "A reproducible fixture benchmark: eslint-plugin-sonarjs (269 rules) vs the Interlace security plugins on 40 known vulnerabilities. SonarJS is one of the best quality linters in the ecosystem — which is exactly why a green run isn't a clean Node.js security bill. Recall 35%, the 26 it misses, why they survive review, and what happens when Claude and Gemini write them. Result JSON linked."
slug: "benchmark-sonarjs-vs-interlace"
published: true
date: 2026-05-30
cover_image: "https://ofriperetz.dev/og/cover/benchmark-sonarjs-vs-interlace"
social_image: "https://ofriperetz.dev/og/article/benchmark-sonarjs-vs-interlace"
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "javascript"
  - security
  - node
  - devsecops
  - googleai
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace
tier: "T3"
reading_time_minutes: 9
author:
---

My team passed a SonarJS security check on a Node.js service and shipped a `pg` injection anyway.
The linter was green. The rule for it doesn't exist in SonarJS.

I ran a controlled benchmark to understand the true scope of the gap: **eslint-plugin-sonarjs v3.0.6 (269 rules) vs the Interlace security plugins on 40 known Node.js vulnerabilities**. The result was 14–40. SonarJS caught 14. Interlace caught all 40.

> **The Slack-quotable line:** SonarJS (v3.0.6) has 269 rules and a green run still ships `fs` path traversal, PostgreSQL injection, prototype pollution, SSRF, and unsafe deserialization — because none of those have a SonarJS rule. A 269-rule linter that says nothing about your Node.js attack surface isn't proof of safety; it's proof you ran a quality linter.

Against the 40-vulnerability fixture, SonarJS v3.0.6's [recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) is **35%** — it misses **65% of the security surface**. The 26 it misses are not edge cases. They are `fs` path traversal, prototype pollution, PostgreSQL injection, unsafe deserialization, DOM XSS, SSRF, timing attacks — the Node.js attack surface that actually ships to production.

**SonarJS wins on:** cognitive complexity, dead code, code smells, and the security basics it covers (command injection, eval, weak hashing). These are genuinely best-in-class implementations.

**Interlace wins on:** Node-specific security depth — the entire attack surface SonarJS has no rule for. This is a scope difference, not a quality difference.

**Which matters more for security-critical Node.js apps:** if your threat model includes `pg` injection, `fs` traversal, or prototype pollution — and those are the top-3 CVE classes for Node.js services — the scope gap is the one that gets you.

That's **not** a knock on SonarJS — it's a **scope** result. SonarJS is one of the best _quality_ linters in the ecosystem that happens to carry a handful of cross-language security rules. Node-specific security depth is a different product. Here's the [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability) data, why each gap survives review, and why "run both" is the only honest answer.

> Every number below is from one committed golden result file holding both
> plugins' runs —
> [`results/fn-fp-comparison/golden-2026-05-29.json`](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/fn-fp-comparison/golden-2026-05-29.json).
> Each plugin runs in isolation against the identical fixture under its
> `recommended` preset; TP/FP/FN are computed by mapping violations to the 40
> vulnerable and 38 safe functions. Versions and the exact commands are at the
> bottom — run it on your own repo for an unbiased read.

## Detection — `vulnerable.js` (40 vulnerabilities, 14 categories)

| Config                                  | TP (of 40) | Recall | Misses |
| --------------------------------------- | ---------- | ------ | ------ |
| **eslint-plugin-sonarjs** (v3.0.6, recommended) | **14**     | 35.0%  | 26     |
| Interlace security plugins (recommended)| **40**     | 100%   | 0      |

SonarJS's 14 true positives came from exactly the rules it ships for
cross-language security basics. Straight from the run's `byRule` block:
`sonarjs/os-command` (×4), `sonarjs/code-eval` (×2), `sonarjs/hashing` (×2),
`sonarjs/pseudo-random` (×2), `sonarjs/no-hardcoded-passwords` (×1),
`sonarjs/no-hardcoded-credentials` (×2), `sonarjs/insecure-jwt-token` (×1),
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

This is part of the [broader 17-plugin benchmark](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — the SonarJS result here is consistent with that field comparison.

### What a missed vulnerability actually looks like

Here is one of the 26 SonarJS misses — a PostgreSQL injection that appears in real production code and passes SonarJS's `recommended` preset without any violation:

```js
// vulnerable.js — vuln_sql_001
// SonarJS: 0 violations (no rule covers this)
// Interlace pg/no-unsafe-query: FAIL (line 3)
async function getUser(pool, userId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = ' + userId  // ← string concat into SQL
  );
  return result.rows[0];
}
```

SonarJS sees a string concatenation. It has no rule that understands `pool.query` as a SQL execution context, so it passes. `pg/no-unsafe-query` knows the pg driver's API surface and flags line 3 immediately, with [CWE-89](https://ofriperetz.dev/articles/cwe-taxonomy-explained) attached.

The fixed version — which both tools pass — uses parameterized queries:

```js
// safe-patterns.js — safe_sql_001
// SonarJS: 0 violations ✓
// Interlace pg/no-unsafe-query: 0 violations ✓
async function getUser(pool, userId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]  // ← parameterized, driver handles escaping
  );
  return result.rows[0];
}
```

This pattern — "SonarJS sees no issue, Interlace fires a named rule with a CWE" — repeats for all 26 misses. The gap is not subtlety; it's the absence of domain rules.

**This means if your team is using SonarJS as its primary security linter, you're missing CWE-89 (SQL injection), CWE-22 (path traversal), CWE-1321 (prototype pollution), CWE-918 (SSRF), and CWE-502 (unsafe deserialization) — the top vulnerability classes in production Node.js services.** The linter isn't broken; the scope just doesn't cover these.

## False positives — `safe-patterns.js` (38 safe functions)

| Config                                  | Security false positives                          |
| --------------------------------------- | ------------------------------------------------- |
| Interlace security plugins              | **0** (FPR 0.0%)                                   |
| **eslint-plugin-sonarjs** (v3.0.6, recommended) | **5** (FPR 13.2%)                                  |

This one cut against my prior. SonarJS is usually held up as the precise tool,
but on the safe fixture it raised **5** security [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) — from the
run's safe-file `byRule`: `sonarjs/os-command` (×3) on validated /
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
  randomness, hardcoded credentials, the slow-regex pattern. These are the
  14 it caught.

## Where you need domain security rules

SonarJS has no rule for most of the Node-specific attack surface: SQL string
concatenation, `fs` path traversal, prototype pollution, NoSQL/Mongo injection,
SSRF, open redirect, timing attacks, JWT claim validation (no-algorithm /
no-expiry), unsafe deserialization. Every one of those is in the run's
`missedVulnerabilities` list. Those are the gaps the domain plugins fill — not
because SonarJS is weak, but because it was built for the **breadth of
JavaScript quality**, not the **depth of Node.js security**.

If your team is using only SonarJS as its security gate and your service touches a database, the filesystem, or external HTTP calls, that gap is active right now.

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
vulnerability rate, average [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) 8.9**.
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

```bash
npm i -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-pg eslint-plugin-browser-security
```

Full rule documentation: [eslint.interlace.tools](https://eslint.interlace.tools)

## Methodology — reproduce it

**Exact corpus:** `vulnerable.js` contains 40 functions across 14 vulnerability categories; `safe-patterns.js` contains 38 validated-safe functions. Both files were authored by the Interlace team to cover the attack surface the Interlace rules target — this is a **fixture-bias caveat** you should understand before citing these numbers.

**What fixture-bias means in practice:** a 100% recall claim against a fixture you designed to match your own rules is methodologically fragile. The honest cross-validation argument is this: the 26 vulnerability classes in the fixture correspond to CVE families with documented real-world Node.js incidents (CWE-89, CWE-22, CWE-1321, CWE-918, CWE-502). They aren't invented surfaces; they're the top classes from the NVD Node.js corpus. The fixture bias is that we wrote the specific function forms — not that we invented the vulnerability classes. For an unbiased read on your codebase's actual exposure, run both configs against your own code (the commands are below). See also: the [eslint-plugin-security unmaintained article](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) for context on what "recommended" preset actually covers across the ecosystem.

**Benchmark configuration note:** this run tested `recommended` presets only. SonarJS also ships a `recommended-extended` preset with additional rules; a stricter custom config could change the recall numbers. The `recommended` configuration is what most teams use and what ships out of the box, which is why it's the benchmark baseline — but a senior engineer deploying a custom SonarJS config should run their specific ruleset against these fixtures before drawing conclusions.

**Scoring:** each plugin runs in isolation, `--format json`, no other plugins active. Violations are mapped to the 40 vulnerable and 38 safe functions to compute TP (true positive), FP (false positive), and FN (false negative). A TP is a violation on a line tagged as vulnerable in the fixture; an FP is a violation on a safe function; an FN is a vulnerable function with zero violations.

The numbers are not asserted; they're in a committed golden result file you can
read line-by-line —
[`golden-2026-05-29.json`](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/results/fn-fp-comparison/golden-2026-05-29.json),
which carries a `plugins.sonarjs` and a `plugins.interlace` block side by side.
The versions pinned for each run:
`eslint-plugin-sonarjs@3.0.6` (269 rules) for the SonarJS run;
`eslint-plugin-secure-coding@3.0.2`, `eslint-plugin-node-security@4.2.0`,
`eslint-plugin-pg@1.4.3`, `eslint-plugin-jwt@2.2.3`,
`eslint-plugin-mongodb-security@8.2.3`, `eslint-plugin-browser-security@1.2.3`
for the Interlace run.

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

This is the SonarJS cut of a larger comparison set. For the full field ranking across 17 plugins, see the [complete benchmark](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared):

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
  — the per-model breakdown behind the Gemini result above.
- [The AI Hydra Problem: Fix One AI Bug, Get Two
  More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)
  — why a green linter plus an AI "fix" can still leave you exposed.
- [eslint-plugin-security Is Unmaintained — Here's What Nobody Tells You](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)
  — why the most-installed security plugin has a 0 TP rate on this fixture.

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

If SonarJS is your current security linter and it's missing the `pg` injection and `fs` traversal families, have you seen that gap surface in production? Pull the last `fs`, `child_process`, or `pool.query` bug that made it to production in your codebase. Go back to that PR. Was the security linter green when it was approved? I'd bet it was — and I want to hear the one that got through. What was the line, and what tool said it was fine? Drop it in the comments.

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

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
