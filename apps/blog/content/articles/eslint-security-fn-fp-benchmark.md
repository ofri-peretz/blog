---
devto_url: "https://dev.to/ofri-peretz/benchmark-false-negatives-false-positives-in-eslint-security-plugins-1al4-temp-slug-7018979"
devto_id: 3241882
title: "The False Positive Tax: a 1:1 TP:FP analysis of eslint-plugin-security"
description: "eslint-plugin-security flags one safe pattern for every real vulnerability it catches. Five other security plugins benchmarked side-by-side, with the false-positive code samples that drive alert fatigue."
slug: "eslint-security-fn-fp-benchmark"
published: false
date: 2026-02-06
cover_image: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7f2bcys47t9v6chwuj00.png
tags:
  - security
  - eslint
  - javascript
  - ai
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark
reading_time_minutes: 14
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

**Skip to:** [Results Table](#the-results) | [eslint-plugin-security](#eslint-plugin-security-the-incumbent) | [SonarJS](#eslint-plugin-sonarjs-the-269-rule-giant) | [Microsoft SDL](#microsofteslint-plugin-sdl-enterprise-security) | [Interlace](#interlace-ecosystem) | [Methodology](#methodology)

> This is the false-positive deep dive companion to [I Benchmarked 17 ESLint Security Plugins](/articles/benchmark-17-eslint-security-plugins-compared). That overview ranks plugins by recall; this one drills into the FP code samples that drive alert fatigue.

The most-downloaded security linter on npm — `eslint-plugin-security`, at 1.5M installs a week — flags exactly one safe pattern for every real vulnerability it catches. A 1:1 true-positive-to-false-positive ratio. Half the alarms it raises are wrong.

I didn't expect that number. I expected the recall to be low (it is: 27.5%). What I didn't expect was that the noise would be just as bad as the signal. That combination is how a security rule quietly trains a whole team to stop reading its output — and it's the exact failure mode I've watched play out in code review more than once.

## TL;DR

I built a benchmark with **40 vulnerable code patterns** across 14 security categories and **38 safe patterns** that should NOT trigger warnings. Then I ran **six ESLint security plugins** against them. Every number below is reproducible from a public repo — the exact command is in [Reproducibility](#reproducibility).

### The Headline Numbers

> Plugin download counts cited throughout this article are weekly figures snapshotted on 2026-02-08 from [npm-stat.com](https://npm-stat.com).

| Plugin                           | Rules | TP (Detections) | FP (False Alarms) | Precision | Recall | F1 Score   | ESLint 9   |
| -------------------------------- | ----- | --------------- | ----------------- | --------- | ------ | ---------- | ---------- |
| **Interlace Ecosystem**          | 201   | **40/40**       | **0**             | 100.0%    | 100.0% | **100.0%** | ✅ Works   |
| **eslint-plugin-sonarjs**        | 269   | 14/40           | 5                 | 73.7%     | 35.0%  | 47.5%      | ✅ Works   |
| **eslint-plugin-security** †     | 13    | 11/40           | 11                | 50.0%     | 27.5%  | 34.4%      | ❌ Broken  |
| **eslint-plugin-security-node**  | 22    | 7/40            | 4                 | 63.6%     | 17.5%  | 27.4%      | ✅ Works   |
| **@microsoft/eslint-plugin-sdl** | 17    | 4/40            | 1                 | 80.0%     | 10.0%  | 17.8%      | ✅ Works   |
| **eslint-plugin-no-unsanitized** | 2     | 2/40            | 1                 | 66.7%     | 5.0%   | 9.3%       | ⚠️ Limited |

> † `eslint-plugin-security` crashes on ESLint 9. Its results are from ESLint 8.57.0. All other plugins were tested on ESLint 9.39.2.

**Key Findings:**

- `eslint-plugin-security` has a **1:1 true positive to false positive ratio** — for every real issue it catches, it incorrectly flags a safe pattern
- `eslint-plugin-sonarjs` has **269 rules** but only detects 35% of vulnerabilities — most rules target code quality, not security
- `eslint-plugin-security-node` (the "successor" to eslint-plugin-security) still misses 82.5% of vulnerabilities
- The Interlace ecosystem achieved a **perfect score**: 40/40 detections with zero false positives

---

## Why This Benchmark Matters

Security linters exist to catch vulnerabilities before they reach production. But two failure modes undermine this mission:

**False Negatives** (missed vulnerabilities) create a dangerous illusion of security. Your CI pipeline passes, your code looks "clean," but invisible vulnerabilities ship to production.

**False Positives** (incorrectly flagged safe code) create alert fatigue. Developers start ignoring warnings, disabling rules, or worse—bypassing security checks entirely.

The ideal security linter has **high recall** (catches most vulnerabilities) and **high precision** (doesn't cry wolf).

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
| XSS / Code Execution  | 4          | CWE-79, CWE-94   |
| Prototype Pollution   | 3          | CWE-1321         |
| Insecure Randomness   | 2          | CWE-330          |
| Weak Cryptography     | 3          | CWE-328, CWE-327 |
| Timing Attacks        | 2          | CWE-208          |
| NoSQL Injection       | 2          | CWE-943          |
| SSRF                  | 2          | CWE-918          |
| Open Redirect         | 1          | CWE-601          |
| ReDoS                 | 2          | CWE-1333         |

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
| 🥇   | **Interlace Ecosystem**      | 3.0.2   | 201   | **40** | **0** | **0** | **100.0%** | **100.0%** | **100.0%** |
| 🥈   | eslint-plugin-sonarjs        | 3.0.6   | 269   | 14     | 5     | 26    | 73.7%      | 35.0%      | 47.5%      |
| 🥉   | eslint-plugin-security†      | 2.1.1   | 13    | 11     | 11    | 29    | 50.0%      | 27.5%      | 34.4%      |
| 4    | eslint-plugin-security-node  | 1.1.4   | 22    | 7      | 4     | 33    | 63.6%      | 17.5%      | 27.4%      |
| 5    | @microsoft/eslint-plugin-sdl | 1.1.0   | 17    | 4      | 1     | 36    | 80.0%      | 10.0%      | 17.8%      |
| 6    | eslint-plugin-no-unsanitized | 4.1.4   | 2     | 2      | 1     | 38    | 66.7%      | 5.0%       | 9.3%       |

> † Tested on ESLint 8.57.0 — crashes on ESLint 9 with `TypeError: context.getScope is not a function`

---

## Plugin Deep Dives

### eslint-plugin-security: The Incumbent

**Weekly Downloads:** 1.5M+ | **Rules:** 13 | **Last Updated:** 2024 | **ESLint 9:** ❌ Broken

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

| Category              | Detected | Missed                       |
| --------------------- | -------- | ---------------------------- |
| SQL Injection         | 0/4      | ❌ All                       |
| Hardcoded Credentials | 0/4      | ❌ All                       |
| JWT Vulnerabilities   | 0/3      | ❌ All                       |
| Weak Cryptography     | 0/3      | ❌ All                       |
| NoSQL Injection       | 0/2      | ❌ All                       |
| SSRF                  | 0/2      | ❌ All                       |
| Open Redirect         | 0/1      | ❌ All                       |
| Timing Attacks        | 0/2      | ❌ All                       |
| Command Injection     | 2/4      | ❌ Template literals         |
| Path Traversal        | 4/4      | ✅ Good                      |
| XSS / eval            | 1/4      | ❌ innerHTML, document.write |
| Prototype Pollution   | 2/3      | ⚠️ Partial                   |
| ReDoS                 | 2/2      | ✅ Good                      |

**The plugin has ZERO coverage for:** SQL injection, hardcoded credentials, JWT attacks, weak crypto, NoSQL injection, SSRF, open redirects, and timing attacks.

#### The False Positive Problem (11 FPs = 100% of detections!)

For every vulnerability `eslint-plugin-security` catches, it also incorrectly flags a safe pattern:

**FP #1-8: `detect-object-injection`** (8 false positives)

```javascript
// ✅ SAFE: Key validated against allowlist
const VALID_KEYS = ["name", "email", "age"];
if (VALID_KEYS.includes(key)) {
  return obj[key]; // ⚠️ Flagged as "Generic Object Injection Sink"
}
```

The rule flags **any** bracket notation with a variable, regardless of validation. It cannot recognize allowlist checks, `hasOwnProperty` guards, or `Object.hasOwn()` checks.

**FP #9-11: `detect-non-literal-fs-filename`** (3 false positives)

```javascript
// ✅ SAFE: Path validated with startsWith
const safePath = path.resolve(baseDir, path.basename(filename));
if (!safePath.startsWith(baseDir + path.sep)) {
  throw new Error("Path traversal detected");
}
fs.readFileSync(safePath); // ⚠️ Flagged anyway
```

The rule cannot recognize path validation patterns.

#### Why these false positives survive code review

Both FP samples above are code a reviewer _approved_. That's the part worth sitting with. The `detect-object-injection` warning fires on `obj[key]` even though the key was just checked against an allowlist three lines up — and the reviewer who approved that PR was right: the code is safe. So the rule and the human disagree, the human is correct, and the warning gets silenced.

The silencing is the problem. It almost never happens with a targeted `// eslint-disable-next-line` on the one safe line. What I've actually seen ship is the load-bearing shortcut: someone gets tired of suppressing `detect-object-injection` on the tenth validated lookup, and the rule goes into the project's `off` list in the shared config. Now it's off for the validated lookups _and_ for the unvalidated one a junior adds six months later. The rule was demoted not because it was wrong about the danger, but because it was wrong too often about safe code. A precise rule earns the benefit of the doubt; a 50%-precision rule spends it, and a senior signs off on the disable because the alternative is a wall of noise nobody reads.

This is the real cost the precision column measures. It isn't "annoying warnings." It's the rate at which your team learns to distrust the tool — and a tool nobody trusts catches nothing, no matter how good its recall looks on paper.

#### ESLint 9 Compatibility: ❌ BROKEN

```text
TypeError: context.getScope is not a function
Rule: "security/detect-child-process"
```

This is a breaking API change in ESLint 9. The plugin hasn't been updated, making it **unusable with modern ESLint flat config**.

> **On flat config and reading this far?** You currently have a security linter that crashes on install and, when it ran, was wrong half the time. The replacement that scored 40/40 with zero FPs is a one-line swap — domain-specific plugins instead of one monolith:
>
> ```bash
> npm uninstall eslint-plugin-security
> npm install -D eslint-plugin-secure-coding eslint-plugin-node-security \
>   eslint-plugin-browser-security \
>   eslint-plugin-pg eslint-plugin-jwt eslint-plugin-mongodb-security
> ```
>
> Full flat-config + migration steps are in the [60-second migration block](/articles/benchmark-17-eslint-security-plugins-compared#migrate-in-60-seconds). The per-plugin reasoning is in the [Interlace section below](#interlace-ecosystem).

---

### eslint-plugin-sonarjs: The 269-Rule Giant

**Weekly Downloads:** 3M+ | **Rules:** 269 | **Last Updated:** 2025 (active) | **ESLint 9:** ✅ Works

#### Detection Results: 14/40 (35% Recall)

Despite having the most rules of any plugin tested, SonarJS missed 65% of vulnerabilities. The majority of its 269 rules target **code quality** (complexity, duplication, cognitive load), not security.

| Category              | SonarJS | What It Missed                   |
| :-------------------- | :------ | :------------------------------- |
| SQL Injection         | 2/4     | Template literal patterns        |
| Command Injection     | 2/4     | `execSync`, `spawn` with shell   |
| XSS                   | 2/4     | `document.write`, `new Function` |
| Hardcoded Credentials | 2/4     | AWS keys, JWT secrets            |
| Prototype Pollution   | 2/3     | Nested merge patterns            |
| Weak Crypto           | 2/3     | MD4, custom hash selection       |
| ReDoS                 | 1/2     | Complex catastrophic patterns    |
| Path Traversal        | 0/4     | ❌ All                           |
| JWT                   | 0/3     | ❌ All                           |
| Timing Attacks        | 0/2     | ❌ All                           |
| NoSQL Injection       | 0/2     | ❌ All                           |
| SSRF                  | 0/2     | ❌ All                           |
| Open Redirect         | 0/1     | ❌ All                           |
| Insecure Random       | 1/2     | Token generation patterns        |

#### False Positives: 5

SonarJS had a 73.7% precision rate — better than eslint-plugin-security, but still means roughly **1 in 4 security warnings is noise**.

📖 _Deep dive: [SonarJS vs Interlace: 269 Rules, 65% Missed](/articles/benchmark-sonarjs-vs-interlace)_

---

### eslint-plugin-security-node: The Successor

**Weekly Downloads:** ~30K | **Rules:** 22 | **Last Updated:** 2023 | **ESLint 9:** ✅ Works

Created as a modern alternative to `eslint-plugin-security`, this plugin adds SQL injection and NoSQL injection detection rules that the original lacks. However, it still misses the majority of our test suite.

#### Detection Results: 7/40 (17.5% Recall)

| Category              | security-node | What It Caught                    |
| :-------------------- | :------------ | :-------------------------------- |
| SQL Injection         | 2/4           | Basic concatenation patterns      |
| Command Injection     | 2/4           | `exec` with string interpolation  |
| XSS / eval            | 1/4           | `eval` with expression            |
| NoSQL Injection       | 1/2           | Direct `$where` usage             |
| Timing Attacks        | 1/2           | Basic `===` comparison on secrets |
| Path Traversal        | 0/4           | ❌ All                            |
| Hardcoded Credentials | 0/4           | ❌ All                            |
| JWT                   | 0/3           | ❌ All                            |
| Weak Crypto           | 0/3           | ❌ All                            |
| SSRF                  | 0/2           | ❌ All                            |

#### False Positives: 4

A 63.6% precision rate — better than eslint-plugin-security's 50%, but still noisy.

---

### @microsoft/eslint-plugin-sdl: Enterprise Security

**Weekly Downloads:** ~100K | **Rules:** 17 | **Last Updated:** 2024 (active) | **ESLint 9:** ✅ Works

Microsoft's Security Development Lifecycle plugin has the **highest precision** of any non-Interlace plugin (80%), but its scope is extremely narrow — focused almost entirely on browser-side injection patterns.

#### Detection Results: 4/40 (10% Recall)

| Category        | Microsoft SDL | What It Caught                  |
| :-------------- | :------------ | :------------------------------ |
| XSS             | 2/4           | `innerHTML`, `document.write`   |
| Code Execution  | 2/4           | `eval`, `setTimeout` with exprs |
| Everything else | 0/32          | ❌ All                          |

#### False Positives: 1 (Microsoft SDL)

High precision, but extremely limited coverage. Its 17 rules focus narrowly on XSS patterns — it has **zero rules** for SQL injection, command injection, path traversal, JWT attacks, or any server-side vulnerability.

📖 _Deep dive: [Microsoft SDL vs Interlace: Enterprise Security Benchmark](/articles/benchmark-microsoft-sdl-vs-interlace)_

---

### eslint-plugin-no-unsanitized (Mozilla)

**Weekly Downloads:** ~500K | **Rules:** 2 | **Focus:** XSS via DOM manipulation | **ESLint 9:** ⚠️ Limited

#### Detection Results: 2/40

| Rule                      | Count | What It Caught            |
| ------------------------- | ----- | ------------------------- |
| `no-unsanitized/property` | 1     | `innerHTML = userContent` |
| `no-unsanitized/method`   | 1     | `insertAdjacentHTML`      |

#### False Positives: 1 (no-unsanitized)

```javascript
// ✅ SAFE: Content sanitized with DOMPurify
const sanitized = DOMPurify.sanitize(userContent);
element.innerHTML = sanitized; // ⚠️ Flagged anyway
```

Very narrow scope. Useful as a supplement for XSS, but covers only 2 of 14 categories.

---

### Interlace Ecosystem

**Weekly Downloads:** ~5K | **Rules:** 201 (10 specialized plugins) | **ESLint 9:** ✅ Works

#### Detection Results: 40/40 (100% Recall, 0 False Positives)

The Interlace ecosystem achieved a **perfect score** — detecting every vulnerability with zero false positives across all 14 categories.

**Sample detections:**

```text
🔒 CWE-798 OWASP:A04-Cryptographic CVSS:9.8 | Hard-coded API key detected | CRITICAL
   Fix: Use environment variable: process.env.API_KEY

🔒 CWE-347 | Including "none" in algorithms array allows unsigned tokens | CRITICAL
   Fix: Remove "none" from the algorithms array

🔒 CWE-95 OWASP:A05-Injection CVSS:9.8 | eval() can be refactored to safer alternative | HIGH
   Fix: Remove eval entirely
```

The reason for 100% coverage is **specialization**. Instead of one monolithic plugin, the ecosystem uses purpose-built plugins for each domain: SQL (`eslint-plugin-pg`), JWT (`eslint-plugin-jwt`), browser XSS (`eslint-plugin-browser-security`), and weak crypto / randomness (consolidated into `eslint-plugin-node-security` on 2026-05-10), and more.

---

## Category-by-Category Breakdown

| Category              | security† | security-node | sonarjs   | MS SDL   | no-unsanitized | Interlace |
| --------------------- | --------- | ------------- | --------- | -------- | -------------- | --------- |
| SQL Injection (4)     | ❌ 0/4    | ⚠️ 2/4        | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| Command Injection (4) | ⚠️ 2/4    | ⚠️ 2/4        | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| Path Traversal (4)    | ✅ 4/4    | ❌ 0/4        | ❌ 0/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| Hardcoded Creds (4)   | ❌ 0/4    | ❌ 0/4        | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4         | ✅ 4/4    |
| JWT (3)               | ❌ 0/3    | ❌ 0/3        | ❌ 0/3    | ❌ 0/3   | ❌ 0/3         | ✅ 3/3    |
| XSS / eval (4)        | ⚠️ 1/4    | ⚠️ 1/4        | ⚠️ 2/4    | ⚠️ 2/4   | ⚠️ 2/4         | ✅ 4/4    |
| Prototype Poll. (3)   | ⚠️ 2/3    | ❌ 0/3        | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3         | ✅ 3/3    |
| Insecure Random (2)   | ❌ 0/2    | ❌ 0/2        | ⚠️ 1/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| Weak Crypto (3)       | ❌ 0/3    | ❌ 0/3        | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3         | ✅ 3/3    |
| Timing Attacks (2)    | ❌ 0/2    | ⚠️ 1/2        | ❌ 0/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| NoSQL Injection (2)   | ❌ 0/2    | ⚠️ 1/2        | ❌ 0/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| SSRF (2)              | ❌ 0/2    | ❌ 0/2        | ❌ 0/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| Open Redirect (1)     | ❌ 0/1    | ❌ 0/1        | ❌ 0/1    | ❌ 0/1   | ❌ 0/1         | ✅ 1/1    |
| ReDoS (2)             | ✅ 2/2    | ❌ 0/2        | ⚠️ 1/2    | ❌ 0/2   | ❌ 0/2         | ✅ 2/2    |
| **TOTAL**             | **11/40** | **7/40**      | **14/40** | **4/40** | **2/40**       | **40/40** |

> † ESLint 8 results (crashes on ESLint 9)

---

## What This Means for Your Team

### The Math of Missing Vulnerabilities

If your codebase has 100 potentially vulnerable patterns:

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

That assumption is now false. In a separate experiment I [let Claude write 80 functions and found 65–75% shipped with a real security vulnerability](/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — the exact categories this benchmark tests: hardcoded credentials, missing JWT algorithm restriction, unparameterized queries, `child_process` with interpolated input. AI assistants reproduce the patterns in their training data, and their training data is full of the insecure 2018-era snippets these very rules were written to catch. The model is, in effect, a generator of test cases for a security linter — running at the speed of autocomplete.

Point the six plugins from this benchmark at AI-generated code and the recall column _is_ your catch rate. A linter that misses 72.5% of patterns now misses 72.5% of a much larger, faster-growing input. And it gets worse on the fix: when a rule does flag an AI-written vulnerability and the developer asks the same assistant to fix it, the assistant frequently swaps one flawed pattern for another the rule doesn't cover — the [AI Hydra problem](/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more), where fixing one bug spawns two more. Recall that only holds for the patterns you already imagined is recall that loses to a generator.

This is also why precision stopped being a nice-to-have. The volume of AI-authored code means more total warnings; if half of them are wrong, the disable-and-move-on reflex from the section above arrives faster and lands harder. High recall gets you the catch; high precision is what keeps the team from turning the catcher off.

---

## Methodology

### Test Environment

| Component    | Version              |
| :----------- | :------------------- |
| **Node.js**  | v20.19.5             |
| **ESLint**   | 9.39.2 (8.57.0†)     |
| **Platform** | macOS (darwin/arm64) |
| **Date**     | February 8, 2026     |

> † ESLint 8.57.0 used for eslint-plugin-security only (crashes on ESLint 9)

### Fixture Design

All fixtures are:

- **Realistic:** Patterns from actual codebases, not contrived examples
- **Reproducible:** Published to GitHub with exact versions
- **Comprehensive:** All OWASP Top 10 with detectable patterns

### Reproducibility

Full bench setup (fixtures, scripts, methodology) is documented in the companion article: [I Benchmarked 17 ESLint Security Plugins](/articles/benchmark-17-eslint-security-plugins-compared#methodology). The FP samples in this article come from the same suite:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install
npm run benchmark:fn-fp

# ESLint 8 benchmark (eslint-plugin-security only — required because it crashes on ESLint 9)
cd benchmarks/fn-fp-comparison/eslint8-compat
npm install
npm run benchmark
```

Every claim in this article can be independently verified.

---

## Conclusions

1. **eslint-plugin-security is hard to recommend for ESLint 9 codebases.** A 72.5% false negative rate and a 1:1 TP:FP ratio on ESLint 8, plus a hard crash on ESLint 9. Teams on flat-config are left with no signal at all.

2. **eslint-plugin-sonarjs is a quality tool, not a security tool.** Despite 269 rules and 3M+ downloads, it misses 65% of security vulnerabilities. Its strength is code quality enforcement.

3. **eslint-plugin-security-node is broader but still partial.** It covers more categories than its predecessor, but still misses 82.5% of vulnerabilities.

4. **@microsoft/eslint-plugin-sdl is high precision, low coverage.** Strong for browser XSS, but provides zero server-side security coverage.

5. **The Interlace ecosystem delivers comprehensive coverage.** 100% detection rate with zero false positives. Domain-specific plugins ensure deep coverage across all vulnerability categories.

6. **Security tooling requires active maintenance.** The OWASP landscape evolves. Plugins from 2020 don't cover JWT algorithm confusion, AI prompt injection, or modern SSRF patterns.

---

## Migrating Off eslint-plugin-security

Full migration steps (uninstall + install + config) are in the [companion article's 60-second migration block](/articles/benchmark-17-eslint-security-plugins-compared#migrate-in-60-seconds). The short version:

```bash
npm uninstall eslint-plugin-security
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-browser-security \
  eslint-plugin-pg eslint-plugin-jwt eslint-plugin-mongodb-security
```

> Note: weak-crypto and randomness rules were consolidated into `eslint-plugin-node-security` on 2026-05-10. The previously separate `eslint-plugin-crypto` package is deprecated.

---

## Your turn

Every team I've worked with has the same artifact buried in its shared ESLint config: a security rule in the `off` list with a comment like `// too noisy`. Sometimes it's `detect-object-injection`. Sometimes it's a whole plugin.

Go look at yours. **Which security rule did your team disable because it cried wolf too often — and what shipped through the gap after you turned it off?** That's the real cost of the false-positive tax, and I'd genuinely like to read your version of it in the comments.

---

## Related deep dives

- [The #1 ESLint Security Plugin Has 1.5M Downloads and Caught 0 of My 40 Vulnerabilities](/articles/benchmark-17-eslint-security-plugins-compared) — the recall-ranked companion to this FP deep dive
- [Same File: eslint-plugin-security Caught 21, the Domain Plugins Caught 46](/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h) — the floor-not-ceiling argument on real code
- [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — why recall now matters more than it did
- [What Ground Truth Caught That Unit Tests Missed](/articles/what-ground-truth-caught-that-unit-tests-missed) — how I validate a rule's true/false positives before trusting the F1 score

---

## Explore the Full Ecosystem

> **201 security rules. 10 specialized plugins. 100% OWASP Top 10 coverage.**
>
> The Interlace ESLint Ecosystem provides comprehensive security static analysis for modern Node.js applications.
>
> [📖 Documentation](https://eslint.interlace.tools) | [⭐ GitHub](https://github.com/ofri-peretz/eslint) | [📦 NPM](https://npmjs.com/~ofriperetz)

---

**Build Securely.**

I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=fn-fp-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
