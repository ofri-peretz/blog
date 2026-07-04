---
title: "The #1 ESLint Security Plugin Has 1.5M Downloads and Caught 0 of My 40 Vulnerabilities"
description: "I ran 40 real-world vulnerable patterns through 17 ESLint plugins — eslint-plugin-security, SonarJS, Microsoft SDL. The most-installed one detects nothing on ESLint 9. Most others miss 60–100%. Here's the reproducible benchmark, and what happens when you point these rules at AI-generated code."
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
  - "node"
  - "ai"
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

1.5 million teams a week install `eslint-plugin-security`. On modern ESLint it catches **0 of 40** real vulnerabilities — it has been a green checkmark over nothing since ESLint 9 shipped flat config. I benchmarked it, and 16 other plugins, against 40 real vulnerabilities to find out who actually fires. Only one plugin set caught all 40.

**Skip to:** [Full Results](#the-results) | [Category Breakdown](#category-by-category-breakdown) | [The Leaderboard](#the-leaderboard) | [Migrate in 60 Seconds](#migrate-in-60-seconds) | [Methodology](#methodology)

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

> **Run provenance (read this before quoting a number).** The 16 competitor rows are a single Feb-2026 snapshot (`results/fn-fp-comparison/2026-02-07.json`). The Interlace `40/40, 0 FP, 100% F1` figure is from a **later** verification run (`results/fn-fp-comparison/golden-2026-05-29.json`), after the rule work described in [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100) below. These are not the same execution. If you clone the repo and run the Feb-era Interlace plugins, you will see 31/40 — the journey is the point, and it's documented, not hidden. The environment table is pinned to the run that produced the headline number.

The incumbent security plugin — `eslint-plugin-security`, with 1.5M+ weekly downloads — **detects zero vulnerabilities on modern ESLint** because it hasn't been updated for the flat-config API.

---

## Why This Matters

Most Node.js teams rely on a security linter they've never benchmarked. They install `eslint-plugin-security` or enable SonarJS security rules and assume they're covered.

They're not.

The data shows a **massive detection gap** across the entire ecosystem. Plugins that claim security coverage miss 60–100% of standard vulnerability patterns. And some of the highest-downloaded plugins aren't security tools at all — they detected zero issues from our suite.

This isn't theoretical. These are OWASP Top 10 patterns that ship to production every day.

### Why this survives code review

Here's the part that should make you uncomfortable: the _name_ of a security plugin in your config is evidence to a reviewer. When `eslint-plugin-security` is listed in `eslint.config.js`, the pull request reads as covered — the reviewer sees "security linter: present" and approves. Nobody re-reads the SQL string concatenation, because the tooling is supposed to have looked at it. But on ESLint 9 the plugin's rules crash (see the `context.getScope` error above) and contribute **zero** detections; the config still claims coverage it can no longer deliver.

I've watched this exact failure on real teams. The linter isn't lying on purpose — it's a tool the team adopted years ago, pinned, and never re-benchmarked across a major ESLint upgrade. The config still _says_ `eslint-plugin-security`. The coverage left two ESLint majors ago. The _appearance_ of a security gate became a false sense of security, which is worse than no linter at all, because no linter at least keeps a human paranoid.

Here's the precise moment it goes dark, and why nobody notices: someone bumps ESLint 8 → 9 in a Renovate PR. From that version on, the plugin's rules hit `context.getScope is not a function` and stop producing findings — the security checks that used to flag a tainted query now report nothing. The PR title says "chore(deps): bump eslint." It gets one approval and merges on a Friday. From that commit forward, every SQL-concatenation and `child_process` call your security linter used to catch sails through, and the only evidence is a plugin name in a config file that no longer does anything. I have never once seen that PR get a security review — it's a dependency bump, who reviews those for coverage regressions? **A security rule that silently stops firing isn't a weaker control than no rule; it's a worse one, because it's also a lie your reviewers believe.**

That's the difference between "we run a security linter" and "we measured what our security linter catches." This benchmark is the second one.

---

## The Benchmark Suite

### Test Environment

This table is pinned to the run that produced the headline `40/40, 0 FP` figure (`golden-2026-05-29.json`, `verified` field). The Feb competitor snapshot ran on the same ESLint/platform but Node v20.19.5; the headline run used Node v24.12.0. Both are recorded in the repo so you can diff them yourself.

| Component    | Version              |
| :----------- | :------------------- |
| **Node.js**  | v24.12.0             |
| **ESLint**   | 9.39.2               |
| **Platform** | macOS (darwin/arm64) |
| **Date**     | May 29, 2026         |

### Vulnerable Patterns (40 cases, 13 CWE categories)

> Category labels and counts below mirror the `categoryBreakdown` in `golden-2026-05-29.json` exactly, so a reader cloning the repo sees identical buckets. SQL and NoSQL injection are scored together as one **SQL Injection (6)** bucket (4 relational + 2 document-store, CWE-89/CWE-943); the fixture taxonomy does not split them.

| Category               | Cases | CWEs             | Real-World Impact              |
| :--------------------- | :---- | :--------------- | :----------------------------- |
| SQL Injection (+ NoSQL) | 6     | CWE-89, CWE-943  | Data exfiltration, auth bypass |
| Command Injection      | 4     | CWE-78           | Remote code execution          |
| Path Traversal         | 4     | CWE-22           | Arbitrary file read/write      |
| Hardcoded Credentials  | 4     | CWE-798          | Account takeover               |
| JWT Vulnerabilities    | 3     | CWE-757, CWE-347 | Auth bypass                    |
| XSS / Code Execution   | 4     | CWE-79, CWE-94   | Session hijack, RCE            |
| Prototype Pollution    | 3     | CWE-1321         | DoS, property injection        |
| Insecure Randomness    | 2     | CWE-330          | Predictable tokens             |
| Weak Cryptography      | 3     | CWE-328, CWE-327 | Credential exposure            |
| Timing Attacks         | 2     | CWE-208          | Secret extraction              |
| SSRF                   | 2     | CWE-918          | Internal network access        |
| Open Redirect          | 1     | CWE-601          | Phishing                       |
| ReDoS                  | 2     | CWE-1333         | Denial of service              |

> **One CWE note before a pedant beats me to it:** the fixtures tag the JWT cases with **CWE-757** (algorithm downgrade — what the rule's diagnostic prints, so the table matches the repo). For the specific `alg:none` case (`vuln_jwt_alg_none`), the more precise mapping is **CWE-347 (Improper Verification of Cryptographic Signature)**, since accepting `none` skips signature verification entirely. Both CWEs are listed above on purpose; the detection is identical either way.

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
>
> **Row provenance:** rows 2–16 (every competitor) are the Feb-2026 snapshot run (`2026-02-07.json`). The Interlace row (🥇) is the later golden verification run (`golden-2026-05-29.json`), with the fleet pinned to `eslint-plugin-node-security` ≥ 4.2.0 — the version that closed the last gaps (see [the 77.5%→100% section](#how-interlace-got-from-775-to-100)). In the Feb snapshot, on the older plugin versions, Interlace scored **31/40 with 9 FPs (F1 77.5%)**; that row is shown explicitly in the journey section rather than buried. The two runs share the same 40-fixture suite, ESLint 9.39.2, and macOS arm64.

| Rank | Plugin                        | Version           | Rules | TP     | FP    | FN    | Precision  | Recall     | F1         |
| :--- | :---------------------------- | :---------------- | :---- | :----- | :---- | :---- | :--------- | :--------- | :--------- |
| 🥇   | **Interlace Ecosystem** ‡     | node-security 4.2.0 | 201   | **40** | **0** | **0** | **100.0%** | **100.0%** | **100.0%** |
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

> ‡ The Interlace row is the golden verification run (Node v24.12.0, 2026-05-29), not the Feb snapshot. On the Feb snapshot's plugin versions Interlace scored 31/40 / 9 FP / F1 77.5% — that earlier row is shown in full under [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100). The "201 rules" count is the combined fleet of 10 plugins (see [The plugins behind "Interlace Ecosystem"](#the-plugins-behind-interlace-ecosystem)); "Interlace Ecosystem" is a leaderboard meta-label, **not** an installable npm package.
>
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

## How Interlace got from 77.5% to 100%

The 100% number is the destination, not the starting point — and if I hid that, the first engineer to clone the repo would catch it and say so in the comments. So here is the whole arc, with the failing run on the table.

In the Feb-2026 baseline (`2026-02-07.json`), **Interlace itself scored 31/40 with 9 false positives — F1 77.5%**, run against the same fixtures as every competitor above. The 9 misses were concrete:

- `vuln_sql_string_concat` — SQL built by string concatenation (the relational SQL rule only matched template literals)
- `vuln_xss_innerhtml` — `innerHTML` assignment from a tainted source
- `vuln_random_token`, `vuln_random_session` — `Math.random()` used for security tokens (weak randomness)
- `vuln_nosql_mongo`, `vuln_nosql_where` — operator injection into a Mongo query / `$where`
- `vuln_ssrf_fetch`, `vuln_ssrf_axios` — server-side request to a user-controlled URL
- `vuln_redirect` — open redirect from an unvalidated `Location`

And the 9 false positives were just as instructive — the rules were firing on **safe** code: validated `child_process` calls, allowlisted path joins, null-prototype objects, `crypto.timingSafeEqual`, same-origin redirects. A 1:1 TP:FP ratio is exactly the alert-fatigue trap I criticize SonarJS and unicorn for above; in Feb, Interlace was in it too.

Those two lists — the misses and the noise — _were_ the rule backlog. The SSRF, NoSQL, and open-redirect gaps drove new detectors; the false positives drove the allowlist-aware refinements that let the safe patterns pass. The last two misses (`vuln_random_token`, `vuln_random_session`) closed when crypto/randomness rules were consolidated into **`eslint-plugin-node-security` 4.2.0 (released 2026-05-10)** with `no-math-random-crypto`. The golden verification run on 2026-05-29, with that version pinned, is the 40/40 / 0 FP / 100% you see in the leaderboard.

Two honest caveats so nobody is surprised:

- **Pin the version.** On `eslint-plugin-node-security` &lt; 4.2.0 the two randomness cases are still missed, so the fleet scores 38/40. The headline requires ≥ 4.2.0.
- **Run the fleet, not one plugin.** A single plugin in isolation covers only its domain — a spot-run of `node-security` alone against all 40 fixtures lands around 27% (7/40), because it was never meant to catch SQL or JWT or XSS on its own. The 100% is the 10 plugins running together, which is how the [config block](#migrate-in-60-seconds) wires them.

That's the difference between a benchmark you can trust and a screenshot you can't reproduce: the failing run is in the same folder as the passing one.

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

📖 _Deep dive: [eslint-plugin-security Is Unmaintained — Here's What Nobody Tells You](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)_

### eslint-plugin-sonarjs (3M+ downloads) — 35% Recall

**F1 Score: 47.5%** | 14 detected, 26 missed, 5 false positives

SonarJS found issues across a few categories but missed the majority. These rows mirror its `categoryBreakdown` in `golden-2026-05-29.json` (which matches the Feb `byFunction` detections exactly — 14 either way):

| Category              | SonarJS | What It Missed                              |
| :-------------------- | :------ | :------------------------------------------ |
| Command Injection     | 4/4 ✅  | —                                           |
| Insecure Randomness   | 2/2 ✅  | —                                           |
| XSS / eval            | 2/4     | `innerHTML`, `document.write`               |
| Hardcoded Credentials | 2/4     | AWS keys, API keys                          |
| Weak Cryptography     | 2/3     | DES                                         |
| JWT                   | 1/3     | missing-algorithm, no-expiry (caught only alg:none) |
| ReDoS                 | 1/2     | user-supplied pattern                       |
| SQL + NoSQL Injection | 0/6     | ❌ All — every relational and document-store case |
| Path Traversal        | 0/4     | ❌ All                                      |
| Prototype Pollution   | 0/3     | ❌ All                                      |
| Timing Attacks        | 0/2     | ❌ All                                      |
| SSRF                  | 0/2     | ❌ All                                      |
| Open Redirect         | 0/1     | ❌ All                                      |

The two categories SonarJS actually carries are Command Injection (4/4) and Insecure Randomness (2/2 — `Math.random()` for tokens). Despite having **269 rules** (the most of any plugin tested), it caught **14/40** and missed 65% of vulnerabilities — most damningly, **0 of 6 SQL/NoSQL injection cases**, the category most teams assume a "security" linter covers. Many of its rules target code quality, not security.

📖 _Deep dive: [SonarJS vs Interlace: 269 Rules, 65% Missed](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace)_

### @microsoft/eslint-plugin-sdl — 10% Recall

**F1 Score: 17.8%** | 4 detected, 36 missed, 1 false positive

Microsoft's SDL (Security Development Lifecycle) plugin found all four cases in the XSS/eval bucket — `innerHTML`, `document.write`, `eval`, and `new Function` — but missed everything else. Its 17 rules focus narrowly on browser-side injection. (In the fixture taxonomy these four split as 2 DOM-XSS + 2 code-execution; the benchmark scores them as one XSS/eval category, so this is the full 4/4 of that bucket and nothing beyond it.)

| Category               | Microsoft SDL |
| :--------------------- | :------------ |
| XSS / eval             | 4/4 ✅        |
| Everything else (36)   | 0/36 ❌       |

📖 _Deep dive: [Microsoft SDL vs Interlace: Enterprise Security Benchmark](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)_

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

> Every cell below is read straight from the `categoryBreakdown` blocks of the two run files: the Interlace column from `golden-2026-05-29.json`, the five competitor columns from `2026-02-07.json`. SQL and NoSQL are scored as one **SQL Injection (6)** bucket here, exactly as the fixture taxonomy and line-96 table do — so the row totals reconcile to the leaderboard. If you clone the repo, these are the numbers `npm run benchmark:fn-fp` prints.

| Category                  | Interlace | SonarJS   | MS SDL   | Security | no-unsanitized | no-secrets |
| :------------------------ | :-------- | :-------- | :------- | :------- | :------------- | :--------- |
| SQL Injection (6)         | ✅ 6/6    | ❌ 0/6    | ❌ 0/6   | ❌ 0/6   | ❌ 0/6         | ❌ 0/6     |
| Command Injection (4)     | ✅ 4/4    | ✅ 4/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ❌ 0/4     |
| Path Traversal (4)        | ✅ 4/4    | ❌ 0/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ❌ 0/4     |
| Hardcoded Credentials (4) | ✅ 4/4    | ⚠️ 2/4    | ❌ 0/4   | ❌ 0/4   | ❌ 0/4         | ⚠️ 2/4     |
| JWT (3)                   | ✅ 3/3    | ⚠️ 1/3    | ❌ 0/3   | ❌ 0/3   | ❌ 0/3         | ❌ 0/3     |
| XSS / eval (4)            | ✅ 4/4    | ⚠️ 2/4    | ✅ 4/4   | ❌ 0/4   | ⚠️ 2/4         | ❌ 0/4     |
| Prototype Pollution (3)   | ✅ 3/3    | ❌ 0/3    | ❌ 0/3   | ❌ 0/3   | ❌ 0/3         | ❌ 0/3     |
| Insecure Random (2)       | ✅ 2/2    | ✅ 2/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| Weak Crypto (3)           | ✅ 3/3    | ⚠️ 2/3    | ❌ 0/3   | ❌ 0/3   | ❌ 0/3         | ❌ 0/3     |
| Timing Attacks (2)        | ✅ 2/2    | ❌ 0/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| SSRF (2)                  | ✅ 2/2    | ❌ 0/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| Open Redirect (1)         | ✅ 1/1    | ❌ 0/1    | ❌ 0/1   | ❌ 0/1   | ❌ 0/1         | ❌ 0/1     |
| ReDoS (2)                 | ✅ 2/2    | ⚠️ 1/2    | ❌ 0/2   | ❌ 0/2   | ❌ 0/2         | ❌ 0/2     |
| **TOTAL**                 | **40/40** | **14/40** | **4/40** | **0/40** | **2/40**       | **2/40**   |

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

## The detection gap is about to get much worse

Two years ago, the 40 patterns in this suite entered codebases at human typing speed — one developer, one risky line, occasionally. That constraint is gone. Your team now generates code with an LLM, and the model reproduces these exact patterns at machine speed, with the confidence of well-formatted, type-correct output.

This isn't speculation; I measured it. In a separate experiment I asked Claude (Haiku through Opus) to write 80 common Node.js functions with no security context — **65–75% shipped with a vulnerability**, and the rate was statistically consistent across every model size. The categories were the same OWASP families this benchmark scores: string-concatenated SQL, `child_process` with shell, unbounded regex, weak crypto. ([I Let Claude Write 80 Functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).)

And before you assume this is one vendor's problem, it isn't. I ran the same security scoring across **700 functions from 5 models — three Claude tiers and two Gemini tiers** — and every one of them shipped vulnerable code at a 49–73% rate. They just fail in different places: Claude Opus generated vulnerable JWT code in **7 out of 7** runs, while Gemini Flash got the exact same prompt **perfect 7 out of 7** — and on other domains that ranking flips. There is no "safe model" you can switch to; the leaderboard you'd pick from is itself misleading ([We Ranked 5 AI Models by Security — the leaderboard is wrong](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), with the per-domain breakdown in [Aggregate Benchmarks Lie](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)). The benchmark below doesn't care which model wrote the line — it scores the line. That model-independence is the whole point: a deterministic rule is the one part of this pipeline that doesn't have a bad day.

The model output is the new attack surface, and it walks straight past the human review that used to be the last line of defense — because it _looks_ senior. I gave Claude one prompt for a NestJS users service and got 200 lines that TypeScript compiled clean; a specialized linter found **6 security holes in 3 seconds** ([the full breakdown](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)). And asking the model to _fix_ its own findings without deterministic feedback made it worse: it introduced brand-new vulnerability categories at **4× the rate** — what I call [the AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more): cut one head, two grow back.

The takeaway for this benchmark: a plugin that detects 0% or 35% of these patterns was already a liability. Pointed at AI-generated code that reintroduces the same patterns by the hundred, it's a rubber stamp on a vulnerability factory. The deterministic 100%-recall, 0%-FP layer is what gives the model an objective signal to converge against — and it's the same `npm run benchmark:fn-fp` command below, which you can rerun against your own AI's output, not just mine.

If you've read this far, close the gap in your own repo before you forget — two commands:

```bash
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-browser-security
npx eslint .   # against your last AI-generated PR, ideally
```

(Full flat-config block and the per-domain plugins are in [Migrate in 60 Seconds](#migrate-in-60-seconds) below.)

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

There are two honest install paths here, and I'm labeling them so the command you paste matches the number you expect.

**Starter (3 plugins) — the fast 80%, not the headline 100%.** This is the same block from the AI section above. It covers the highest-traffic categories (core OWASP, Node sinks, browser XSS) and is the right first move on most repos:

```bash
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-browser-security
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

**Full fleet (10 plugins) — this is what reproduces the 40/40.** The headline number is the whole fleet running together, with `eslint-plugin-node-security` pinned to **≥ 4.2.0** (the version with `no-math-random-crypto` that closed the last two randomness cases — see [the 77.5%→100% section](#how-interlace-got-from-775-to-100)). Three plugins alone do **not** get you to 100%; SQL, JWT, NoSQL, SSRF, and the framework-specific checks live in the other seven:

```bash
npm install -D \
  eslint-plugin-secure-coding \
  "eslint-plugin-node-security@>=4.2.0" \
  eslint-plugin-browser-security \
  eslint-plugin-pg \
  eslint-plugin-jwt \
  eslint-plugin-mongodb-security \
  eslint-plugin-vercel-ai-security \
  eslint-plugin-lambda-security \
  eslint-plugin-express-security \
  eslint-plugin-nestjs-security
```

```javascript
// eslint.config.js — the full 10-plugin fleet that scores 40/40
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import browserSecurity from "eslint-plugin-browser-security";
import pg from "eslint-plugin-pg";
import jwt from "eslint-plugin-jwt";
import mongodbSecurity from "eslint-plugin-mongodb-security";
import vercelAiSecurity from "eslint-plugin-vercel-ai-security";
import lambdaSecurity from "eslint-plugin-lambda-security";
import expressSecurity from "eslint-plugin-express-security";
import nestjsSecurity from "eslint-plugin-nestjs-security";

export default [
  secureCoding.configs.recommended,
  nodeSecurity.configs.recommended, // pin >=4.2.0 for the 2 randomness cases
  browserSecurity.configs.recommended,
  pg.configs.recommended,
  jwt.configs.recommended,
  mongodbSecurity.configs.recommended,
  vercelAiSecurity.configs.recommended,
  lambdaSecurity.configs.recommended,
  expressSecurity.configs.recommended,
  nestjsSecurity.configs.recommended,
];
```

Run ESLint. See what you've been missing.

---

## Related deep dives in this series

This article is the ecosystem overview. For the head-to-head per-plugin comparisons:

- [SonarJS vs Interlace: 269 Rules Still Miss 65% of Vulnerabilities](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace)
- [Microsoft SDL vs Interlace: Enterprise Security Benchmark](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)
- [eslint-plugin-security Is Unmaintained — Here's What Nobody Tells You](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)
- [The Methodology: How the FN/FP Benchmark Is Built](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark)

And for why this benchmark matters more every quarter — the AI angle:

- [I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
- [Claude Wrote a NestJS Service. ESLint Found 6 Security Holes.](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
- [The AI Hydra Problem: Fix One AI Bug, Get Two More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)

---

## Explore the Full Ecosystem

> **201 security rules. 10 specialized plugins. 100% OWASP Top 10 coverage.**
>
> The Interlace ESLint Ecosystem provides comprehensive security static analysis for modern Node.js applications.
>
> [📖 Documentation](https://eslint.interlace.tools) | [⭐ GitHub](https://github.com/ofri-peretz/eslint) | [📦 NPM](https://npmjs.com/~ofriperetz)

---

## Your turn

Go check one thing right now: what ESLint version is your `eslint-plugin-security` running against, and when did you last confirm it actually fires? On ESLint 9 with flat config, there's a real chance the answer is "it's been a green checkmark over nothing for months."

Then one question for the comments — the one story I most want to read:

**Has anyone here lived the silent-failure version? A security linter that went dark in a routine dependency bump — one Renovate PR, one approval, one Friday merge — and nobody noticed until something shipped or broke?** That's the failure this whole benchmark exists to catch, and the "we had a security linter the entire time" stories are the ones the rest of us learn the most from. Tell me how yours went dark, and how you found out.

---

**Build Securely.**

I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=benchmark-17-plugins) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
