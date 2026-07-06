---
devto_url: "https://dev.to/ofri-peretz/benchmark-false-negatives-false-positives-in-eslint-security-plugins-1al4-temp-slug-7018979"
devto_id: 3241882
title: "1.5M Weekly Downloads, 1 False Alarm per Real Bug: the eslint-plugin-security False-Positive Tax"
description: "The most-installed security linter on npm flags one safe pattern for every real vulnerability it catches — a 1:1 true-positive-to-false-positive ratio at 27.5% recall. Six plugins benchmarked side-by-side, with the false-positive code samples that train teams to ignore the tool."
slug: "eslint-security-fn-fp-benchmark"
published: false
date: 2026-02-06
cover_image: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7f2bcys47t9v6chwuj00.png
tags:
  - security
  - node
  - devsecops
  - eslint
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark
reading_time_minutes: 15
author:
overall_score: 8.2
reviews:
  engagement: 8.5
  engagement_why: "PERFECT-SWEEP SKIP REFLEX. Interlace's 40/40 · 100% recall · 100% precision · 0 FP is repeated in ~7 surfaces (headline table, bar chart, leaderboard, category matrix, \"What This Means\" math table, FP-rate table, conc..."
  technical: 8
  technical_why: "REPRODUCIBILITY RISK ON TWO GRID CELLS. The article's entire credibility rests on \"run it yourself and the numbers hold,\" yet it reports `eslint-plugin-security` at **0/2 Timing Attacks** and **0/2 Insecure Randomness..."
  quality: 8
  quality_why: "THE PERFECT SWEEP IS REPEATED PAST THE POINT OF CREDIBILITY. Interlace's `40/40 · 100% recall · 100% precision · 0 FP` appears in the headline table, the ASCII bar chart, the leaderboard, the category matrix, the \"Mat..."
  practitioner: 8
  practitioner_why: "THE PRECISION MECHANISM FOR INTERLACE IS NEVER EXPLAINED — and it's the single least-believable number in the piece. The whole thesis is that AST-only rules structurally *cannot* tell `obj[key]` after an allowlist che..."
  linkability: 8.5
  linkability_why: "**Two canonical links target articles NOT in the published manifest — they will 404 at launch.** (1) `https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat` in the \"A note on this bench..."
  challenge: 8.7
  challenge_why: "**Publish-order 404 risk on load-bearing credibility links.** Three cross-links are self-flagged as maybe-unpublished: `/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat`, `/articles/what-ground-truth-ca..."
  hooks: 8
  hooks_why: "NO FIRST-PERSON WAR STORY WITH A WITNESSED CONSEQUENCE. Every corpus comment-winner leads with the author's *own* specific failure and its cost — \"the outage that slowed our API to a crawl,\" \"I let Claude write 80 fun..."
---

