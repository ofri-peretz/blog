---
devto_url: "https://dev.to/ofri-peretz/the-false-positive-tax-a-11-tpfp-analysis-of-eslint-plugin-security-1kkg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-security-fn-fp-benchmark.jpg"
devto_id: 3241882
title: "1.5M Weekly Downloads, 1 False Alarm per Real Bug: the eslint-plugin-security False-Positive Tax"
description: "The most-installed security linter on npm flags one safe pattern for every real vulnerability it catches — a 1:1 true-positive-to-false-positive ratio at 27.5% recall. Six plugins benchmarked side-by-side, with the false-positive code samples that train teams to ignore the tool."
slug: "eslint-security-fn-fp-benchmark"
published: true
date: 2026-02-08
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/eslint-security-fn-fp-benchmark.jpg"
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "javascript"
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark
tier: "T3"
reading_time_minutes: 15
author:
---

The most-installed security linter on npm raises exactly one false alarm for every real bug it catches. That's `eslint-plugin-security`, 1.5M installs a week, run through 40 vulnerable code patterns alongside five competitors: a 1:1 true-positive-to-false-positive ratio, at 27.5% recall. Every warning it shows your team arrives with even odds of being wrong — and teams learn those odds fast, then stop reading the warnings.

**Version scope, stated up front:** the FN/FP numbers in this article are from `eslint-plugin-security` **v2.1.1**, the last release before the plugin moved to the `eslint-community` org. If your `package.json` already pins v3+ or v4+, the ESLint-9 crash this article documents doesn't apply to you — but the precision/recall numbers haven't been re-run against the newer major, so treat "1 false alarm per real bug" as v2.1.1's verdict, not yet a confirmed verdict on what you have installed today.

