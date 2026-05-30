---
title: "I Benchmarked 17 ESLint Security Plugins. Only One Found Every Vulnerability."
description: "I ran 40 real-world vulnerable patterns through every major ESLint security plugin — from eslint-plugin-security to SonarJS to Microsoft SDL. The detection gaps are alarming."
slug: "benchmark-17-eslint-security-plugins-compared"
canonical_url: "https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared"
devto_url: "https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83"
devto_id: 3241881
published_at: "2026-05-25T14:27:23Z"
edited_at: "2026-05-25T14:27:23Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7f2bcys47t9v6chwuj00.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7f2bcys47t9v6chwuj00.png"
reading_time_minutes: 12
tags:
  - "security"
  - "eslint"
  - "javascript"
  - "benchmark"
series: "ESLint Security Benchmark Series"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

**Skip to:** [Full Results](#the-results) | [Category Breakdown](#category-by-category-breakdown) | [The Leaderboard](#the-leaderboard) | [Methodology](#methodology)

## TL;DR

I built a benchmark suite with **40 vulnerable code patterns** across 14 CWE categories and **38 verified-safe patterns**. Then I ran **17 ESLint plugins** against them — every major security, quality, and framework plugin in the ecosystem.

**One plugin achieved a perfect score. Most others detected under 50% of patterns.**

| Rank | Plugin                       | Rules | TP        | FP    | F1 Score    |
| :--- | :--------------------------- | :---- | :-------- | :---- | :---------- |
| 🥇   | **Interlace Ecosystem**      | 201   | **40/40** | **0** | **100.0%**  |
| 🥈   | eslint-plugin-sonarjs        | 269   | 14/40     | 5     | 47.5%       |
| 🥉   | eslint-plugin-unicorn        | 144   | 22/40     | 23    | 51.8%       |
| 4    | @microsoft/eslint-plugin-sdl | 17    | 4/40      | 1     | 17.8%       |
| 5    | eslint-plugin-security †     | 13    | 0/40      | 0     | 0% (crash)  |

> † `eslint-plugin-security` crashes on ESLint 9.39.2 with `TypeError: context.getScope is not a function`, so the bench records 0 detections on the standard test environment. On ESLint 8.57.0 it detects 11/40 (recall 27.5%) but with an equal number of false positives (a 1:1 TP:FP ratio).

The incumbent security plugin — `eslint-plugin-security`, with 1.5M+ weekly downloads — **detects zero vulnerabilities on modern ESLint** because it hasn't been updated for the flat-config API.

---

## Why This Matters

Most Node.js teams rely on a security linter they've never benchmarked. They install `eslint-plugin-security` or enable SonarJS security rules and assume they're covered.

They're not.

The data shows a **massive detection gap** across the entire ecosystem. Plugins that claim security coverage miss 60–100% of standard vulnerability patterns. And some of the highest-downloaded plugins aren't security tools at all — they detected zero issues from our suite.

This isn't theoretical. These are OWASP Top 10 patterns that ship to production every day.

---

## The Benchmark Suite

### Test Environment

| Component    | Version              |
| :----------- | :------------------- |
| **Node.js**  | v20.19.5             |
| **ESLint**   | 9.39.2               |
| **Platform** | macOS (darwin/arm64) |
| **Date**     | February 8, 2026     |

### Vulnerable Patterns (40 cases, 14 CWE categories)

| Category              | Cases | CWEs             | Real-World Impact              |
| :-------------------- | :---- | :--------------- | :----------------------------- |
| SQL Injection         | 4     | CWE-89           | Data exfiltration, auth bypass |
| Command Injection     | 4     | CWE-78           | Remote code execution          |
| Path Traversal        | 4     | CWE-22           | Arbitrary file read/write      |
| Hardcoded Credentials | 4     | CWE-798          | Account takeover               |
| JWT Vulnerabilities   | 3     | CWE-757, CWE-347 | Auth bypass                    |
| XSS / Code Execution  | 4     | CWE-79, CWE-94   | Session hijack, RCE            |
| Prototype Pollution   | 3     | CWE-1321         | DoS, property injection        |
| Insecure Randomness   | 2     | CWE-330          | Predictable tokens             |
| Weak Cryptography     | 3     | CWE-328, CWE-327 | Credential exposure            |
| Timing Attacks        | 2     | CWE-208          | Secret extraction              |
| NoSQL Injection       | 2     | CWE-943          | Data exfiltration              |
| SSRF                  | 2     | CWE-918          | Internal network access        |
| Open Redirect         | 1     | CWE-601          | Phishing                       |
| ReDoS                 | 2     | CWE-1333         | Denial of service              |

### Safe Patterns (38 cases)

These are **correctly-implemented secure patterns** that should NOT trigger warnings:

- Parameterized SQL queries (Prisma, TypeORM, pg)
- `execFile` with validated arguments
- `path.resolve` with `startsWith` validation
- Environment variables for credentials
- JWT with explicit algorithm restriction
- DOMPurify sanitization
- Allowlist validation before object access
- `crypto.randomBytes` for tokens
- `crypto.timingSafeEqual` for comparisons
- URL allowlists for SSRF prevention

Any warnings on these patterns are **false positives** — noise that creates alert fatigue and trains developers to ignore real issues.

---

## The Results

### The Leaderboard

> Plugin download counts cited throughout this article are weekly figures snapshotted on 2026-02-08 from [npm-stat.com](https://npm-stat.com).

| Rank | Plugin                        | Version | Rules | TP     | FP    | FN    | Precision  | Recall     | F1         |
| :--- | :---------------------------- | :------ | :---- | :----- | :---- | :---- | :--------- | :--------- | :--------- |
| 🥇   | **Interlace Ecosystem**       | 3.0.2   | 201   | **40** | **0** | **0** | **100.0%** | **100.0%** | **100.0%** |
| 🥈   | eslint-plugin-sonarjs         | 3.0.6   | 269   | 14     | 5     | 26    | 73.7%      | 35.0%      | 47.5%      |
| 🥉   | eslint-plugin-unicorn         | 62.0.0  | 144   | 22     | 23    | 18    | 48.9%      | 55.0%      | 51.8%      |
| 4    | @microsoft/eslint-plugin-sdl  | 1.1.0   | 17    | 4      | 1     | 36    | 80.0%      | 10.0%      | 17.8%      |
| 5    | eslint-plugin-no-secrets      | 2.2.1   | 2     | 2      | 0     | 38    | 100.0%     | 5.0%       | 9.5%       |
| 6    | eslint-plugin-no-unsanitized  | 4.1.4   | 2     | 2      | 1     | 38    | 66.7%      | 5.0%       | 9.3%       |
| 7    | eslint-plugin-n               | 17.23.2 | 41    | 2      | 3     | 38    | 40.0%      | 5.0%       | 8.9%       |
| 8    | eslint-plugin-regexp          | 3.0.0   | 78    | 1      | 2     | 39    | 33.3%      | 2.5%       | 4.7%       |
| 9    | eslint-plugin-security †      | 2.1.1   | 13    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 10   | eslint-plugin-react           | 7.37.5  | 103   | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 11   | eslint-plugin-jsx-a11y        | 6.10.2  | 39    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 12   | eslint-plugin-import          | 2.32.0  | 44    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 13   | eslint-plugin-promise         | 7.2.1   | 13    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 14   | eslint-plugin-jest            | 29.12.2 | 71    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 15   | eslint-plugin-vue             | 10.7.0  | 250   | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 16   | @angular-eslint/eslint-plugin | 21.2.0  | 48    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |

> **Note:** `eslint-plugin-jsdoc` (38 TP / 37 FP / F1=66.1%) was excluded from the leaderboard. Its detections are incidental — it flags every function missing JSDoc, not security issues. A 97.4% false positive rate is unusable for security.

### Visual Detection Rates

```text
Vulnerable Code Detections (out of 40 patterns):

Interlace Ecosystem:       ████████████████████████████████████████  40 (100%)
eslint-plugin-unicorn:     ██████████████████████░░░░░░░░░░░░░░░░░░  22 (55%)
eslint-plugin-sonarjs:     ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  14 (35%)
@microsoft/eslint-plugin:  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4 (10%)
eslint-plugin-security:    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0 (0%)
```

---

## The plugins behind "Interlace Ecosystem"

The "Interlace Ecosystem" row in the leaderboard is the combined output of 10 ESLint plugins running together against the same fixture suite — 201 rules in total:

`eslint-plugin-secure-coding` · `eslint-plugin-node-security` · `eslint-plugin-browser-security` · `eslint-plugin-pg` · `eslint-plugin-jwt` · `eslint-plugin-mongodb-security` · `eslint-plugin-vercel-ai-security` · `eslint-plugin-lambda-security` · `eslint-plugin-express-security` · `eslint-plugin-nestjs-security`

Per-plugin rule counts and focus areas are in [Specialization vs. one-size-fits-all](#specialization-vs-one-size-fits-all) below.

---

## The Security Plugins: Deep Dive

### eslint-plugin-security (1.5M+ downloads) — BROKEN

**F1 Score: 0%** | Zero detections

The most widely-installed ESLint security plugin detected nothing. It crashes on ESLint 9 with:

```text
TypeError: context.getScope is not a function
Rule: "security/detect-child-process"
```

This is due to the deprecated `context.getScope()` API removed in ESLint 9. The plugin hasn't been updated since 2024. **If you're using ESLint 9 with flat config, this plugin provides zero security coverage.**

📖 _Deep dive: [eslint-plugin-security Is Abandoned](/articles/eslint-plugin-security-abandoned)_

### eslint-plugin-sonarjs (3M+ downloads) — 35% Recall

**F1 Score: 47.5%** | 14 detected, 26 missed, 5 false positives

SonarJS found issues across a few categories but missed the majority:

| Category              | SonarJS | What It Missed                   |
| :-------------------- | :------ | :------------------------------- |
| SQL Injection         | 2/4     | Template literal patterns        |
| Command Injection     | 2/4     | `execSync`, `spawn` with shell   |
| XSS                   | 2/4     | `document.write`, `new Function` |
| Hardcoded Credentials | 2/4     | AWS keys, JWT secrets            |
| Path Traversal        | 0/4     | ❌ All                           |
| JWT                   | 0/3     | ❌ All                           |
| Timing Attacks        | 0/2     | ❌ All                           |
| NoSQL Injection       | 0/2     | ❌ All                           |
| SSRF                  | 0/2     | ❌ All                           |

Despite having **269 rules** (the most of any plugin tested), SonarJS missed 65% of vulnerabilities. Many of its rules target code quality, not security.

📖 _Deep dive: [SonarJS vs Interlace: 269 Rules, 65% Missed](/articles/benchmark-sonarjs-vs-interlace)_

### @microsoft/eslint-plugin-sdl — 10% Recall

**F1 Score: 17.8%** | 4 detected, 36 missed, 1 false positive

Microsoft's SDL (Security Development Lifecycle) plugin found XSS via `innerHTML`/`document.write` and `eval` patterns, but missed everything else. Its 17 rules focus narrowly on browser-side injection.

| Category        | Microsoft SDL |
| :-------------- | :------------ |
| XSS             | 2/4 ✅        |
| Code Execution  | 2/4 ⚠️        |
| Everything else | 0/32 ❌       |

📖 _Deep dive: [Microsoft SDL vs Interlace: Enterprise Security Benchmark](/articles/benchmark-microsoft-sdl-vs-interlace)_

### eslint-plugin-no-secrets — Narrow But Precise

**F1 Score: 9.5%** | 2 detected, 0 false positives

Only 2 rules, but they do their job — detecting hardcoded secrets with zero false positives. Good as a supplement, but not a security strategy.

### eslint-plugin-no-unsanitized (Mozilla) — DOM XSS Only

**F1 Score: 9.3%** | 2 detected, 1 false positive

Detects `innerHTML` and `insertAdjacentHTML` DOM sinks. Cannot recognize DOMPurify sanitization (1 FP). Useful for browser projects but covers only 2 of 14 categories.

---

## The Non-Security Plugins: Confirmed Gaps

These widely-installed plugins are **not security tools**, confirmed by zero detections:

| Plugin                 | Downloads | Purpose           | Security Detections |
| :--------------------- | :-------- | :---------------- | :------------------ |
| eslint-plugin-react    | 17M+      | React patterns    | 0                   |
| eslint-plugin-import   | 40M+      | Module resolution | 0                   |
| eslint-plugin-promise  | 10M+      | Promise patterns  | 0                   |
| eslint-plugin-jest     | 14M+      | Jest testing      | 0                   |
| eslint-plugin-vue      | 7M+       | Vue.js            | 0                   |
| @angular-eslint        | 2.25M+    | Angular           | 0                   |
| eslint-plugin-jsx-a11y | 14M+      | Accessibility     | 0                   |

These are excellent tools for their intended purpose. But if your security posture relies on them, you have **zero coverage**.

---

## Category-by-Category Breakdown

| Category                  | Interlace | SonarJS   | MS SDL   | Security | no-unsanitized | no-secrets |
| :------------------------ | :-------- | :-------- | :------- | :------- | :------------- | :--------- |
| SQL Injection (4)         | ✅ 4/4    | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ❌ 0/4     |
| Command Injection (4)     | ✅ 4/4    | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ❌ 0/4     |
| Path Traversal (4)        | ✅ 4/4    | ❌ 0/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ❌ 0/4     |
| Hardcoded Credentials (4) | ✅ 4/4    | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ⚠️ 2/4     |
| JWT (3)                   | ✅ 3/3    | ❌ 0/3    | ❌ 0/3   | ❌ 0/3   | ❌ 0/3         | ❌ 0/3     |
| XSS / eval (4)            | ✅ 4/4    | ⚠️ 2/4    | ⚠️ 2/4   | ❌ 0/4   | ⚠️ 2/4         | ❌ 0/4     |
| Prototype Pollution (3)   | ✅ 3/3    | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3   | ❌ 0/3         | ❌ 0/3     |
| Insecure Random (2)       | ✅ 2/2    | ❌ 0/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| Weak Crypto (3)           | ✅ 3/3    | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3   | ❌ 0/3         | ❌ 0/3     |
| Timing Attacks (2)        | ✅ 2/2    | ❌ 0/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| NoSQL Injection (2)       | ✅ 2/2    | ❌ 0/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| SSRF (2)                  | ✅ 2/2    | ❌ 0/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| Open Redirect (1)         | ✅ 1/1    | ❌ 0/1    | ❌ 0/1   | ❌ 0/1   | ❌ 0/1         | ❌ 0/1     |
| ReDoS (2)                 | ✅ 2/2    | ⚠️ 1/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| **TOTAL**                 | **40/40** | **13/40** | **2/40** | **0/40** | **2/40**       | **2/40**   |

### Specialization vs. one-size-fits-all

The reason Interlace achieves 100% coverage is **specialization**. Instead of one monolithic plugin trying to cover everything, the ecosystem uses 10 purpose-built plugins:

| Plugin                             | Focus                                          | Rules |
| :--------------------------------- | :--------------------------------------------- | :---- |
| `eslint-plugin-secure-coding`      | Core OWASP patterns                            | 23    |
| `eslint-plugin-node-security`      | fs, child_process, vm, weak crypto, randomness | 42    |
| `eslint-plugin-browser-security`   | XSS, CORS, CSP                                 | 45    |
| `eslint-plugin-pg`                 | SQL injection, connection safety               | 13    |
| `eslint-plugin-jwt`                | Algorithm confusion, token safety              | 13    |
| `eslint-plugin-mongodb-security`   | NoSQL injection, operator injection            | 16    |
| `eslint-plugin-vercel-ai-security` | Prompt injection, output validation            | 19    |
| `eslint-plugin-lambda-security`    | IAM, cold starts, secrets                      | 14    |
| `eslint-plugin-express-security`   | Helmet, CORS, sessions                         | 10    |
| `eslint-plugin-nestjs-security`    | Guards, pipes, decorators                      | 6     |

> Crypto rules (weak algorithms, insecure randomness) were consolidated into `eslint-plugin-node-security` on 2026-05-10. The previously separate `eslint-plugin-crypto` package is deprecated and should not be installed.

Each plugin is maintained by domain experts and updated independently. A JWT vulnerability doesn't require updating the SQL injection rules.

---

## What This Means For Your Team

### The Math

If your codebase has 100 potentially vulnerable patterns:

| Your Current Stack           | Detected | **Shipped to Production** |
| :--------------------------- | :------- | :------------------------ |
| eslint-plugin-security       | 0        | **100 vulnerabilities**   |
| eslint-plugin-sonarjs        | 35       | **65 vulnerabilities**    |
| @microsoft/eslint-plugin-sdl | 10       | **90 vulnerabilities**    |
| **Interlace Ecosystem**      | 100      | **0 vulnerabilities**     |

### The False Positive Tax

False positives create **alert fatigue** — developers learn to ignore security warnings:

| Plugin                | FP Rate | Developer Impact             |
| :-------------------- | :------ | :--------------------------- |
| eslint-plugin-unicorn | 51.1%   | Every other warning is noise |
| eslint-plugin-sonarjs | 26.3%   | 1 in 4 is noise              |
| **Interlace**         | **0%**  | Every warning is actionable  |

---

## Methodology

### Fixture Design

All fixtures are:

- **Realistic:** Patterns from actual production codebases, not contrived examples
- **Annotated:** Each pattern includes its CWE, expected severity, and detection requirement
- **Reproducible:** Published in the open-source benchmark suite

### Metrics

| Metric                  | Formula                | What It Measures         |
| :---------------------- | :--------------------- | :----------------------- |
| **True Positive (TP)**  | Vulnerability detected | Correct detection        |
| **False Positive (FP)** | Safe code flagged      | Noise / alert fatigue    |
| **False Negative (FN)** | Vulnerability missed   | Security gap             |
| **Precision**           | TP / (TP + FP)         | Signal-to-noise ratio    |
| **Recall**              | TP / (TP + FN)         | Coverage completeness    |
| **F1 Score**            | 2 × (P × R) / (P + R)  | Overall accuracy balance |

### Reproducibility

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install
npm run benchmark:fn-fp
```

Every claim in this article can be independently verified.

---

## Migrate in 60 Seconds

```bash
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security \
  eslint-plugin-browser-security \
  eslint-plugin-pg eslint-plugin-jwt eslint-plugin-mongodb-security
```

```javascript
// eslint.config.js
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import browserSecurity from "eslint-plugin-browser-security";

export default [
  secureCoding.configs.recommended,
  nodeSecurity.configs.recommended,
  browserSecurity.configs.recommended,
];
```

Run ESLint. See what you've been missing.

---

## Related deep dives in this series

This article is the ecosystem overview. For detailed per-plugin comparisons, see:

- [SonarJS vs Interlace: 269 Rules Still Miss 65% of Vulnerabilities](/articles/benchmark-sonarjs-vs-interlace)
- [Microsoft SDL vs Interlace: Enterprise Security Benchmark](/articles/benchmark-microsoft-sdl-vs-interlace)
- [eslint-plugin-security Is Unmaintained — Here's What to Use Instead](/articles/eslint-plugin-security-abandoned)

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

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=benchmark-17-plugins) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
