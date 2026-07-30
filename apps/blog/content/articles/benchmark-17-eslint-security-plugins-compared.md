---
title: "The #1 ESLint Security Plugin Just Got Fixed. It Still Catches 0 of 6 SQL Injections."
description: "I ran 40 real-world vulnerable patterns through 17 ESLint plugins — eslint-plugin-security, SonarJS, Microsoft SDL. The old pinned version crashes on ESLint 9; the current one doesn't crash but still misses SQL injection entirely. Most others miss 60–100%. Here's the reproducible benchmark, re-verified against the current version of every plugin."
slug: "benchmark-17-eslint-security-plugins-compared"
canonical_url: "https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83"
devto_id: 3241881
published_at: "2026-05-25T14:27:23Z"
edited_at: "2026-05-25T14:27:23Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/benchmark-17-eslint-security-plugins-compared.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/benchmark-17-eslint-security-plugins-compared-og.jpg"
reading_time_minutes: 12
tags:
  - "security"
  - "eslint"
  - "devsecops"
  - "javascript"
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

1.5 million weekly downloads go to `eslint-plugin-security`. The version most teams have pinned (2.1.1, from 2024) crashes outright on ESLint 9's flat config and catches **0 of 40** real vulnerabilities. I re-verified against the current version (4.0.1, released three weeks ago) before publishing this: it no longer crashes, but it still only catches **11 of 40** — and 0 of 6 SQL injection cases, the category most teams assume "a security linter" exists to cover. I benchmarked it, and 16 other plugins, against 40 real vulnerabilities to find out who actually fires. Only one plugin set caught all 40.