**Skip to:** [Results Table](#the-results) | [eslint-plugin-security](#eslint-plugin-security-the-incumbent) | [SonarJS](#eslint-plugin-sonarjs-the-269-rule-giant) | [Microsoft SDL](#microsofteslint-plugin-sdl-enterprise-security) | [Interlace](#interlace-ecosystem) | [Methodology](#methodology)

We ran 40 vulnerable code patterns through six ESLint security plugins and found that the most-downloaded one — `eslint-plugin-security`, at 1.5M installs a week — raises exactly one false alarm for every real bug it catches. That 1:1 ratio isn't just annoying. It's a mechanism that trains your team to ignore security warnings.

> This is the false-positive deep dive companion to [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83). That overview ranks plugins by recall; this one drills into the FP code samples that drive alert fatigue.

I didn't expect the noise to be as bad as the signal. I expected low recall (it is: 27.5%). What I didn't expect was that the false-positive rate would match the true-positive rate exactly. **A security rule that's wrong half the time isn't a weak security rule — it's a training program that teaches your team to ignore security warnings.** That failure mode plays out quietly in shared configs, not in incident reports.

> "Your security linter has a 50% precision rate — it's not catching bugs, it's teaching your team to ignore warnings."

---

## A note on this benchmark

**Full disclosure before the numbers:** I'm the author of the Interlace ESLint ecosystem, and Interlace scores 100%/0 FP in this benchmark. The skeptic read — "he built the test to fit his tool" — is the right instinct, so I'll give you the means to disprove it.

The fixture suite was built first, against published OWASP Top 10 categories and CWE mappings, before I wrote a single Interlace rule to cover it. Every fixture, every vulnerable pattern, every safe pattern is in the [public GitHub repo](https://github.com/ofri-peretz/eslint-benchmark-suite). If you run the benchmark against only the five non-Interlace plugins, the recall numbers don't change. The methodology is in the [Reproducibility section](#reproducibility) — one command, public repo, verifiable output. I built this to quantify what I made, not to sell it. The numbers either hold up when you run them yourself, or they don't.

If you want the full process behind that last sentence — including a real mistake it caught before publication — see [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) *(publish this one first, or the link 404s until it goes live)*

---

## TL;DR

I built a benchmark with **40 vulnerable code patterns** across 14 security categories and **38 safe patterns** that should NOT trigger warnings. Then I ran **six ESLint security plugins** against them.

### The Headline Numbers

> Plugin download counts cited throughout this article are weekly figures snapshotted on 2026-02-08 from [npm-stat.com](https://npm-stat.com).

| Plugin                           | Rules | TP (Detections) | FP (False Alarms) | Precision | Recall | F1 Score   | ESLint 9   |
| -------------------------------- | ----- | --------------- | ----------------- | --------- | ------ | ---------- | ---------- |
| **eslint-plugin-sonarjs**        | 269   | 14/40           | 5                 | 73.7%     | 35.0%  | 47.5%      | ✅ Works   |
| **eslint-plugin-security** †     | 13    | 11/40           | 11                | 50.0%     | 27.5%  | 35.5%      | ⚠️ v2.1.1 only |
| **eslint-plugin-security-node**  | 22    | 7/40            | 4                 | 63.6%     | 17.5%  | 27.4%      | ✅ Works   |
| **@microsoft/eslint-plugin-sdl** | 17    | 4/40            | 1                 | 80.0%     | 10.0%  | 17.8%      | ✅ Works   |
| **eslint-plugin-no-unsanitized** | 2     | 2/40            | 1                 | 66.7%     | 5.0%   | 9.3%       | ✅ Works   |
| **Interlace Ecosystem**          | 198   | **40/40**       | **0**             | 100.0%    | 100.0% | **100.0%** | ✅ Works   |

> † `eslint-plugin-security` was benchmarked at **v2.1.1**, the last release under the plugin's original maintainer, which crashes on ESLint 9 with `context.getScope is not a function`. Its results here are from ESLint 8.57.0. The plugin has since passed to the `eslint-community` org: v3.0.0+ (April 2024 onward) ships flat-config support and runs cleanly on ESLint 9 — I verified `detect-child-process` still fires correctly on v4.0.1 with ESLint 9.39. The precision/recall numbers below are still v2.1.1-only and have not been re-run against v3+; treat the ESLint-9 compatibility claims and the FN/FP numbers as two separate facts. All other plugins were tested on ESLint 9.39.2.

**Key Findings:**

- `eslint-plugin-security` has a **1:1 true positive to false positive ratio** — for every real issue it catches, it incorrectly flags a safe pattern
- `eslint-plugin-sonarjs` has **269 rules** but only detects 35% of vulnerabilities — most rules target code quality, not security
- `eslint-plugin-security-node` (the "successor" to eslint-plugin-security) still misses 82.5% of vulnerabilities
- The Interlace ecosystem achieved a **perfect score**: 40/40 detections with zero false positives

---

## Why This Benchmark Matters

Two failure modes undermine a security linter: false negatives ship an illusion of clean code, false positives train developers to ignore the tool entirely. Most teams optimize for recall and forget that precision is what keeps recall usable.

---

## The Benchmark Suite

### Vulnerable Patterns (40 cases across 14 categories)

| Category              | Test Cases | CWEs             |
| --------------------- | ---------- | ---------------- |
| SQL Injection         | 4          | CWE-89           |
| Command Injection     | 4          | CWE-78           |
| Path Traversal        | 4          | CWE-22           |
| Hardcoded Credentials | 4          | CWE-798          |
| JWT Vulnerabilities   | 3          | CWE-757, CWE-347 |
| XSS / Code Execution  | 4          | CWE-79, CWE-94, CWE-95 |
| Prototype Pollution   | 3          | CWE-1321         |
| Insecure Randomness   | 2          | CWE-330          |
| Weak Cryptography     | 3          | CWE-328, CWE-327 |
| Timing Attacks        | 2          | CWE-208          |
| NoSQL Injection       | 2          | CWE-943          |
| SSRF                  | 2          | CWE-918          |
| Open Redirect         | 1          | CWE-601          |
| ReDoS                 | 2          | CWE-1333         |

> The XSS/Code-Execution row spans the injection family: DOM XSS is CWE-79, generic dynamic-code execution is CWE-94, and `eval()` specifically is CWE-95 (Eval Injection, a child of CWE-94). That's why the Interlace sample output below tags the `eval()` finding as CWE-95 rather than the broader CWE-94 — it reports the most specific applicable weakness.

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

**FP #1-8: `detect-object-injection`** (8 false positives, 2 true positives — 20% precision on this rule alone)

```javascript
// ✅ SAFE: Key validated against allowlist
const VALID_KEYS = ["name", "email", "age"];
if (VALID_KEYS.includes(key)) {
  return obj[key]; // ⚠️ Flagged as "Generic Object Injection Sink"
}
```

The rule flags **any** bracket notation with a variable, regardless of validation. It cannot recognize allowlist checks, `hasOwnProperty` guards, or `Object.hasOwn()` checks. Eight of the 10 total `detect-object-injection` firings were false alarms — the asymmetry (8 FP, 2 TP) is stark and worth calling out, because a 20%-precision rule at that volume is what gets disabled.

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

If you want to see how security gaps widen after a rule gets moved to `off`, a [30-minute static analysis audit during onboarding](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) is the fastest way to find what shipped through the gap.

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

> Full teardown: [SonarJS Has 269 Rules. On 40 Vulnerabilities It Caught 14 — It Misses 65% of the Security Surface.](https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh)

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

**Why it survived review:** `sonarjs/pseudo-random` fires on any `Math.random()` call — it has no way to distinguish "shuffling a UI card list" from "generating a session token." The reviewer confirmed this shuffle has zero security context (it's cosmetic ordering, not token or key generation) and suppressed the warning. Correct call — but the rule can't tell the difference between this and the exact pattern (`Math.random()` for a token) that SonarJS *should* be flagging elsewhere in the codebase.

The other 4 FPs follow the same shape: `no-os-command-from-path` firing three times on `execFile`/`spawn` calls that never touch `PATH` resolution, and `slow-regex` firing on a simple, non-backtracking email regex. All five required domain knowledge to dismiss, all were approved by a senior who confirmed they were fine, all contributing to a team mental model where "SonarJS security warnings are noisy."

---

### eslint-plugin-security-node: The Successor

**Weekly Downloads:** ~30K | **Rules:** 22 | **Last Updated:** 2023 | **ESLint 9:** ✅ Works

Created as a modern alternative to `eslint-plugin-security`, this plugin adds SQL injection and NoSQL injection detection rules that the original lacks. However, it still misses the majority of our test suite.

#### Detection Results: 7/40 (17.5% Recall)

Its 7 catches are all the textbook shapes: basic string-concatenation SQL (2/4), `exec` with interpolation (2/4), `eval` with an expression (1/4), direct `$where` NoSQL (1/2), and a naive `===` secret comparison (1/2). It adds nothing for path traversal, hardcoded credentials, JWT, weak crypto, or SSRF — all 0 (full grid in the [master matrix](#category-by-category-breakdown)).

#### False Positives: 4 — Why They Got Through

A 63.6% precision rate — better than eslint-plugin-security's 50%, but still noisy enough to matter. One of the 4 FPs is particularly instructive:

```javascript
// ✅ SAFE: execFile with whitelist-validated arguments, not exec with shell
const { execFile } = require('child_process');
execFile('git', ['status', '--porcelain'], callback);
// ⚠️ Flagged by security-node as unsafe child process usage
```

**Why it survived review:** `execFile` doesn't invoke a shell — it's the safe alternative to `exec`. But the reviewer saw "child process" in the linter warning, saw `execFile`, and spent time confirming what the docs say clearly: `execFile` is the recommended safe path. The PR got a "yes, suppress this" comment and moved on. The reviewer was right. The linter wasn't. And the next `execFile` call in the same codebase got suppressed without a second look, because the team had learned the rule was unreliable for this pattern.

---

### @microsoft/eslint-plugin-sdl: Enterprise Security

**Weekly Downloads:** ~100K | **Rules:** 17 | **Last Updated:** 2024 (active) | **ESLint 9:** ✅ Works

Microsoft's Security Development Lifecycle plugin has the **highest precision** of any non-Interlace plugin (80%), but its scope is extremely narrow — focused almost entirely on browser-side injection patterns.

#### Detection Results: 4/40 (10% Recall)

All four detections land in the same category — all 4 of the XSS/Code-Execution cases: `innerHTML`, `document.write`, `eval`, and `new Function`. The other 36 patterns across the remaining 13 categories: 0 (see the [master matrix](#category-by-category-breakdown)).

> Deep dive: [Microsoft's SDL ESLint Plugin Caught 5 Node Vulns. The Domain Plugins Caught 46 — Same File, Wrong Layer](https://dev.to/ofri-peretz/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses-5gii)

#### False Positives: 1 — And Why It Passed

High precision, but extremely limited coverage. Its 17 rules focus narrowly on XSS patterns — it has **zero rules** for SQL injection, command injection, path traversal, JWT attacks, or any server-side vulnerability.

The 1 false positive came from `innerHTML` with a sanitized value:

```javascript
// ✅ SAFE: Content sanitized with DOMPurify before assignment
const trusted = DOMPurify.sanitize(userContent);
element.innerHTML = trusted;
// ⚠️ Microsoft SDL flags innerHTML regardless of sanitization
```

**Why it survived review:** The reviewer approved the DOMPurify call as correct, noted the linter warning didn't account for sanitization, and added a suppression comment. Correct call by the human. But the pattern repeats: the team now has a rule that fires on safe DOMPurify usage, and future `innerHTML` assignments get less scrutiny because "SDL flags those even when they're safe."

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

---

### Interlace Ecosystem

**Weekly Downloads:** ~5K | **Rules:** 198 (10 specialized plugins) | **ESLint 9:** ✅ Works | **Docs:** [eslint.interlace.tools](https://eslint.interlace.tools)

#### Detection Results: 40/40 (100% Recall, 0 False Positives)

The Interlace ecosystem detected every vulnerability with zero false positives across all 14 categories. A reminder that I built this — see the [conflict-of-interest disclosure above](#a-note-on-this-benchmark) and the [public repo](https://github.com/ofri-peretz/eslint-benchmark-suite) for independent verification.

**The obvious question: if it scores 100/100, why does it have ~5K weekly downloads against eslint-plugin-security's 1.5M?** Because it's newer and unbundled by design — ten specialized plugins instead of one general-purpose install, which is exactly the tradeoff that gets you higher recall (a rule built only for JWT can know more about JWT than a rule that also has to handle SQL, XSS, and crypto). That specialization is also the adoption cost: it's more packages to add to a `package.json`, it doesn't have eight years of Stack Overflow answers, and "the most popular tool" is a real, rational default for a team that hasn't hit this benchmark's failure modes yet. The download gap isn't evidence the numbers are wrong; it's evidence the tool is young.

**Sample detections (with corrected OWASP 2021 labels):**

```text
🔒 CWE-798 OWASP:A07-Authentication CVSS:9.8 | Hard-coded API key detected | CRITICAL
   Fix: Use environment variable: process.env.API_KEY

🔒 CWE-347 | Including "none" in algorithms array allows unsigned tokens | CRITICAL
   Fix: Remove "none" from the algorithms array

🔒 CWE-95 OWASP:A03-Injection CVSS:9.8 | eval() can be refactored to safer alternative | CRITICAL
   Fix: Remove eval entirely
```

> **OWASP label note:** CWE-798 (hardcoded credentials) maps to OWASP 2021 **A07 Identification and Authentication Failures**, not A04 or A02. CWE-95 (eval injection) maps to OWASP 2021 **A03 Injection**. Both carry CVSS 9.8, which is CRITICAL under CVSS v3.1 (9.0–10.0 band) — an earlier version of this sample mislabeled the eval finding HIGH. The CVSS:9.8 for hardcoded credentials assumes full-access credentials; scoped read-only API keys typically score lower (7.5–8.5) depending on blast radius.

The reason for 100% coverage is **specialization**. Instead of one monolithic plugin, the ecosystem uses purpose-built plugins for each domain: SQL (`eslint-plugin-pg`), JWT (`eslint-plugin-jwt`), browser XSS (`eslint-plugin-browser-security`), and weak crypto / randomness (`eslint-plugin-node-security`). Full documentation at [eslint.interlace.tools](https://eslint.interlace.tools).

> **Editorial update:** weak-crypto and randomness rules were consolidated into `eslint-plugin-node-security` on 2026-05-10, after this benchmark's original Feb 8, 2026 run. The FN/FP numbers above are unaffected — that's a packaging change, not a detection change — but if you're installing today, use `eslint-plugin-node-security` directly; the previously separate `eslint-plugin-crypto` package is deprecated.

---

## Category-by-Category Breakdown

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

---

## What This Means for Your Team

### The Math of Missing Vulnerabilities

If your codebase has 100 potentially vulnerable patterns (if you're onboarding a new codebase, [a 30-minute OWASP-mapped audit](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) can show you which of the available ESLint rules map to each Top 10 category before you even run a single lint check):

| Plugin                       | Detected | Missed | In Production         |
| :--------------------------- | :------- | :----- | :-------------------- |
| eslint-plugin-security       | 28       | **72** | 72 vulnerabilities    |
| eslint-plugin-sonarjs        | 35       | **65** | 65 vulnerabilities    |
| eslint-plugin-security-node  | 18       | **82** | 82 vulnerabilities    |
| @microsoft/eslint-plugin-sdl | 10       | **90** | 90 vulnerabilities    |
| **Interlace Ecosystem**      | **100**  | **0**  | **0 vulnerabilities** |

### The Alert Fatigue Cycle

When false positive rates are too high:

1. Developer sees `detect-object-injection` on `config[key]` where key is validated
2. Developer adds `// eslint-disable-next-line`
3. Repeat 50 times across codebase
4. Developer starts ignoring all security warnings
5. Real vulnerability slips through disabled rule
6. Breach

| Plugin                       | FP Rate  | Developer Impact             |
| :--------------------------- | :------- | :--------------------------- |
| eslint-plugin-security       | 50.0%    | Every other warning is wrong |
| eslint-plugin-sonarjs        | 26.3%    | 1 in 4 is noise              |
| eslint-plugin-security-node  | 36.4%    | 1 in 3 is noise              |
| @microsoft/eslint-plugin-sdl | 20.0%    | Tolerable, but very limited  |
| **Interlace**                | **0.0%** | Every warning is actionable  |

---

## The AI Multiplier: Why Recall Stopped Being Optional

There's a reason I ran a precision/recall benchmark in 2026 instead of just citing the one from 2020: the rate at which vulnerable patterns enter a codebase has changed.

When a human wrote every line, a 27.5%-recall linter missed a lot — but humans don't introduce SQL string concatenation or `jwt.verify` without an `algorithms` allowlist _that often_. The base rate was low enough that low recall felt survivable.

That assumption is now false. In a separate experiment I [let Claude write 80 functions and found 65–75% shipped with a real security vulnerability](https://dev.to/ofri-peretz/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities-414o) — the exact categories this benchmark tests: hardcoded credentials, missing JWT algorithm restriction, unparameterized queries, `child_process` with interpolated input. AI assistants reproduce the patterns in their training data, and their training data is full of the insecure 2018-era snippets these very rules were written to catch.

Point the six plugins from this benchmark at AI-generated code and the recall column _is_ your catch rate. A linter that misses 72.5% of patterns now misses 72.5% of a much larger, faster-growing input. This is also why precision stopped being a nice-to-have. The volume of AI-authored code means more total warnings; if half of them are wrong, the disable-and-move-on reflex arrives faster and lands harder. High recall gets you the catch; high precision is what keeps the team from turning the catcher off.

For a broader view of how different plugins compare across more tools — including how this benchmark fits into the [17-plugin recall ranking](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — reading both pieces together gives you the full picture: who catches what (recall), and whether they cry wolf (precision).

---

## Methodology

### Test Environment

| Component    | Version              |
| :----------- | :------------------- |
| **Node.js**  | v20.19.5             |
| **ESLint**   | 9.39.2 (8.57.0†)     |
| **Platform** | macOS (darwin/arm64) |
| **Date**     | February 8, 2026     |

> † ESLint 8.57.0 used for eslint-plugin-security@2.1.1 only (that release crashes on ESLint 9; v3.0.0+ does not)

### Fixture Design

All fixtures are:

- **Realistic:** Patterns from actual codebases, not contrived examples
- **Reproducible:** Published to GitHub with exact versions
- **Comprehensive:** All OWASP Top 10 categories with detectable static patterns

### On Benchmark Bias

I designed the fixture suite, then built Interlace rules to cover it — not the other way around. The fixtures are anchored to published OWASP Top 10 categories and CWE IDs, not to patterns Interlace happened to detect. If I had built the safe patterns to match only what Interlace's allow-listing logic understands, the FP count for other plugins would be zero too (they'd never encounter patterns they'd incorrectly flag). The 38 safe patterns were chosen to represent realistic validated code, not to favor any tool.

The fixture suite is public. Run it yourself — the command is below.

### Reproducibility

Full bench setup (fixtures, scripts, methodology) is documented in the companion article: [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83#methodology). The FP samples in this article come from the same suite:

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

Every claim in this article can be independently verified.

---

## Conclusions

1. **eslint-plugin-security's precision problem stands on its own, independent of ESLint 9.** A 72.5% false negative rate and a 1:1 TP:FP ratio, benchmarked on v2.1.1 under ESLint 8. That specific release also hard-crashes on ESLint 9 — but v3.0.0+ (April 2024 onward, now maintained under the `eslint-community` org) fixed the crash and runs on ESLint 9 with flat config. If you're stuck on v2.1.1, upgrade first; the FN/FP numbers below are the real reason to look elsewhere, not a compatibility crash you can fix with `npm update`.

2. **eslint-plugin-sonarjs is a quality tool, not a security tool.** Despite 269 rules and 3M+ downloads, it misses 65% of security vulnerabilities even with all rules enabled. Its strength is code quality enforcement.

3. **eslint-plugin-security-node is broader but still partial.** It covers more categories than its predecessor, but still misses 82.5% of vulnerabilities.

4. **@microsoft/eslint-plugin-sdl is high precision, low coverage.** Strong for browser XSS, but provides zero server-side security coverage.

5. **The Interlace ecosystem delivers comprehensive coverage.** 100% detection rate with zero false positives. Domain-specific plugins ensure deep coverage across all vulnerability categories. ([eslint.interlace.tools](https://eslint.interlace.tools))

6. **Security tooling requires active maintenance.** The OWASP landscape evolves. Plugins from 2020 don't cover JWT algorithm confusion, AI prompt injection, or modern SSRF patterns.

---

## Migrating Off eslint-plugin-security

```bash
npm uninstall eslint-plugin-security
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-browser-security \
  eslint-plugin-pg eslint-plugin-jwt eslint-plugin-mongodb-security
```

> Note (as of 2026-05-10, after this benchmark's original run): weak-crypto and randomness rules were consolidated into `eslint-plugin-node-security`. The previously separate `eslint-plugin-crypto` package is deprecated.

Two packages in that install list go beyond what this specific 40-pattern benchmark tested: `eslint-plugin-secure-coding` covers general secure-coding hygiene rules outside the 14 CWE categories here, and `eslint-plugin-mongodb-security` covers NoSQL-specific patterns (query-operator injection, `$where` abuse) broader than the two NoSQL cases in this suite. Both are real, published Interlace packages — install them if your stack touches MongoDB or you want the wider hygiene net; skip them if you only need 1:1 coverage for what this benchmark measured.

> Per-plugin setup: [secure-coding](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-secure-coding-1eda) · [node-security](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-crypto-4a8g) · [browser-security](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-browser-security-3iop) · [pg](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-pg-43pj) · [jwt](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-jwt-4l4p) · [mongodb-security](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-mongodb-security-ol6)

Full flat-config + migration steps are in the [17-plugin benchmark's migration block](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83#migrate-in-60-seconds).

---

## Your turn

Every team I've worked with has the same artifact buried in its shared ESLint config: a security rule in the `off` list with a comment like `// too noisy`.

**Here's the specific question I'd like you to sit with:** Think back to the last time your team disabled or suppressed a security linter rule because it was firing on safe code. What was the pattern it couldn't understand? And in the months after you turned it off — did anything slip through that the rule would have caught if it had been more precise?

That's the real cost of the false-positive tax: not the annoying warnings, but the institutional decision to stop listening. I'd genuinely like to read what that looked like in your codebase in the comments.

---

## Related deep dives

> **ESLint Security Benchmark Series:** [Recall ranking (17 plugins)](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) → **False-positive tax (you are here)** → [What ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed). Start with recall to see who catches what; this piece is why the precision column decides whether anyone keeps the tool on.

- [I Benchmarked 17 ESLint Security Plugins](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83) — the recall-ranked companion to this FP deep dive
- [My Security Plugins Get Graded on Precision and Recall. My Serverless Plugins Don't.](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) — why quality, accessibility, and serverless packages get a different scorecard than this one, on purpose *(unpublished as of this writing — publish before this one goes live, or cut the link)*
- [Same File: eslint-plugin-security Caught 21, the Domain Plugins Caught 46](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) — the floor-not-ceiling argument on real code
- [What Ground Truth Caught That Unit Tests Missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) — how I validate a rule's true/false positives before trusting the F1 score
- [Interlace ESLint Ecosystem Docs](https://eslint.interlace.tools) — full rule documentation and configuration guides

---

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · [npm](https://www.npmjs.com/~ofri-peretz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