**Skip to:** [Results Table](#the-results) | [eslint-plugin-security](#eslint-plugin-security-the-incumbent) | [SonarJS](#eslint-plugin-sonarjs-the-269-rule-giant) | [Microsoft SDL](#microsofteslint-plugin-sdl-enterprise-security) | [Interlace](#interlace-ecosystem) | [Methodology](#methodology)

I didn't expect the noise to be as bad as the signal. I expected the low recall going in. What I didn't expect was that the false-positive count would match the true-positive count exactly. That failure mode plays out quietly in shared configs, not in incident reports.

> "At 50% precision, every security warning your team sees is a coin flip. Nobody keeps auditing coin flips."

---

## A note on this benchmark

**Before the numbers: I got one of them wrong in the first draft.** My initial sample output in the Interlace section labeled the `eval()` CWE-95 finding as **HIGH** severity. Re-deriving it against [CVSS v3.1](https://ofriperetz.dev/articles/cvss-scores-explained) during the same review pass that caught the OWASP category errors below showed it's actually **CRITICAL** (9.8) — full arbitrary code execution, not a lesser finding. Had that gone uncaught, the article would have understated the one vulnerability class it makes the strongest claim about. That's the instinct this entire benchmark asks you to apply to plugin vendors' own claims — including mine — so here it is applied to my own draft first.

**Full disclosure before the numbers:** I'm the author of the Interlace ESLint ecosystem, and Interlace scores 100%/0 FP in this benchmark. The skeptic read — "he built the test to fit his tool" — is the right instinct, so I'll give you the means to disprove it.

**How a [false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) is counted, stated explicitly because it's load-bearing:** a firing is an FP if the flagged pattern is not exploitable _as written_ — regardless of whether the underlying rule concept is sound. That's a real methodological choice, not a neutral default: the SonarJS `no-os-command-from-path` firings later in this piece are rules working _correctly_ (the command genuinely resolves through PATH) on code that isn't exploitable here (the argument is a hardcoded literal, not attacker-controlled). Counting "correct rule, wrong scope for this fixture" as an FP is a stricter bar than "rule made a logical error," and it's the bar every plugin in this benchmark is held to, including Interlace's own rules.

The fixture suite was built first, against published [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) categories and [CWE mappings](https://ofriperetz.dev/articles/cwe-taxonomy-explained), before I wrote a single Interlace rule to cover it. Every fixture, every vulnerable pattern, every safe pattern is in the [public GitHub repo](https://github.com/ofri-peretz/eslint-benchmark-suite). If you run the benchmark against only the five non-Interlace plugins, the recall numbers don't change. The methodology is in the [Reproducibility section](#reproducibility) — one command, public repo, verifiable output — and the full anti-cheating protocol I hold myself to, given the conflict, is written up separately in [I built what I benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat). I built this to quantify what I made, not to sell it. The numbers either hold up when you run them yourself, or they don't.

---

## TL;DR

I built a benchmark with **40 vulnerable code patterns** across 14 security categories and **38 safe patterns** that should NOT trigger warnings. Then I ran **six ESLint security plugins** against them.

### The Headline Numbers

> Plugin download counts cited throughout this article are weekly figures snapshotted on 2026-02-08 from [npm-stat.com](https://npm-stat.com).

| Plugin                           | Rules | TP (Detections) | FP (False Alarms) | Precision | Recall | F1 Score   | ESLint 9       |
| -------------------------------- | ----- | --------------- | ----------------- | --------- | ------ | ---------- | -------------- |
| **eslint-plugin-sonarjs**        | 269   | 14/40           | 5                 | 73.7%     | 35.0%  | 47.5%      | ✅ Works       |
| **eslint-plugin-security** †     | 13    | 11/40           | 11                | 50.0%     | 27.5%  | 35.5%      | ⚠️ v2.1.1 only |
| **eslint-plugin-security-node**  | 22    | 7/40            | 4                 | 63.6%     | 17.5%  | 27.4%      | ✅ Works       |
| **@microsoft/eslint-plugin-sdl** | 17    | 4/40            | 1                 | 80.0%     | 10.0%  | 17.8%      | ✅ Works       |
| **eslint-plugin-no-unsanitized** | 2     | 2/40            | 1                 | 66.7%     | 5.0%   | 9.3%       | ✅ Works       |
| **Interlace Ecosystem**          | 198   | **40/40**       | **0**             | 100.0%    | 100.0% | **100.0%** | ✅ Works       |

> † `eslint-plugin-security` was benchmarked at **v2.1.1**, the last release under the plugin's original maintainer, which crashes on ESLint 9 with `context.getScope is not a function`. Its results here are from ESLint 8.57.0. The plugin has since passed to the `eslint-community` org: v3.0.0+ (April 2024 onward, per the [npm version history](https://www.npmjs.com/package/eslint-plugin-security?activeTab=versions)) ships flat-config support and runs cleanly on ESLint 9 — I verified `detect-child-process` still fires correctly on v4.0.1 with ESLint 9.39. The precision/recall numbers below are still v2.1.1-only and have not been re-run against v3+; treat the ESLint-9 compatibility claims and the FN/FP numbers as two separate facts. All other plugins were tested on ESLint 9.39.2; each row's exact version and measurement date is in [The Leaderboard](#the-leaderboard) and the per-run [environment table](#test-environment) (Interlace's row: v3.0.2, measured 2026-05-30).

**Key Findings:**

- `eslint-plugin-security` has a **1:1 true positive to false positive ratio** — for every real issue it catches, it incorrectly flags a safe pattern
- **One rule causes three-quarters of that noise:** `detect-object-injection` alone accounts for 8 of the plugin's 11 false positives — 20% precision on that single rule, hiding inside the 50% whole-plugin average
- `eslint-plugin-sonarjs` has **269 rules** but only detects 35% of vulnerabilities — most rules target code quality, not security
- `eslint-plugin-security-node` (the "successor" to eslint-plugin-security) still misses 82.5% of vulnerabilities
- The Interlace ecosystem achieved a **perfect score**: 40/40 detections with zero false positives

---

## Why This Benchmark Matters

Two failure modes undermine a security linter: false negatives ship an illusion of clean code, false positives train developers to ignore the tool entirely. Most teams optimize for recall and forget that [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) is what keeps recall usable.

And this is a 2026 problem more than a 2020 one: AI assistants have shifted the [base rate](https://ofriperetz.dev/articles/base-rate-problem-explained) of vulnerable patterns entering codebases, which turns a linter's recall number into its actual catch rate — the full argument is in [The AI Multiplier](#the-ai-multiplier-why-recall-stopped-being-optional) below.

---

## The Benchmark Suite

The suite pairs 40 vulnerable patterns against 38 safe look-alikes across 14 OWASP/CWE categories, so every plugin gets tested on both what it should catch and what it should leave alone.

### Vulnerable Patterns (40 cases across 14 categories)

| Category              | Test Cases | CWEs                   |
| --------------------- | ---------- | ---------------------- |
| SQL Injection         | 4          | CWE-89                 |
| Command Injection     | 4          | CWE-78                 |
| Path Traversal        | 4          | CWE-22                 |
| Hardcoded Credentials | 4          | CWE-798                |
| JWT Vulnerabilities   | 3          | CWE-757, CWE-347       |
| XSS / Code Execution  | 4          | CWE-79, CWE-94, CWE-95 |
| Prototype Pollution   | 3          | CWE-1321               |
| Insecure Randomness   | 2          | CWE-330                |
| Weak Cryptography     | 3          | CWE-328, CWE-327       |
| Timing Attacks        | 2          | CWE-208                |
| NoSQL Injection       | 2          | CWE-943                |
| SSRF                  | 2          | CWE-918                |
| Open Redirect         | 1          | CWE-601                |
| ReDoS                 | 2          | CWE-1333               |

> The XSS/Code-Execution row spans the injection family (CWE-79, CWE-94, CWE-95). The Interlace sample output below tags `eval()` as CWE-95 rather than the broader CWE-94 because it reports the most specific applicable weakness — the parent/child mechanics behind that choice are in [the CWE taxonomy canonical](https://ofriperetz.dev/articles/cwe-taxonomy-explained).

### Safe Patterns (38 cases)

Secure implementations that should NOT trigger any warnings:

- Parameterized SQL queries (Prisma, TypeORM, pg)
- execFile with validated arguments
- path.resolve with startsWith validation
- Environment variables for credentials
- JWT with explicit algorithm restriction
- DOMPurify sanitization
- Allowlist validation before object access
- crypto.randomBytes for tokens
- crypto.timingSafeEqual for comparisons
- URL allowlists for SSRF prevention

---

## The Results

Across 40 vulnerable patterns, detection rates ranged from 5% to 100% — and at the most-downloaded plugin, false alarms matched real catches 1:1.

### Detection Summary

```text
Vulnerable Code Detections (out of 40 patterns):

Interlace Ecosystem:         ████████████████████████████████████████  40 (100%)
eslint-plugin-sonarjs:       ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  14 (35%)
eslint-plugin-security:      ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11 (27.5%)
eslint-plugin-security-node: ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   7 (17.5%)
@microsoft/eslint-plugin-sdl:████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4 (10%)
eslint-plugin-no-unsanitized:██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   2 (5%)
```

### The Leaderboard

| Rank | Plugin                       | Version | Rules | TP     | FP    | FN    | Precision  | Recall     | F1         |
| :--- | :--------------------------- | :------ | :---- | :----- | :---- | :---- | :--------- | :--------- | :--------- |
| 🥇   | **Interlace Ecosystem**      | 3.0.2   | 198   | **40** | **0** | **0** | **100.0%** | **100.0%** | **100.0%** |
| 🥈   | eslint-plugin-sonarjs        | 3.0.6   | 269   | 14     | 5     | 26    | 73.7%      | 35.0%      | 47.5%      |
| 🥉   | eslint-plugin-security†      | 2.1.1   | 13    | 11     | 11    | 29    | 50.0%      | 27.5%      | 35.5%      |
| 4    | eslint-plugin-security-node  | 1.1.4   | 22    | 7      | 4     | 33    | 63.6%      | 17.5%      | 27.4%      |
| 5    | @microsoft/eslint-plugin-sdl | 1.1.0   | 17    | 4      | 1     | 36    | 80.0%      | 10.0%      | 17.8%      |
| 6    | eslint-plugin-no-unsanitized | 4.1.4   | 2     | 2      | 1     | 38    | 66.7%      | 5.0%       | 9.3%       |

> † v2.1.1 tested on ESLint 8.57.0 — crashes on ESLint 9. Fixed in v3.0.0+ (see the headline table footnote).

---

## Plugin Deep Dives

### eslint-plugin-security: The Incumbent

**Weekly Downloads:** 1.5M+ | **Rules:** 13 (v2.1.1) | **Benchmarked version:** 2.1.1 (Feb 2024) | **ESLint 9 (v2.1.1):** ❌ Broken

#### What It Detected (11 violations)

| Rule                             | Count | Lines              |
| -------------------------------- | ----- | ------------------ |
| `detect-non-literal-fs-filename` | 4     | 106, 115, 124, 134 |
| `detect-child-process`           | 2     | 64, 73             |
| `detect-object-injection`        | 2     | 264, 276           |
| `detect-eval-with-expression`    | 1     | 243                |
| `detect-unsafe-regex`            | 1     | 432                |
| `detect-non-literal-regexp`      | 1     | 441                |

#### What It Missed (29 patterns = 72.5% False Negative Rate)

Two categories it actually handles: path traversal (4/4) and ReDoS (2/2). Everything else is partial or absent — command injection (2/4: it catches `exec()` with string concatenation and with a template literal, but misses `execSync` and `spawn(..., { shell: true })`), XSS/eval (1/4, misses `innerHTML` and `document.write`), prototype pollution (2/3).

**The plugin scored zero detections on:** SQL injection, hardcoded credentials, JWT attacks, weak crypto, NoSQL injection, SSRF, open redirects, and timing attacks. Two of those deserve a precise caveat rather than "zero coverage": `eslint-plugin-security` does ship `detect-possible-timing-attacks` and `detect-pseudoRandomBytes` rules, both enabled in this benchmark's config — they simply didn't match this fixture suite's code shapes (`detect-pseudoRandomBytes` only flags `crypto.pseudoRandomBytes()`, not `Math.random()`; the timing-attack rule's AST heuristic didn't fire on this suite's `===` comparisons). The plugin genuinely has no rule at all for the other six categories. The full per-category grid for all six plugins is in the [Category-by-Category Breakdown](#category-by-category-breakdown) — read it one column at a time, not as an aggregate.

#### The False Positive Problem: 11 FPs Across 22 Total Positives

For every real vulnerability `eslint-plugin-security` catches, it also incorrectly flags a safe pattern. That's a 50% precision rate — note the framing carefully: 11 FPs out of 22 total positive detections (11 TP + 11 FP), not 100% of detections as sometimes stated.

#### The One Rule Doing Most of the Damage: `detect-object-injection`

Eight of the plugin's eleven false positives — nearly three-quarters of the noise — come from a single rule. 20% precision, on its own, is the real headline hiding inside the 50% whole-plugin average.

```javascript
// ✅ SAFE: Key validated against allowlist
const VALID_KEYS = ["name", "email", "age"];
if (VALID_KEYS.includes(key)) {
  return obj[key]; // ⚠️ Flagged as "Generic Object Injection Sink"
}
```

The rule flags **any** bracket notation with a variable, regardless of validation. It cannot recognize allowlist checks, `hasOwnProperty` guards, or `Object.hasOwn()` checks. Eight of the 10 total `detect-object-injection` firings were false alarms — the asymmetry (8 FP, 2 TP) is stark and worth calling out, because a 20%-precision rule at that volume is what gets disabled.

**How Interlace's equivalent rule avoids the same 8 false positives, concretely:** its `detect-object-injection` walks up the AST from the bracket access looking for one of three specific guard shapes in an enclosing or immediately-preceding `if` — `ARRAY.includes(key)`, `obj.hasOwnProperty(key)` / `Object.prototype.hasOwnProperty.call(obj, key)` / `Object.hasOwn(obj, key)`, or `key in obj` — and treats a preceding sibling `if` as a guard too when its body throws or returns. That's not dataflow or taint analysis; it's pattern-matching against three known validation idioms plus a fixed list of other safe shapes (numeric/loop-counter keys, `for...in`/`Object.keys()` iteration variables, `SCREAMING_SNAKE_CASE` constants, typed-array indices). It'll miss a validation style outside that list the same way `eslint-plugin-security`'s rule misses all of them — the difference here is breadth of recognized guards, not a fundamentally different analysis technique.

**Honest reconciliation with the headline:** the "1 false alarm per real bug" framing is a whole-plugin average, and one rule is doing almost all of the damage. Pull `detect-object-injection` out entirely — its 2 true positives along with its 8 false positives — and the other 5 rules combine for 9 TP / 3 FP, roughly 3:1 real catches per false alarm, not 1:1. The other side of that trade: `detect-object-injection` is also this plugin's only line of defense against prototype-pollution-style object injection, so muting it isn't free — you'd trade a 20%-precision rule for zero coverage in that category. The practical takeaway isn't "the whole plugin is 50-50," it's "one AST-only rule can't tell a validated lookup from an unvalidated one, and teams pay for that in the one place they can't easily route around."

**FP #9-11: `detect-non-literal-fs-filename`** (3 false positives)

```javascript
// ✅ SAFE: Path validated with startsWith
const safePath = path.resolve(baseDir, path.basename(filename));
if (!safePath.startsWith(baseDir + path.sep)) {
  throw new Error("Path traversal detected");
}
fs.readFileSync(safePath); // ⚠️ Flagged anyway
```

The rule cannot recognize path validation patterns — it flags the `readFileSync` call regardless of what happens three lines above it.

#### Why these false positives survived code review

Both FP samples above are code a reviewer _approved_. That's the part worth sitting with. The `detect-object-injection` warning fires on `obj[key]` even though the key was just checked against an allowlist three lines up — and the reviewer who approved that PR was right: the code is safe. So the rule and the human disagree, the human is correct, and the warning gets silenced.

The silencing is the problem. It almost never happens with a targeted `// eslint-disable-next-line` on the one safe line. What I've actually seen ship is the load-bearing shortcut: someone gets tired of suppressing `detect-object-injection` on the tenth validated lookup, and the rule goes into the project's `off` list in the shared config. Now it's off for the validated lookups _and_ for the unvalidated one a junior adds six months later. The rule was demoted not because it was wrong about the danger, but because it was wrong too often about safe code.

**The human failure here is reasonable frustration.** A developer who has correctly added three allowlist guards this sprint, watched the linter flag all three as violations, and seen a senior engineer confirm "yes those are fine, suppress it" — that developer isn't being careless when they move the rule to `off`. They're pattern-matching off their last ten interactions with the tool. A precise rule earns the benefit of the doubt; a 50%-precision rule spends it, and a senior signs off on the disable because the alternative is a wall of noise nobody reads.

If you want to see how security gaps widen after a rule gets moved to `off`, a [30-minute static analysis audit during onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) is the fastest way to find what shipped through the gap.

#### ESLint 9 Compatibility: ❌ BROKEN — but only on the version benchmarked here

```text
TypeError: context.getScope is not a function
Rule: "security/detect-child-process"
```

This is the exact crash on v2.1.1, the last release before the plugin moved to the `eslint-community` GitHub org. **Correction from an earlier draft of this article:** v3.0.0+ (shipped April 2024, well before this benchmark ran) already carries flat-config support, and I confirmed `security/detect-child-process` fires correctly on v4.0.1 against ESLint 9.39 with zero crash. So the "broken on ESLint 9" framing only applies to the specific 2.1.1 release tested — it is not true of the plugin as currently published. The precision/recall numbers in this article are still from v2.1.1 and have not been re-run against v3+; don't read "still crashes" into the FN/FP columns, and don't assume the newer major changes the detection numbers until someone (likely a follow-up here) reruns the fixture suite against it.

---

### eslint-plugin-sonarjs: The 269-Rule Giant

**Weekly Downloads:** 3M+ | **Rules:** 269 | **Last Updated:** 2025 (active) | **ESLint 9:** ✅ Works

#### What SonarJS Was Configured With

Before reading the numbers: SonarJS ships two distinct rule categories — `sonarjs` (code quality and cognitive complexity) and the security-focused rules in the same package. In this benchmark, I activated **both** — the full plugin with all rules enabled, not just the quality subset. If your team only uses the default `plugin:@sonarjs/recommended` profile, your security recall will be lower than the 35% shown here. I'm noting this because "did you enable the wrong profile?" is the right practitioner question, and the answer is: no, but the full-enable still only reaches 35%.

#### Detection Results: 14/40 (35% Recall)

Despite having the most rules of any plugin tested, SonarJS missed 65% of vulnerabilities. The majority of its 269 rules target **code quality** (complexity, duplication, cognitive load), not security.

> Full teardown: [SonarJS Has 269 Rules. On 40 Vulnerabilities It Caught 14 — It Misses 65% of the Security Surface.](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace)

Where it does fire, it stops at the simple case: 2/4 on SQL injection, command injection, XSS, and hardcoded credentials — missing template-literal queries, `execSync`/`spawn` with a shell, `document.write`/`new Function`, and AWS-key/JWT-secret shapes respectively. It scores 0 on an entire band of server-side categories: path traversal, JWT, timing attacks, NoSQL injection, SSRF, and open redirect (see the [master matrix](#category-by-category-breakdown) for the per-cell grid).

#### False Positives: 5 — Code That Survived Review

SonarJS had a 73.7% precision rate — better than eslint-plugin-security, but still means roughly **1 in 4 security warnings is noise**.

Here's a representative false positive and why it passed review:

```javascript
// ✅ SAFE: Fisher-Yates shuffle for UI display order — not security-sensitive
function shuffleForDisplay(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
// ⚠️ SonarJS's pseudo-random rule flags Math.random() regardless of use case
```

**Why it survived review:** `sonarjs/pseudo-random` fires on any `Math.random()` call — it has no way to distinguish "shuffling a UI card list" from "generating a session token." The reviewer confirmed this shuffle has zero security context (it's cosmetic ordering, not token or key generation) and suppressed the warning. Correct call — but the rule can't tell the difference between this and the exact pattern (`Math.random()` for a token) that SonarJS _should_ be flagging elsewhere in the codebase.

The other 4 FPs follow the same shape: `no-os-command-from-path` firing three times on `execFile`/`spawn` calls with a hardcoded, bare command name (e.g. `execFile('git', [...])`) — the command genuinely does resolve through `PATH` (that's what the rule correctly flags), but the argument is a literal the developer wrote, not attacker-controlled input, so the real risk is PATH-planting at deployment time, not injection in this code. That's a hardening concern, not the vulnerability class the rule's positioned against — and `slow-regex` firing on a simple, non-backtracking email regex is the fifth:

```javascript
// ✅ SAFE: linear-time regex, no nested quantifiers, no catastrophic backtracking
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ⚠️ SonarJS's slow-regex flags it anyway — the heuristic overshoots on this shape
```

All five required domain knowledge to dismiss, all were approved by a senior who confirmed they were fine, all contributing to a team mental model where "SonarJS security warnings are noisy."

---

### eslint-plugin-security-node: The Successor

**Weekly Downloads:** ~30K | **Rules:** 22 | **Last Updated:** 2023 | **ESLint 9:** ✅ Works

What surprised me running this one: it's positioned as the modern successor to `eslint-plugin-security` — newer, actively maintained, adds SQL and NoSQL injection rules the original never had — and it still misses 82.5% of the same 40 patterns. More rule categories didn't translate into materially more coverage.

#### Detection Results: 7/40 (17.5% Recall)

Its 7 catches are all the textbook shapes: basic string-concatenation SQL (2/4), `exec` with interpolation (2/4), `eval` with an expression (1/4), direct `$where` NoSQL (1/2), and a naive `===` secret comparison (1/2). It adds nothing for path traversal, hardcoded credentials, JWT, weak crypto, or SSRF — all 0 (full grid in the [master matrix](#category-by-category-breakdown)).

#### False Positives: 4 — Why They Got Through

A 63.6% precision rate — better than eslint-plugin-security's 50%, but still noisy enough to matter. One of the 4 FPs is particularly instructive:

```javascript
// ✅ SAFE: execFile with whitelist-validated arguments, not exec with shell
const { execFile } = require("child_process");
execFile("git", ["status", "--porcelain"], callback);
// ⚠️ Flagged by security-node as unsafe child process usage
```

**Why it survived review:** `execFile` doesn't invoke a shell — it's the safe alternative to `exec`. But the reviewer saw "child process" in the linter warning, saw `execFile`, and spent time confirming what the docs say clearly: `execFile` is the recommended safe path. The PR got a "yes, suppress this" comment and moved on. The reviewer was right. The linter wasn't. And the next `execFile` call in the same codebase got suppressed without a second look, because the team had learned the rule was unreliable for this pattern.

---

### @microsoft/eslint-plugin-sdl: Enterprise Security

**Weekly Downloads:** ~100K | **Rules:** 17 | **Last Updated:** 2024 (active) | **ESLint 9:** ✅ Works

Microsoft's Security Development Lifecycle plugin has the **highest precision** of any non-Interlace plugin (80%), but its scope is extremely narrow — focused almost entirely on browser-side injection patterns.

#### Detection Results: 4/40 (10% Recall)

All four detections land in the same category — all 4 of the XSS/Code-Execution cases: `innerHTML`, `document.write`, `eval`, and `new Function`. The other 36 patterns across the remaining 13 categories: 0 (see the [master matrix](#category-by-category-breakdown)).

> Deep dive: [Microsoft's SDL ESLint Plugin Caught 5 Node Vulns. The Domain Plugins Caught 46 — Same File, Wrong Layer](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)

#### False Positives: 1 — And Why It Passed

High precision, but extremely limited coverage. Its 17 rules focus narrowly on XSS patterns — it has **zero rules** for SQL injection, command injection, path traversal, JWT attacks, or any server-side vulnerability.

The 1 false positive came from `innerHTML` with a sanitized value:

```javascript
// ✅ SAFE: Content sanitized with DOMPurify before assignment
const trusted = DOMPurify.sanitize(userContent);
element.innerHTML = trusted;
// ⚠️ Microsoft SDL flags innerHTML regardless of sanitization
```

**Why it survived review:** The reviewer approved the DOMPurify call as correct, noted the linter warning didn't account for sanitization, and added a suppression comment. Correct call by the human. But the pattern repeats: the team now has a rule that fires on safe DOMPurify usage, and future `innerHTML` assignments get less scrutiny because "SDL flags those even when they're safe." This benchmark ran SDL at its default config — I did not check whether an allowlist or sanitizer-recognition option exists for this rule; if one does, that's the fix, not living with the false positive.

---

### eslint-plugin-no-unsanitized (Mozilla)

**Weekly Downloads:** ~500K | **Rules:** 2 | **Focus:** XSS via DOM manipulation | **ESLint 9:** ✅ Works (flat config supported, `peerDependencies: "eslint": "^8 || ^9"`)

#### Detection Results: 2/40

| Rule                      | Count | What It Caught            |
| ------------------------- | ----- | ------------------------- |
| `no-unsanitized/property` | 1     | `innerHTML = userContent` |
| `no-unsanitized/method`   | 1     | `insertAdjacentHTML`      |

#### False Positives: 1

```javascript
// ✅ SAFE: Content sanitized with DOMPurify
const sanitized = DOMPurify.sanitize(userContent);
element.innerHTML = sanitized; // ⚠️ Flagged anyway
```

**Why it survived review:** Same pattern as Microsoft SDL — the reviewer confirmed the DOMPurify call was correct, suppressed the warning. Very narrow scope. Useful as a supplement for XSS, but covers only 2 of 14 categories.

**This one is config-addressable, and it matters for the framing:** `no-unsanitized` ships an `escape` option (documented in the plugin's README as an `escape.methods` allowlist, exact shape varies between the `property` and `method` rule variants) that lets you tell the rule to treat calls like `DOMPurify.sanitize()` as trusted escaping and skip the warning — check the README for the precise syntax for your rule variant and config format before copying a snippet from a blog post, including this one. I benchmarked default config, no custom rule tuning, across all six plugins, which is what a team gets on `npm install` with no README deep-dive. But this specific FP isn't a hard limitation of the tool — it's a config option most teams never discover. Say so, because "the plugin can't do this" and "the plugin doesn't do this until you configure it" are different claims, and only the second one is true here.

---

### Interlace Ecosystem

**Weekly Downloads:** ~5K | **Rules:** 198 (10 specialized plugins) | **Benchmarked version:** 3.0.2, measured 2026-05-30 | **ESLint 9:** ✅ Works | **Docs:** [eslint.interlace.tools](https://eslint.interlace.tools)

#### Detection Results: 40/40 (100% Recall, 0 False Positives)

The Interlace ecosystem detected every vulnerability with zero false positives across all 14 categories. A reminder that I built this — see the [conflict-of-interest disclosure above](#a-note-on-this-benchmark) and the [public repo](https://github.com/ofri-peretz/eslint-benchmark-suite) for independent verification. And one more honest frame on the perfect score: 100/100 on a corpus I designed means the _corpus_ is saturated for my tool, not that the tool is finished — [why a saturated corpus stops being a benchmark and becomes a regression test](https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus#corpus-lifecycle) is its own write-up.

**The obvious question: if it scores 100/100, why does it have ~5K weekly downloads against eslint-plugin-security's 1.5M?** Because it's newer and unbundled by design — ten specialized plugins instead of one general-purpose install, which is exactly the tradeoff that gets you higher recall (a rule built only for JWT can know more about JWT than a rule that also has to handle SQL, XSS, and crypto). That specialization is also the adoption cost: it's more packages to add to a `package.json`, it doesn't have eight years of Stack Overflow answers, and "the most popular tool" is a real, rational default for a team that hasn't hit this benchmark's failure modes yet. None of that makes the numbers wrong — it makes the tool young.

**Sample detections (with corrected OWASP 2021 labels):**

```text
🔒 CWE-798 OWASP:A07-Authentication CVSS:9.8 | Hard-coded API key detected | CRITICAL
   Fix: Use environment variable: process.env.API_KEY

🔒 CWE-347 | Including "none" in algorithms array allows unsigned tokens | CRITICAL
   Fix: Remove "none" from the algorithms array

🔒 CWE-95 OWASP:A03-Injection CVSS:9.8 | eval() can be refactored to safer alternative | CRITICAL
   Fix: Remove eval entirely
```

**OWASP label note:** CWE-798 (hardcoded credentials) maps to OWASP 2021 **A07 Identification and Authentication Failures**; CWE-95 (eval injection) maps to **A03 Injection**. Both samples carry CVSS 9.8 — CRITICAL under [CVSS v3.1's severity bands](https://ofriperetz.dev/articles/cvss-scores-explained) — assuming full-access credentials; a scoped read-only key scores lower. The eval line is the one an earlier draft mislabeled HIGH; that correction is told in full in [the note on this benchmark](#a-note-on-this-benchmark).

The reason for 100% coverage is **specialization**. Instead of one monolithic plugin, the ecosystem uses purpose-built plugins for each domain: SQL (`eslint-plugin-pg`), JWT (`eslint-plugin-jwt`), browser XSS (`eslint-plugin-browser-security`), and weak crypto / randomness (`eslint-plugin-node-security`). Full documentation at [eslint.interlace.tools](https://eslint.interlace.tools).

> **Editorial update:** weak-crypto and randomness rules were consolidated into `eslint-plugin-node-security` on 2026-05-10. The FN/FP numbers above are unaffected — that's a packaging change, not a detection change — but if you're installing today, use `eslint-plugin-node-security` directly; the previously separate `eslint-plugin-crypto` package is deprecated.

---

## Category-by-Category Breakdown

No plugin's aggregate recall number tells you what it does for the specific category you actually ship — this matrix breaks all six plugins down by vulnerability class so you can check coverage against your own risk surface instead of a headline percentage.

| Category              | security† | security-node | sonarjs   | MS SDL   | no-unsanitized | Interlace |
| --------------------- | --------- | ------------- | --------- | -------- | -------------- | --------- |
| SQL Injection (4)     | ❌ 0/4    | ⚠️ 2/4        | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| Command Injection (4) | ⚠️ 2/4    | ⚠️ 2/4        | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| Path Traversal (4)    | ✅ 4/4    | ❌ 0/4        | ❌ 0/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| Hardcoded Creds (4)   | ❌ 0/4    | ❌ 0/4        | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| JWT (3)               | ❌ 0/3    | ❌ 0/3        | ❌ 0/3    | ❌ 0/3   | ❌ 0/3         | ✅ 3/3    |
| XSS / eval (4)        | ⚠️ 1/4    | ⚠️ 1/4        | ⚠️ 2/4    | ✅ 4/4   | ⚠️ 2/4         | ✅ 4/4    |
| Prototype Poll. (3)   | ⚠️ 2/3    | ❌ 0/3        | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3         | ✅ 3/3    |
| Insecure Random (2)   | ❌ 0/2    | ❌ 0/2        | ⚠️ 1/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| Weak Crypto (3)       | ❌ 0/3    | ❌ 0/3        | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3         | ✅ 3/3    |
| Timing Attacks (2)    | ❌ 0/2    | ⚠️ 1/2        | ❌ 0/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| NoSQL Injection (2)   | ❌ 0/2    | ⚠️ 1/2        | ❌ 0/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| SSRF (2)              | ❌ 0/2    | ❌ 0/2        | ❌ 0/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| Open Redirect (1)     | ❌ 0/1    | ❌ 0/1        | ❌ 0/1    | ❌ 0/1   | ❌ 0/1         | ✅ 1/1    |
| ReDoS (2)             | ✅ 2/2    | ❌ 0/2        | ⚠️ 1/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| **TOTAL**             | **11/40** | **7/40**      | **14/40** | **4/40** | **2/40**       | **40/40** |

> † ESLint 8 results, benchmarked on v2.1.1 (crashes on ESLint 9; fixed in v3.0.0+)

**Read this table one column at a time, matched against your actual risk surface.** `eslint-plugin-security` scores 4/4 on path traversal and 0/4 on SQL injection — the 27.5% aggregate tells you nothing about whether you're covered for the specific category your codebase (or your AI assistant) happens to generate most frequently.

**The obvious follow-up: what if you just run two plugins together?** Reading the matrix by category shows real complementary coverage: `eslint-plugin-security` alone gets path traversal (4/4) and ReDoS (2/2), categories `sonarjs` misses entirely, while `sonarjs` alone gets partial hardcoded-credentials coverage (2/4) that `security` misses entirely — stacking them would raise recall above either plugin's 27.5%/35.0% alone, somewhere between the higher of the two per category and their combined total, depending on exactly which fixtures within each shared category (SQL, command injection, XSS) they each catch — a number this benchmark's category-level data doesn't pin down precisely without re-running fixture-by-fixture. What the data _does_ settle: false positives don't cancel out, they add. `security`'s 11 FPs and `sonarjs`'s 5 FPs come from different rules flagging different (or the same) safe patterns for different reasons, so the floor on combined noise is 16, not some averaged-down number. Two independent rule engines each capable of flagging the same safe pattern is _more_ review overhead per warning, not less. Combining plugins is a reasonable recall stopgap, but it doesn't fix the underlying problem: no single general-purpose plugin here was built with enough domain depth in any one category to both catch the bug and recognize the safe pattern next to it.

---

## What This Means for Your Team

A recall gap scales linearly with the size of your codebase — the smaller a plugin's detection rate, the more vulnerabilities your team ships without knowing it.

### The Math of Missing Vulnerabilities

If your codebase has 100 potentially vulnerable patterns, distributed the same way this benchmark's 40 are (if you're onboarding a new codebase, [a 30-minute OWASP-mapped audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) can show you which of the available ESLint rules map to each Top 10 category before you even run a single lint check):

| Plugin                       | Detected | Missed | In Production         |
| :--------------------------- | :------- | :----- | :-------------------- |
| eslint-plugin-security       | 28       | **72** | 72 vulnerabilities    |
| eslint-plugin-sonarjs        | 35       | **65** | 65 vulnerabilities    |
| eslint-plugin-security-node  | 18       | **82** | 82 vulnerabilities    |
| @microsoft/eslint-plugin-sdl | 10       | **90** | 90 vulnerabilities    |
| **Interlace Ecosystem**      | **100**  | **0**  | **0 vulnerabilities** |

**This assumes your 100 patterns are distributed like this benchmark's — a mix across all 14 categories, not concentrated in one.** No real codebase looks exactly like that: a Node/Express API skews toward SQL and command injection; a browser-heavy frontend skews toward XSS. Re-weight this table toward your own stack's dominant categories using the [category-by-category matrix](#category-by-category-breakdown) above — a plugin that's strong on path traversal and weak on SQL injection will score very differently for a database-heavy service than this uniform estimate suggests.

### The Alert Fatigue Cycle

You already know how this ends if you've maintained a shared ESLint config for more than a year: enough disabled-line comments on a noisy rule and someone eventually moves it to `off` for everyone, including the one unvalidated lookup that rule would have caught.

> **A note on the label:** the column below is the _noise rate_ — FP / (TP + FP), the share of warnings a developer actually sees that are wrong (the false discovery rate) — not the textbook false-positive rate FP / (FP + TN), which would put `eslint-plugin-security` at 11/38 = 28.9% instead of 50%. Why those two ratios answer different questions is [confusion-matrix](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) territory; this table deliberately answers the developer-facing one.

| Plugin                       | Noise Rate | Developer Impact             |
| :--------------------------- | :--------- | :--------------------------- |
| eslint-plugin-security       | 50.0%      | Every other warning is wrong |
| eslint-plugin-sonarjs        | 26.3%      | 1 in 4 is noise              |
| eslint-plugin-security-node  | 36.4%      | 1 in 3 is noise              |
| @microsoft/eslint-plugin-sdl | 20.0%      | Tolerable, but very limited  |
| **Interlace**                | **0.0%**   | Every warning is actionable  |

---

## The AI Multiplier: Why Recall Stopped Being Optional

There's a reason I ran a precision/recall benchmark in 2026 instead of just citing the one from 2020: the rate at which vulnerable patterns enter a codebase has changed.

When a human wrote every line, a 27.5%-recall linter missed a lot — but humans don't introduce SQL string concatenation or `jwt.verify` without an `algorithms` allowlist _that often_. The base rate was low enough that low recall felt survivable.

That assumption is now false. In a separate experiment I [let Claude write 80 functions and found 65–75% shipped with a real security vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the exact categories this benchmark tests: hardcoded credentials, missing JWT algorithm restriction, unparameterized queries, `child_process` with interpolated input. AI assistants reproduce the patterns in their training data, and their training data is full of the insecure 2018-era snippets these very rules were written to catch.

Point the six plugins from this benchmark at AI-generated code and the recall column _is_ your catch rate. A linter that misses 72.5% of patterns now misses 72.5% of a much larger, faster-growing input. This is also why precision stopped being a nice-to-have. The volume of AI-authored code means more total warnings; if half of them are wrong, the disable-and-move-on reflex arrives faster and lands harder. High recall gets you the catch; high precision is what keeps the team from turning the catcher off.

For a broader view of how different plugins compare across more tools — including how this benchmark fits into the [17-plugin recall ranking](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — reading both pieces together gives you the full picture: who catches what (recall), and whether they cry wolf (precision).

---

## Methodology

Every number in this article traces back to a recorded per-run environment, a public fixture suite, and a documented config baseline (default for five plugins, full-ruleset for SonarJS — see below) — reproducible with the one command at the end of this section.

### Test Environment

Environments are **per-run**, not global — each plugin's run records its exact Node and ESLint versions inside its results JSON (`results/fn-fp-comparison/` in the [public repo](https://github.com/ofri-peretz/eslint-benchmark-suite)), so none of this has to be taken on faith:

| Run (plugin @ version)             | Node     | ESLint  | Measured   |
| :--------------------------------- | :------- | :------ | :--------- |
| Interlace Ecosystem 3.0.2          | v24.12.0 | 9.39.2  | 2026-05-30 |
| eslint-plugin-sonarjs 3.0.6        | v24.12.0 | 9.39.2  | 2026-05-29 |
| eslint-plugin-security-node 1.1.4  | v20.19.5 | 9.39.2  | 2026-06-20 |
| eslint-plugin-no-unsanitized 4.1.4 | v20.19.5 | 9.39.2  | 2026-02-08 |
| @microsoft/eslint-plugin-sdl 1.1.0 | —‡       | 9.39.2  | 2026-02-07 |
| eslint-plugin-security 2.1.1       | —‡       | 8.57.0† | 2026-02-08 |

All runs: macOS (darwin/arm64), identical fixture suite.

> † ESLint 8.57.0 used for eslint-plugin-security@2.1.1 only (that release crashes on ESLint 9; v3.0.0+ does not).
> ‡ The two earliest runs predate the harness recording Node versions in the results JSON — an honesty gap the later harness closed.

**Correction, in the spirit of this article:** an earlier version of this section coupled all six runs to a single environment line — Node v20.19.5, February 8, 2026. That pairing was wrong for four of the six runs, and it's exactly the kind of claim the public repo lets anyone falsify in about a minute. Fixed here; the per-run JSONs are the source of truth.

### Configuration Baseline

Five of the six plugins were tested at their **default or recommended config, with no custom rule tuning** — what a team gets from `npm install` plus the README's quick-start block. **SonarJS is the one deliberate exception:** it ships two rule categories in one package (code quality and security), and this benchmark enabled **both**, not just `plugin:@sonarjs/recommended`. If you install SonarJS with only the recommended profile, your security recall will be lower than the 35% reported here — the 35% is SonarJS's ceiling, not its out-of-the-box floor. That distinction matters because it cuts the other way from the rest of the article's framing: every other plugin's numbers are the out-of-the-box floor, and SonarJS's is the best case.

Two of the false positives in this article — `no-unsanitized`'s DOMPurify flag and, possibly, Microsoft SDL's equivalent — are addressable with non-default config (see the `escape.methods` note in the `no-unsanitized` section). That doesn't erase the finding; it sharpens it. The false-positive tax described here is the out-of-the-box tax for five plugins and the best-case tax for SonarJS, and closing either gap requires configuration work most teams don't know to do.

### Fixture Design

All fixtures are:

- **Realistic:** Patterns from actual codebases, not contrived examples
- **Reproducible:** Published to GitHub with exact versions
- **Comprehensive:** All OWASP Top 10 categories with detectable static patterns

### On Benchmark Bias

I designed the fixture suite, then built Interlace rules to cover it — not the other way around. The fixtures are anchored to published OWASP Top 10 categories and CWE IDs, not to patterns Interlace happened to detect. If I had built the safe patterns to match only what Interlace's allow-listing logic understands, the FP count for other plugins would be zero too (they'd never encounter patterns they'd incorrectly flag). The 38 safe patterns were chosen to represent realistic validated code, not to favor any tool.

The fixture suite is public. Run it yourself — the command is below.

### Reproducibility

Full bench setup (fixtures, scripts, methodology) is documented in the companion article: [I Benchmarked 17 ESLint Security Plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared#methodology). The FP samples in this article come from the same suite:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install
npm run benchmark:fn-fp

# ESLint 8 benchmark (eslint-plugin-security@2.1.1 only — that release crashes on ESLint 9)
cd benchmarks/fn-fp-comparison/eslint8-compat
npm install
npm run benchmark
```

Every claim in this article can be independently verified. If you run it and the numbers hold, [star the benchmark repo](https://github.com/ofri-peretz/eslint-benchmark-suite) — a public benchmark is only as trustworthy as the number of people who've tried to break it.

---

## Conclusions

Six benchmarks converge on the same finding: the recall gap and the precision gap are both real, and only one of them gets worse as AI-generated code scales.

`eslint-plugin-security`'s precision problem doesn't depend on the ESLint 9 crash — that's the important separation to hold onto. The 72.5% false-negative rate and 1:1 TP:FP ratio are benchmarked on v2.1.1 under ESLint 8; v3.0.0+ fixed the crash and runs fine on ESLint 9 with flat config, but nobody has re-run the FN/FP numbers against it yet. If you're stuck on v2.1.1, upgrade — but the precision problem is the real reason to look elsewhere, not a compatibility bug `npm update` fixes.

SonarJS and security-node are variations on the same story: more rules doesn't mean more security coverage. SonarJS misses 65% of vulnerabilities despite 269 rules and 3M+ downloads, because most of those rules target code quality, not security. `security-node` was built as `eslint-plugin-security`'s modern successor and still misses 82.5% — the categories it added didn't move the needle much. Microsoft SDL sits at the opposite extreme: genuinely high precision, but scoped so narrowly to browser XSS that it offers zero server-side coverage. Interlace is the only plugin that cleared both bars at once in this benchmark — 100% detection, zero false positives — and the mechanism is specialization, not superior engineering: ten domain-specific plugins instead of one general-purpose install.

---

## Migrating Off eslint-plugin-security

```bash
npm uninstall eslint-plugin-security
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-browser-security \
  eslint-plugin-pg eslint-plugin-jwt eslint-plugin-mongodb-security
```

> Note (2026-05-10): weak-crypto and randomness rules were consolidated into `eslint-plugin-node-security`. The previously separate `eslint-plugin-crypto` package is deprecated.

Two packages in that install list go beyond what this specific 40-pattern benchmark tested: `eslint-plugin-secure-coding` covers general secure-coding hygiene rules outside the 14 CWE categories here, and `eslint-plugin-mongodb-security` covers NoSQL-specific patterns (query-operator injection, `$where` abuse) broader than the two NoSQL cases in this suite. Both are real, published Interlace packages — install them if your stack touches MongoDB or you want the wider hygiene net; skip them if you only need 1:1 coverage for what this benchmark measured.

> Per-plugin setup: [secure-coding](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding) · [node-security](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-crypto-4a8g) · [browser-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-browser-security) · [pg](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg) · [jwt](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt) · [mongodb-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-mongodb-security)

Full flat-config + migration steps are in the [17-plugin benchmark's migration block](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared#migrate-in-60-seconds).

---

## Your turn

Every team I've worked with has the same artifact buried in its shared ESLint config: a security rule in the `off` list with a comment like `// too noisy` — and in my experience `detect-object-injection` is the one most often sitting there.

**Here's the specific question I'd like you to sit with:** in the months after your team turned a rule like that off — did anything slip through that it would have caught if it had been more precise?

That's the real cost of the false-positive tax: not the annoying warnings, but the institutional decision to stop listening. I'd genuinely like to read what that looked like in your codebase in the comments.

---

## Related deep dives

> **ESLint Security Benchmark Series:** [Recall ranking (17 plugins)](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) → **False-positive tax (you are here)** → [What ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed). Start with recall to see who catches what; this piece is why the precision column decides whether anyone keeps the tool on.

- [I Benchmarked 17 ESLint Security Plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — the recall-ranked companion to this FP deep dive
- Why quality, accessibility, and serverless packages get a different scorecard than this one, on purpose — a separate write-up, coming soon
- [Same File: eslint-plugin-security Caught 21, the Domain Plugins Caught 46](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) — the floor-not-ceiling argument on real code
- [What Ground Truth Caught That Unit Tests Missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) — how I validate a rule's true/false positives before trusting the F1 score
- [Interlace ESLint Ecosystem Docs](https://eslint.interlace.tools) — full rule documentation and configuration guides

**The foundations behind these numbers:**

- [The Confusion Matrix: What TP, FP, FN, and TN Actually Mean](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) — the four counts every precision/recall figure in this article is built from
- [Precision, Recall, and F1 for Static Analysis](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) — how the leaderboard's three columns are defined, and why F1 alone can't tell two tools apart
- [The Base Rate Problem](https://ofriperetz.dev/articles/base-rate-problem-explained) — why a recall number's real-world cost depends on how often the vulnerable pattern actually occurs
- [Ground Truth in Security Testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing) — how each fixture's vulnerable-or-safe label is decided before any plugin runs

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · [npm](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