**Full disclosure:** that plugin set is mine. I built the Interlace ESLint Ecosystem. I also built the benchmark suite and ran every test. That's the conflict of interest — I'm naming it here, in paragraph two, because a senior engineer will spot it by row 1 of the leaderboard anyway, and finding it late feels like bad faith. The methodology is open-source, the failing runs are in the same repo as the passing ones, and every number is [reproducible](https://ofriperetz.dev/articles/reproducibility-vs-replicability). Judge it on that, not on who wrote it. The full process behind that last sentence — including the runtime bug it caught in this exact benchmark before publication — is in [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat)

**The most alarming finding:** The median plugin in this benchmark detected under 10% of vulnerability patterns. SonarJS — the best-performing competitor with 3M+ weekly downloads and 269 rules — caught **0 of 6 SQL injection cases**. Zero. The category most teams assume a "security" linter covers is a complete blind spot for every single plugin except Interlace.

_Series: [The Methodology](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) ← **you are here: the ecosystem overview** → [SonarJS vs Interlace](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace) · [Microsoft SDL vs Interlace](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)_

> **Skip to:** [The leaderboard](#the-leaderboard) · [Re-verified current versions](#a-note-on-versions-i-re-ran-this-before-publishing) · [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100) · [Category-by-category breakdown](#category-by-category-breakdown) · [Migrate in 60 seconds](#migrate-in-60-seconds)

## TL;DR

I built a benchmark suite with **40 vulnerable code patterns** across 14 [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) categories (17 distinct CWE IDs, scored as 13 buckets — SQL and NoSQL injection merge into one) and **38 verified-safe patterns**. Then I ran **17 ESLint plugins** against them — every major security, quality, and framework plugin in the ecosystem.

**One plugin set achieved a perfect score. Most others detected under 50% of patterns.**

> **Benchmark provenance — read this once before the table.** The 16 competitor rows are a single Feb-2026 snapshot (`results/fn-fp-comparison/2026-02-07.json`). The Interlace row is a later golden verification run (`golden-2026-05-29.json`), after the rule work described in [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100). These are **not the same execution**: in the Feb snapshot, on older plugin versions, Interlace scored 31/40 with 9 FPs (F1 77.5%) — that earlier row is shown explicitly in the journey section. Both runs share the same 40-fixture suite, ESLint 9.39.2, and macOS arm64. Node.js version (v20.19.5 vs v24.12.0) does not affect ESLint rule execution; the same rules fire on both.

| Rank | Plugin                                 | Rules | TP        | FP    | F1 Score   |
| :--- | :------------------------------------- | :---- | :-------- | :---- | :--------- |
| 🥇   | **Interlace Ecosystem (10 plugins) ‡** | 201   | **40/40** | **0** | **100.0%** |
| 🥈   | eslint-plugin-unicorn †                | 144   | 22/40     | 23    | 51.8%      |
| 🥉   | eslint-plugin-security ††              | 13    | 11/40     | 8     | 37.3%      |
| 4    | eslint-plugin-sonarjs ‡‡               | 269   | 10/40     | 5     | 36.4%      |
| 5    | @microsoft/eslint-plugin-sdl           | 17    | 4/40      | 1     | 17.8%      |

> † `eslint-plugin-unicorn` is a general-purpose code-style plugin. Its 22 detections are **incidental** — security fixtures happen to trigger style rules like `unicorn/no-process-exit`, `unicorn/prefer-module`, and `unicorn/no-static-only-class`. It ships 23 false positives alongside those 22 TPs (a nearly 1:1 noise ratio), making it unusable as a security tool. It ranks #3 in raw TPs only because it has 144 opinionated rules that fire broadly. See [Non-Security Plugins](#the-non-security-plugins-confirmed-gaps) for the full table.
>
> †† `eslint-plugin-security@2.1.1` (what `^2.1.0` in most lockfiles still resolves to) crashes on ESLint 9.39.2 with `TypeError: context.getScope is not a function`, so the bench records 0 detections on the standard test environment. On ESLint 8.57.0 the same 2.1.1 detects 11/40 (recall 27.5%) but with an equal number of false positives (a 1:1 TP:FP ratio). The current release, 4.0.1 (published 2026-06-12), fixes the crash — re-benchmarked below at 11/40, F1 37.3%, still 0/6 on SQL injection. See [the re-verification](#a-note-on-versions-i-re-ran-this-before-publishing) below.
>
> ‡‡ `eslint-plugin-sonarjs` is shown at its current release (4.1.0, 2026-06-18), not the 3.0.6 originally benchmarked. Re-running before publishing surfaced a real regression, not an improvement: 10/40 vs. the older version's 14/40. The specific loss is Command Injection, 4/4 → 0/4 — see [the re-verification](#a-note-on-versions-i-re-ran-this-before-publishing) for the full category breakdown.
> ‡ The Interlace row is the golden verification run (Node v24.12.0, 2026-05-29), not the Feb snapshot. On the Feb snapshot's plugin versions Interlace scored 31/40 / 9 FP / F1 77.5% — that earlier row is shown in full under [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100). The "201 rules" count is the combined fleet of 10 plugins (see [The plugins behind "Interlace Ecosystem"](#the-plugins-behind-interlace-ecosystem)); "Interlace Ecosystem" is a leaderboard meta-label, **not** an installable npm package.

The incumbent security plugin — `eslint-plugin-security`, with 1.5M+ weekly downloads — has actually shipped four releases since the version most lockfiles still have pinned: 3.0.0 and 3.0.1 in 2024, then 4.0.0 and 4.0.1 in 2026. The crash is real for 2.1.1. It is not the current state of the package.

### A note on versions — I re-ran this before publishing

I caught this the same way I'd want a reader to: by running `npm view eslint-plugin-security versions` instead of trusting a version number I'd pinned months earlier. Four releases existed that this benchmark hadn't tested. So I re-ran it, against the actual current release, before publishing this paragraph:

```bash
npm view eslint-plugin-security versions
# 2.1.1 (2024-02) → 3.0.0, 3.0.1 (2024) → 4.0.0, 4.0.1 (2026, current)
```

**`eslint-plugin-security@4.0.1` does not crash on ESLint 9.39.2.** Re-benchmarked against the same 40 fixtures: **11/40 detected, 8 false positives, F1 37.3%** (`results/fn-fp-comparison/2026-07-05.json` in the repo). It's not the "0/40, broken" story the crash made it look like — and it's also not coverage. Per category: it catches Path Traversal (4/4) and ReDoS (2/2) completely, gets partial credit on Command Injection (2/4) and Prototype Pollution (2/3), catches one of four XSS cases, and misses SQL Injection, Hardcoded Credentials, JWT, Insecure Randomness, Weak Cryptography, Timing Attacks, SSRF, and Open Redirect entirely — 0 out of 23 cases across those eight categories.

The crash made a good villain. The truth is less dramatic and more useful: a maintained, non-crashing, 1.5M-download security plugin still doesn't check whether your SQL query is built with string concatenation. That's the finding that survives someone actually updating their dependency.

I checked the other competitors the same way before publishing, not just the one with the dramatic crash story:

- **`eslint-plugin-sonarjs`** — 3.0.6 tested, 4.1.0 current. Re-benchmarked at 4.1.0: **10/40, F1 36.4%**, down from v3.0.6's 14/40 (35.0% recall). This is a regression, not an improvement — the specific loss is **Command Injection, 4/4 → 0/4**. Everything else scored identically (SQL 0/6, Path Traversal 0/4, Hardcoded Credentials 2/4, JWT 1/3, XSS 2/4, Prototype Pollution 0/3, Insecure Randomness 2/2, Weak Crypto 2/3, Timing 0/2, SSRF 0/2, Open Redirect 0/1, ReDoS 1/2). I don't know why the newer release lost command-injection detection — that's a question for SonarJS's changelog, not something I can explain from the outside, and it's exactly the kind of finding a "current version" claim needs to be prepared to report even when it's not the story I expected to publish.
- **`eslint-plugin-unicorn`** — 62.0.0 tested. The real current version depends on how you define "current": 66.0.0+ requires ESLint ≥10.4, which this benchmark's ESLint 9.39.2 environment can't run at all. The highest version still compatible with ESLint 9 is 65.0.0. Re-benchmarked at 65.0.0 (Node v24.12.0, measured 2026-07-05): **22/40, F1 51.8%** — identical to the 62.0.0 numbers already in this article. No correction needed here; the version gap turned out not to matter for this one.
- **`@microsoft/eslint-plugin-sdl`** — 1.1.0 tested, and 1.1.0 is still current (last published 2025-02-18). Nothing to re-verify.

That last check is worth naming as a habit, not a one-off: I nearly published a false "0/40" for unicorn myself, because my first re-run used a stale local Node version and the plugin's newer build silently produces zero output under an unsupported runtime instead of erroring. A "current version" claim is only as good as the environment it's re-verified in — I re-ran every number in this section twice, once to catch the version gap and once to catch that I'd introduced a new one. The full forensic of that near-miss — why a clean-looking zero is the number you should trust least — lives in [Bias in measurement](https://ofriperetz.dev/articles/bias-in-measurement).

---

## Why This Matters

Most Node.js teams rely on a security linter they've never benchmarked. They install `eslint-plugin-security` or enable SonarJS security rules and assume they're covered.

They're not.

The data shows a **massive detection gap** across the entire ecosystem. Plugins that claim security coverage miss 60–100% of standard vulnerability patterns. And some of the highest-downloaded plugins aren't security tools at all — they detected zero issues from our suite.

### Where SonarJS wins — and when you'd choose it

SonarJS is still a credible competitor, but the current release (4.1.0) has a narrower case than the version most benchmarks would cite: **Insecure Randomness (2/2)** is its one clean category, with partial credit on Hardcoded Credentials (2/4), Weak Cryptography (2/3), XSS (2/4), and JWT (1/3). It also has 269 rules covering a wider range of code quality issues beyond security — if you need a single plugin for code quality _and_ some security coverage, SonarJS is still a reasonable pragmatic choice, just not for command injection specifically anymore.

Where SonarJS falls short: SQL injection (0/6), path traversal (0/4), prototype pollution (0/3), timing attacks (0/2), SSRF (0/2), open redirect (0/1), and — new in this version — **command injection (0/4, down from 4/4 in 3.0.6)**. If your stack touches a database, a filesystem, user-controlled URLs, or shell commands, SonarJS's 25% [recall](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) on the current release (v4.1.0 — down from 14/40 = 35.0% on v3.0.6) leaves you blind in the categories that matter most.

### Why this survives code review

Here's the part that should make you uncomfortable: the _name_ of a security plugin in your config is evidence to a reviewer. When `eslint-plugin-security` is listed in `eslint.config.js`, the pull request reads as covered — the reviewer sees "security linter: present" and approves. Nobody re-reads the SQL string concatenation, because the tooling is supposed to have looked at it. But on ESLint 9 the plugin's rules crash (see the `context.getScope` error above) and contribute **zero** detections; the config still claims coverage it can no longer deliver.

I've watched this exact failure on real teams, and I watched it happen to my own tooling before I fixed it — that's not a hedge, it's the Feb-2026 baseline two sections below. Interlace's own config said "100% coverage" while actually scoring 77.5%, with a 1:1 false-positive ratio on top of that. I didn't catch it from a dashboard; I caught it because I re-ran the fixture suite and the number that came back wasn't the number I expected. That's the entire failure mode this section describes, and I was on the wrong side of it first. The linter isn't lying on purpose — it's a tool that got pinned and never re-benchmarked across a change. The config still _says_ covered. The coverage left months ago. The _appearance_ of a security gate became a false sense of security, which is worse than no linter at all, because no linter at least keeps a human paranoid.

Here's the precise moment it goes dark, and why nobody notices: someone bumps ESLint 8 → 9 in a Renovate PR. From that version on, the plugin's rules hit `context.getScope is not a function` and stop producing findings — the security checks that used to flag a [tainted](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) query now report nothing. The PR title says "chore(deps): bump eslint." It gets one approval and merges on a Friday. From that commit forward, every SQL-concatenation and `child_process` call your security linter used to catch sails through, and the only evidence is a plugin name in a config file that no longer does anything. I have never once seen that PR get a security review — it's a dependency bump, who reviews those for coverage regressions? **A security rule that silently stops firing isn't a weaker control than no rule; it's a worse one, because it's also a lie your reviewers believe.**

The same cognitive failure applies to SonarJS users, just more subtly. SonarJS fires on real things — weak randomness, some hardcoded credentials — so developers see real alerts. That activity creates an implicit sense of coverage. Nobody checks whether SQL injection is in the detected set because the linter is clearly doing _something_. The gap stays invisible until something ships. It got quieter still on the current release: teams that upgraded SonarJS expecting their command-injection coverage to carry forward lost it silently — no error, no changelog headline, just a rule that used to fire and doesn't anymore.

And upgrading `eslint-plugin-security` doesn't close this one. The current release fixes the crash, so the config's claim of coverage stops being a lie — but SQL injection is still 0/6 on the version that isn't broken. The false sense of security just moves from "the linter stopped firing" to "the linter is firing on other things." Same blind spot, quieter alarm.

This benchmark exists because "we run a security linter" and "we measured what our security linter catches" are different claims, and only one of them is checkable.

---

## Methodology

The benchmark suite, in full — environment, corpus, and scoring. (The design rationale behind the suite is its own article: [the FP-tax methodology piece](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark).)

### Test Environment

This table is pinned to the run that produced the headline `40/40, 0 FP` figure (`golden-2026-05-29.json`, `verified` field). The Feb competitor snapshot ran on the same ESLint/platform but Node v20.19.5; the headline run used Node v24.12.0. Node.js version does not affect ESLint rule execution — both Node versions produce identical rule firings on these fixtures.

| Component    | Version              |
| :----------- | :------------------- |
| **Node.js**  | v24.12.0             |
| **ESLint**   | 9.39.2               |
| **Platform** | macOS (darwin/arm64) |
| **Date**     | May 29, 2026         |

### Vulnerable Patterns (40 cases, 14 CWE categories)

> Category labels and counts below mirror the `categoryBreakdown` in `golden-2026-05-29.json` exactly, so a reader cloning the repo sees identical buckets. SQL and NoSQL injection are scored together as one **SQL Injection (6)** bucket (4 relational + 2 document-store, CWE-89/CWE-943); the fixture taxonomy does not split them — which is why the corpus's 14 CWE categories (17 distinct CWE IDs) render as 13 rows here.

| Category                | Cases | CWEs             | Real-World Impact              |
| :---------------------- | :---- | :--------------- | :----------------------------- |
| SQL Injection (+ NoSQL) | 6     | CWE-89, CWE-943  | Data exfiltration, auth bypass |
| Command Injection       | 4     | CWE-78           | Remote code execution          |
| Path Traversal          | 4     | CWE-22           | Arbitrary file read/write      |
| Hardcoded Credentials   | 4     | CWE-798          | Account takeover               |
| JWT Vulnerabilities     | 3     | CWE-757, CWE-347 | Auth bypass                    |
| XSS / Code Execution    | 4     | CWE-79, CWE-94   | Session hijack, RCE            |
| Prototype Pollution     | 3     | CWE-1321         | DoS, property injection        |
| Insecure Randomness     | 2     | CWE-330          | Predictable tokens             |
| Weak Cryptography       | 3     | CWE-328, CWE-327 | Credential exposure            |
| Timing Attacks          | 2     | CWE-208          | Secret extraction              |
| SSRF                    | 2     | CWE-918          | Internal network access        |
| Open Redirect           | 1     | CWE-601          | Phishing                       |
| ReDoS                   | 2     | CWE-1333         | Denial of service              |

> **One CWE note before a pedant beats me to it:** the fixtures tag the JWT cases with **CWE-757** (algorithm downgrade — what the rule's diagnostic prints, so the table matches the repo). For the specific `alg:none` case (`vuln_jwt_alg_none`), the more precise mapping is **CWE-347 (Improper Verification of Cryptographic Signature)**, since accepting `none` skips signature verification entirely. Both CWEs are listed above on purpose; the detection is identical either way.

### What these patterns actually look like

The category table above is abstract until you see the code. Three fixtures from the suite — the exact pattern, the exact fix:

**`vuln_sql_string_concat` (CWE-89) — one of the 6 SQL/NoSQL cases every competitor except Interlace missed:**

```javascript
// vulnerable — string concatenation, not a template literal, which is why the
// template-literal-only version of this rule missed it in the Feb-2026 baseline
const user = await db.query("SELECT * FROM users WHERE id = " + req.params.id);

// fixed — parameterized query, identical behavior
const user = await db.query("SELECT * FROM users WHERE id = $1", [
  req.params.id,
]);
```

**`vuln_nosql_mongo` (CWE-943) — the same bug in a shape "SQL injection" rules don't recognize:**

```javascript
// vulnerable — req.body.filter can carry a $where or $ne operator
const results = await User.find(req.body.filter);

// fixed — the query shape is fixed; user input can only fill a value, never an operator
const results = await User.find({ email: req.body.email });
```

**`vuln_ssrf_fetch` (CWE-918) — a category zero competitors detected:**

```javascript
// vulnerable — fetches whatever URL the request body names
const preview = await fetch(req.body.url);

// fixed — resolve and check the host against an allowlist before fetching
const url = new URL(req.body.url);
if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error("host not allowed");
const preview = await fetch(url);
```

All three of these are fixtures that Interlace itself missed in the Feb-2026 baseline (see [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100)) — the rule backlog that closed them is the same one being scored here. Forty fixtures built the same way — one vulnerable pattern each, annotated with CWE and expected detection — are what `npm run benchmark:fn-fp` runs against every plugin in the leaderboard above.

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

Any warnings on these patterns are **[false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn)** — noise that creates alert fatigue and trains developers to ignore real issues.

### How scoring works

Each fixture is a minimal, self-contained JavaScript file containing exactly one vulnerable pattern (for the 40 vulnerable cases) or one secure pattern (for the 38 safe cases). Running `npm run benchmark:fn-fp` applies all plugin rules to all fixtures and drops every outcome into a standard confusion-matrix cell — fire on vulnerable is a TP, fire on safe is a FP, silence on vulnerable is a FN (the cell-by-cell mechanics live in the canonical linked above, not here).

Partial credit is not given: a rule that detects 3 of 6 SQL injection variants scores 3 TPs, not 6. The benchmark does not weight categories by severity — a SQL injection miss and a ReDoS miss both count equally. The full fixture set is in the open-source repo; a reader can add their own patterns and rerun.

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install
npm run benchmark:fn-fp
```

---

## The Results

### The Leaderboard

> Plugin download counts cited throughout this article are weekly figures snapshotted on 2026-02-08 from [npm-stat.com](https://npm-stat.com).
>
> **Row provenance:** rows 2–16 (every competitor) are the Feb-2026 snapshot run (`2026-02-07.json`). The Interlace row (🥇) is the later golden verification run (`golden-2026-05-29.json`), with the fleet pinned to `eslint-plugin-node-security` ≥ 4.2.0 — the version that closed the last gaps (see [the 77.5%→100% section](#how-interlace-got-from-775-to-100)). In the Feb snapshot, on the older plugin versions, Interlace scored **31/40 with 9 FPs (F1 77.5%)**; that row is shown explicitly in the journey section rather than buried. The two runs share the same 40-fixture suite, ESLint 9.39.2, and macOS arm64.

| Rank | Plugin                                 | Version             | Rules | TP     | FP    | FN    | Precision  | Recall     | F1         |
| :--- | :------------------------------------- | :------------------ | :---- | :----- | :---- | :---- | :--------- | :--------- | :--------- |
| 🥇   | **Interlace Ecosystem (10 plugins) ‡** | node-security 4.2.0 | 201   | **40** | **0** | **0** | **100.0%** | **100.0%** | **100.0%** |
| 🥈   | eslint-plugin-unicorn †                | 65.0.0              | 144   | 22     | 23    | 18    | 48.9%      | 55.0%      | 51.8%      |
| 🥉   | eslint-plugin-security ††              | 4.0.1               | 13    | 11     | 8     | 29    | 57.9%      | 27.5%      | 37.3%      |
| 4    | eslint-plugin-sonarjs ‡‡               | 4.1.0               | 269   | 10     | 5     | 30    | 66.7%      | 25.0%      | 36.4%      |
| 5    | @microsoft/eslint-plugin-sdl           | 1.1.0               | 17    | 4      | 1     | 36    | 80.0%      | 10.0%      | 17.8%      |
| 6    | eslint-plugin-no-secrets               | 2.2.1               | 2     | 2      | 0     | 38    | 100.0%     | 5.0%       | 9.5%       |
| 7    | eslint-plugin-no-unsanitized           | 4.1.4               | 2     | 2      | 1     | 38    | 66.7%      | 5.0%       | 9.3%       |
| 8    | eslint-plugin-n                        | 17.23.2             | 41    | 2      | 3     | 38    | 40.0%      | 5.0%       | 8.9%       |
| 9    | eslint-plugin-regexp                   | 3.0.0               | 78    | 1      | 2     | 39    | 33.3%      | 2.5%       | 4.7%       |
| 10   | eslint-plugin-react                    | 7.37.5              | 103   | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 11   | eslint-plugin-jsx-a11y                 | 6.10.2              | 39    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 12   | eslint-plugin-import                   | 2.32.0              | 44    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 13   | eslint-plugin-promise                  | 7.2.1               | 13    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 14   | eslint-plugin-jest                     | 29.12.2             | 71    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 15   | eslint-plugin-vue                      | 10.7.0              | 250   | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |
| 16   | @angular-eslint/eslint-plugin          | 21.2.0              | 48    | 0      | 0     | 40    | —          | 0.0%       | 0.0%       |

> † `eslint-plugin-unicorn` ranks #3 in raw TPs because its 144 opinionated style rules incidentally overlap with security fixtures (e.g., `unicorn/no-process-exit`, `unicorn/prefer-module`, `unicorn/no-static-only-class`). These are not security detections — they are style violations that happen to co-occur with vulnerable patterns. Its 23 FPs (firing on safe code) confirm this: a 1:1 TP:FP ratio is alert fatigue, not security coverage.
>
> ‡ The Interlace row is the golden verification run (Node v24.12.0, 2026-05-29), not the Feb snapshot. On the Feb snapshot's plugin versions Interlace scored 31/40 / 9 FP / F1 77.5% — that earlier row is shown in full under [How Interlace got from 77.5% to 100%](#how-interlace-got-from-775-to-100). The "201 rules" count is the combined fleet of 10 plugins (see [The plugins behind "Interlace Ecosystem"](#the-plugins-behind-interlace-ecosystem)); "Interlace Ecosystem" is a leaderboard meta-label, **not** an installable npm package.
>
> **Note:** `eslint-plugin-jsdoc` (38 TP / 37 FP / F1=66.1%) was excluded from the leaderboard. Its detections are incidental — it flags every function missing JSDoc, not security issues. A 97.4% false positive rate is unusable for security.

### Visual Detection Rates

```text
Vulnerable Code Detections (out of 40 patterns):

Interlace Ecosystem:       ████████████████████████████████████████  40 (100%)
eslint-plugin-unicorn:     ██████████████████████░░░░░░░░░░░░░░░░░░  22 (55%)
eslint-plugin-security:    ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11 (27.5%, current v4.0.1 — 0% on v2.1.1, crashed)
eslint-plugin-sonarjs:     ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  10 (25%, current v4.1.0 — was 14/40 on v3.0.6)
@microsoft/eslint-plugin:  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4 (10%)
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

Three honest caveats so nobody is surprised:

- **Pin the version.** On `eslint-plugin-node-security` &lt; 4.2.0 the two randomness cases are still missed, so the fleet scores 38/40. The headline requires ≥ 4.2.0.
- **Run the fleet, not one plugin.** A single plugin in isolation covers only its domain — a spot-run of `node-security` alone against all 40 fixtures lands around 27% (7/40), because it was never meant to catch SQL or JWT or XSS on its own. The 100% is the 10 plugins running together, which is how the [config block](#migrate-in-60-seconds) wires them.
- **A perfect score is also a ceiling.** 40/40 on a fixed corpus means the suite is saturated — from here it can only detect regressions, not the next improvement. That's a corpus-lifecycle problem, not a victory lap; [how a ground-truth corpus gets designed, and retired](https://ofriperetz.dev/articles/how-to-design-a-ground-truth-corpus) covers what happens next.

That's the difference between a benchmark you can trust and a screenshot you can't reproduce: the failing run is in the same folder as the passing one.

**The fixture-tuning question, answered directly, not implied.** I built the winning plugin and designed the fixtures, so the obvious objection is: did the 40 patterns get chosen because Interlace already caught them? The evidence I can actually point to: the Feb 77.5% and May 100% runs scored the **same 40 fixture files** — nothing in that suite changed between them. What changed is 76 lines of rule code closing 9 named misses. If the fixtures had been tuned to the rules, the Feb baseline wouldn't have had 9 misses to begin with — a rigged test doesn't fail its own designer 22.5% of the time. That's evidence the fixtures constrained the rules, not the reverse. I'm one person, not a lab — I can't hand you a third-party audit, and I'm not going to pretend that's coming. What I can hand you is the actual repo: clone it, read the fixture files yourself, write your own 41st pattern, and see if it survives. That's not a weaker claim than an audit — it's a different one, and it's the one actually available to you right now:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite && npm install
# add your own fixture to benchmarks/fn-fp-comparison/fixtures/, then:
npm run benchmark:fn-fp
```

If you run this and get a different number, I want to hear about it — that's the actual mechanism for catching a rigged benchmark, not a credential.

---

## The Security Plugins: Deep Dive

### eslint-plugin-security (1.5M+ weekly downloads) — FIXED, STILL INCOMPLETE

**F1 Score: 37.3%** (current, v4.0.1) | **F1 Score: 0%** (v2.1.1, what most lockfiles still pin)

If you have `^2.1.0` in your `package.json`, you have the crashing version. It fails on ESLint 9 with:

```text
TypeError: context.getScope is not a function
Rule: "security/detect-child-process"
```

That's due to the deprecated `context.getScope()` API removed in ESLint 9. **If your lockfile is still on 2.1.1, this plugin provides zero security coverage under flat config — check now, don't wait for this article to convince you.**

Upgrade to the current release (4.0.1) and the crash goes away. Coverage doesn't fully come back with it:

| Category              | 4.0.1  | What It Still Misses                              |
| :-------------------- | :----- | :------------------------------------------------ |
| Path Traversal        | 4/4 ✅ | —                                                 |
| ReDoS                 | 2/2 ✅ | —                                                 |
| Prototype Pollution   | 2/3    | one assignment-based case                         |
| Command Injection     | 2/4    | `execSync`, `spawn` with `shell: true`            |
| XSS / eval            | 1/4    | `innerHTML`, `document.write`, `new Function`     |
| SQL + NoSQL Injection | 0/6    | ❌ All — every relational and document-store case |
| Hardcoded Credentials | 0/4    | ❌ All                                            |
| JWT                   | 0/3    | ❌ All                                            |
| Insecure Randomness   | 0/2    | ❌ All                                            |
| Weak Cryptography     | 0/3    | ❌ All                                            |
| Timing Attacks        | 0/2    | ❌ All                                            |
| SSRF                  | 0/2    | ❌ All                                            |
| Open Redirect         | 0/1    | ❌ All                                            |

Eleven of 40, with 8 false positives alongside them. The category it's most associated with by name — SQL injection — is a complete miss, current version or not.

📖 _Deep dive: [eslint-plugin-security Is Unmaintained — Here's What Nobody Tells You](https://ofriperetz.dev/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)_

### eslint-plugin-sonarjs (3M+ weekly downloads) — 25% Recall, current release

**F1 Score: 36.4%** (v4.1.0, current) | 10 detected, 30 missed, 5 false positives

Re-benchmarked against the current release before publishing — the version most comparisons would cite (3.0.6) actually scores higher (14/40, 35.0% recall) than what's on npm today:

| Category              | SonarJS (4.1.0) | What It Missed                                      |
| :-------------------- | :-------------- | :-------------------------------------------------- |
| Insecure Randomness   | 2/2 ✅          | —                                                   |
| Hardcoded Credentials | 2/4             | AWS keys, API keys                                  |
| Weak Cryptography     | 2/3             | DES                                                 |
| XSS / eval            | 2/4             | `innerHTML`, `document.write`                       |
| JWT                   | 1/3             | missing-algorithm, no-expiry (caught only alg:none) |
| ReDoS                 | 1/2             | user-supplied pattern                               |
| Command Injection     | 0/4 ❌          | **Regression — was 4/4 on v3.0.6, now 0/4**         |
| SQL + NoSQL Injection | 0/6             | ❌ All — every relational and document-store case   |
| Path Traversal        | 0/4             | ❌ All                                              |
| Prototype Pollution   | 0/3             | ❌ All                                              |
| Timing Attacks        | 0/2             | ❌ All                                              |
| SSRF                  | 0/2             | ❌ All                                              |
| Open Redirect         | 0/1             | ❌ All                                              |

The one category SonarJS still carries cleanly is Insecure Randomness. Despite having **269 rules** (the most of any plugin tested), the current release (v4.1.0) catches **10/40** (25.0% recall) — down from 14/40 (35.0%) on v3.0.6, the version originally tested — and misses 75% of vulnerabilities, including **0 of 6 SQL/NoSQL injection cases** (unchanged) and, new in this release, **0 of 4 command injection cases** it used to catch completely. Many of its rules target code quality, not security.

**When a developer would believe they're covered:** SonarJS fires on real findings. You see command injection alerts, you fix them, you feel the tool is working. The SQL injection cases that SonarJS silently misses never appear in your lint output — so you never know they're there. The linter looks active; the gap is invisible.

📖 _Deep dive: [SonarJS vs Interlace: 269 Rules, 65% Missed](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace)_

### @microsoft/eslint-plugin-sdl — 10% Recall

**F1 Score: 17.8%** | 4 detected, 36 missed, 1 false positive

Microsoft's SDL (Security Development Lifecycle) plugin found all four cases in the XSS/eval bucket — `innerHTML`, `document.write`, `eval`, and `new Function` — but missed everything else. Its 17 rules focus narrowly on browser-side injection. (In the fixture taxonomy these four split as 2 DOM-XSS + 2 code-execution; the benchmark scores them as one XSS/eval category, so this is the full 4/4 of that bucket and nothing beyond it.)

| Category             | Microsoft SDL |
| :------------------- | :------------ |
| XSS / eval           | 4/4 ✅        |
| Everything else (36) | 0/36 ❌       |

**When a developer would believe they're covered:** Microsoft SDL is often installed alongside a broader security posture ("we follow the SDL"). Its name implies enterprise-grade coverage. Engineers who see XSS alerts in their feed assume the tool is catching the important things — and SQL injection, path traversal, and SSRF never come up because the rules don't exist.

📖 _Deep dive: [Microsoft SDL vs Interlace: Enterprise Security Benchmark](https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace)_

### eslint-plugin-no-secrets — Narrow But Precise

**F1 Score: 9.5%** | 2 detected, 0 false positives

Only 2 rules, but they do their job — detecting hardcoded secrets with zero false positives. Good as a supplement, but not a security strategy.

### eslint-plugin-no-unsanitized (Mozilla) — DOM XSS Only

**F1 Score: 9.3%** | 2 detected, 1 false positive

Detects `innerHTML` and `insertAdjacentHTML` DOM sinks. Cannot recognize DOMPurify sanitization (1 FP). Useful for browser projects, but both detections sit in the XSS bucket — one category covered, twelve untouched.

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

> Every cell below is read straight from the `categoryBreakdown` blocks of the two run files: the Interlace column from `golden-2026-05-29.json`, the five competitor columns from `2026-02-07.json`. SQL and NoSQL are scored as one **SQL Injection (6)** bucket here, exactly as the fixture taxonomy and the corpus table above do — so the row totals reconcile to the leaderboard. If you clone the repo, these are the numbers `npm run benchmark:fn-fp` prints.

| Category                  | Interlace | SonarJS (4.1.0) | MS SDL   | Security (4.0.1) | no-unsanitized | no-secrets |
| :------------------------ | :-------- | :-------------- | :------- | :--------------- | :------------- | :--------- |
| SQL Injection (6)         | ✅ 6/6    | ❌ 0/6          | ❌ 0/6   | ❌ 0/6           | ❌ 0/6         | ❌ 0/6     |
| Command Injection (4)     | ✅ 4/4    | ❌ 0/4          | ❌ 0/4   | ⚠️ 2/4           | ❌ 0/4         | ❌ 0/4     |
| Path Traversal (4)        | ✅ 4/4    | ❌ 0/4          | ❌ 0/4   | ✅ 4/4           | ❌ 0/4         | ❌ 0/4     |
| Hardcoded Credentials (4) | ✅ 4/4    | ⚠️ 2/4          | ❌ 0/4   | ❌ 0/4           | ❌ 0/4         | ⚠️ 2/4     |
| JWT (3)                   | ✅ 3/3    | ⚠️ 1/3          | ❌ 0/3   | ❌ 0/3           | ❌ 0/3         | ❌ 0/3     |
| XSS / eval (4)            | ✅ 4/4    | ⚠️ 2/4          | ✅ 4/4   | ⚠️ 1/4           | ⚠️ 2/4         | ❌ 0/4     |
| Prototype Pollution (3)   | ✅ 3/3    | ❌ 0/3          | ❌ 0/3   | ⚠️ 2/3           | ❌ 0/3         | ❌ 0/3     |
| Insecure Random (2)       | ✅ 2/2    | ✅ 2/2          | ❌ 0/2   | ❌ 0/2           | ❌ 0/2         | ❌ 0/2     |
| Weak Crypto (3)           | ✅ 3/3    | ⚠️ 2/3          | ❌ 0/3   | ❌ 0/3           | ❌ 0/3         | ❌ 0/3     |
| Timing Attacks (2)        | ✅ 2/2    | ❌ 0/2          | ❌ 0/2   | ❌ 0/2           | ❌ 0/2         | ❌ 0/2     |
| SSRF (2)                  | ✅ 2/2    | ❌ 0/2          | ❌ 0/2   | ❌ 0/2           | ❌ 0/2         | ❌ 0/2     |
| Open Redirect (1)         | ✅ 1/1    | ❌ 0/1          | ❌ 0/1   | ❌ 0/1           | ❌ 0/1         | ❌ 0/1     |
| ReDoS (2)                 | ✅ 2/2    | ⚠️ 1/2          | ❌ 0/2   | ✅ 2/2           | ❌ 0/2         | ❌ 0/2     |
| **TOTAL**                 | **40/40** | **10/40**       | **4/40** | **11/40**        | **2/40**       | **2/40**   |

> `eslint-plugin-security` and `eslint-plugin-sonarjs` columns reflect their current releases (4.0.1 and 4.1.0), both re-benchmarked 2026-07-05 — see [the version note](#a-note-on-versions-i-re-ran-this-before-publishing) above. The previously pinned versions score 0/40 (2.1.1, crashes before evaluating any fixture) and 14/40 (3.0.6 — higher than the current release; the difference is a lost Command Injection detector).

### Specialization vs. one-size-fits-all

The reason Interlace achieves 100% coverage is **specialization**. Instead of one monolithic plugin trying to cover everything, the ecosystem uses 10 purpose-built plugins:

| Plugin                                                                                                                | Focus                                          | Rules |
| :-------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------- | :---- |
| `eslint-plugin-secure-coding`                                                                                         | Core OWASP patterns                            | 23    |
| `eslint-plugin-node-security`                                                                                         | fs, child_process, vm, weak crypto, randomness | 42    |
| `eslint-plugin-browser-security`                                                                                      | XSS, CORS, CSP                                 | 45    |
| `eslint-plugin-pg`                                                                                                    | SQL injection, connection safety               | 13    |
| `eslint-plugin-jwt`                                                                                                   | Algorithm confusion, token safety              | 13    |
| `eslint-plugin-mongodb-security`                                                                                      | NoSQL injection, operator injection            | 16    |
| `eslint-plugin-vercel-ai-security`                                                                                    | Prompt injection, output validation            | 19    |
| [`eslint-plugin-lambda-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-lambda-security) | IAM, cold starts, secrets                      | 14    |
| `eslint-plugin-express-security`                                                                                      | Helmet, CORS, sessions                         | 10    |
| `eslint-plugin-nestjs-security`                                                                                       | Guards, pipes, decorators                      | 6     |

> Crypto rules (weak algorithms, insecure randomness) were consolidated into `eslint-plugin-node-security` on 2026-05-10. The previously separate `eslint-plugin-crypto` package is deprecated and should not be installed.

Each plugin is maintained by domain experts and updated independently. A JWT vulnerability doesn't require updating the SQL injection rules.

---

## The detection gap is about to get much worse

Two years ago, the 40 patterns in this suite entered codebases at human typing speed — one developer, one risky line, occasionally. That constraint is gone. Your team now generates code with an LLM, and the model reproduces these exact patterns at machine speed, with the confidence of well-formatted, type-correct output.

This isn't speculation; I measured it. In a separate experiment I asked Claude (Haiku through Opus) to write common Node.js functions with no security context — **65–75% shipped with a vulnerability**, and the rate was statistically consistent across every model size. The categories were the same OWASP families this benchmark scores: string-concatenated SQL, `child_process` with shell, unbounded regex, weak crypto. ([the full breakdown](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).)

And before you assume this is one vendor's problem, it isn't. I ran the same security scoring across [**700 functions from 5 models — three Claude tiers and two Gemini tiers**](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) — and every one of them shipped vulnerable code at a 49–73% rate. They just fail in different places: Claude Opus generated vulnerable JWT code in **7 out of 7** runs, while Gemini Flash got the exact same prompt **perfect 7 out of 7** — and on other domains that ranking flips. There is no "safe model" you can switch to; the leaderboard you'd pick from is itself misleading. The benchmark doesn't care which model wrote the line — it scores the line. That model-independence is the whole point: a deterministic rule is the one part of this pipeline that doesn't have a bad day.

The model output is the new attack surface, and it walks straight past the human review that used to be the last line of defense — because it _looks_ senior. I gave Claude one prompt for a NestJS users service and got 200 lines that TypeScript compiled clean; a specialized linter found **6 security holes in 3 seconds** ([the full breakdown](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)). And asking the model to _fix_ its own findings without deterministic feedback made it worse: it introduced brand-new vulnerability categories at **4× the rate** — what I call [the AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more): cut one head, two grow back.

The takeaway for this benchmark: a plugin that detects 0% or 35% (SonarJS v3.0.6; 25.0% on the current v4.1.0) of these patterns was already a liability. Pointed at AI-generated code that reintroduces the same patterns by the hundred, it's a rubber stamp on a vulnerability factory. The deterministic 100%-recall, 0%-FP layer is what gives the model an objective signal to converge against — and it's the same `npm run benchmark:fn-fp` command below, which you can rerun against your own AI's output, not just mine.

If you've read this far, close the gap in your own repo before you forget — two commands:

```bash
npm install -D eslint-plugin-secure-coding eslint-plugin-node-security eslint-plugin-browser-security
npx eslint .   # against your last AI-generated PR, ideally
```

(Full flat-config block and the per-domain plugins are in [Migrate in 60 Seconds](#migrate-in-60-seconds) below.)

---

## Migrate in 60 Seconds

There are two honest install paths here, and I'm labeling them so the command you paste matches the number you expect.

**Starter (3 plugins) — the highest-traffic categories, not the headline 100%.** This is the same block from the AI section above. It covers core OWASP patterns, Node sinks, and browser XSS — it does **not** cover SQL/NoSQL injection, JWT, or SSRF, which live in the other seven plugins below. Treat this as "meaningfully better than the incumbent," not a specific percentage — the right first move on most repos, not the finish line:

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

**Full fleet (10 plugins) — this is what reproduces the 40/40.** The headline number is the whole fleet running together, with `eslint-plugin-node-security` pinned to **^4.2.0** (the version with `no-math-random-crypto` that closed the last two randomness cases — see [the 77.5%→100% section](#how-interlace-got-from-775-to-100)). Three plugins alone do **not** get you to 100%; SQL, JWT, NoSQL, SSRF, and the framework-specific checks live in the other seven:

```bash
npm install -D \
  eslint-plugin-secure-coding \
  "eslint-plugin-node-security@^4.2.0" \
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
  nodeSecurity.configs.recommended, // pin ^4.2.0 for the 2 randomness cases
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

And for why this benchmark matters more every quarter — the AI angle:

- [I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
- [Claude Inherited a NestJS Service. ESLint Found 6 Security Holes.](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)
- [The AI Hydra Problem: Fix One AI Bug, Get Two More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)

And the measurement foundations under the numbers — what a leaderboard rank does and doesn't tell you, and how a benchmark's own design can bias what it finds:

- [Ranking vs. measuring](https://ofriperetz.dev/articles/ranking-vs-measuring)
- [Bias in measurement](https://ofriperetz.dev/articles/bias-in-measurement)

Full plugin docs: [eslint.interlace.tools](https://eslint.interlace.tools)

---

## Your turn

Go check two things right now: what version of `eslint-plugin-security` your lockfile actually has (`npm ls eslint-plugin-security`), and whether it's still firing on ESLint 9. If you're on 2.1.1 or older, there's a real chance the answer is "it's been a green checkmark over nothing for months." If you're already on 4.0.1 — check whether it's catching SQL injection in your own repo. It isn't in this benchmark.

**Which security ESLint plugin has your team standardized on — and have you actually verified it covers the vulnerability classes in your tech stack?** The specific coverage gaps here (SQL injection blind spots in SonarJS, total crash in eslint-plugin-security) are the kind of thing that only surfaces when someone runs a benchmark. I want to know: has your team? And if you have, what did you find?

If the gap is real in your repo, [the 60-second migration above](#migrate-in-60-seconds) closes it — start with `eslint-plugin-secure-coding`. And if you'd rather keep me honest than take my word, ⭐ [star the benchmark suite](https://github.com/ofri-peretz/eslint-benchmark-suite) and send a fixture PR: every pattern you add makes the next run harder for me to pass, which is exactly the point.

**Next in the series:** the closest head-to-head — [SonarJS vs Interlace: 269 Rules Still Miss 65% of Vulnerabilities](https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace).

---

I'm Ofri Peretz, a Security Engineering Leader and the architect of the [Interlace ESLint Ecosystem](https://eslint.interlace.tools). I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=benchmark-17-plugins) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Benchmark source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
