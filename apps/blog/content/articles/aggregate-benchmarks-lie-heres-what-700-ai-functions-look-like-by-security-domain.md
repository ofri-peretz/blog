---
title: "Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain."
description: "The 'most dangerous' AI model fixes 93% of the database vulnerabilities it writes; the 'safest' fixes 45%. Same 700 functions, opposite conclusion. When I broke a 5-model security benchmark down by domain — database, auth, file I/O, command execution — the rankings inverted. Aggregate numbers hide domain expertise. Here's the per-domain data and how to gate it in CI."
slug: "aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain"
canonical_url: "https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj"
devto_id: 3688611
published_at: "2026-05-17T15:40:50Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-og.jpg?v=b2"
reading_time_minutes: 12
tags:
  - "ai"
  - "security"
  - "eslint"
  - "devsecops"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "AI Security Benchmark Series"
---

Opus 4.6 generates vulnerable authentication code 50% of the time. Then it remediates 100% of what it breaks. Haiku 4.5 generates vulnerable authentication code only 29% of the time — then remediates 38% of what it breaks. Same benchmark, opposite verdicts. The aggregate number that most people use to pick a model erases this difference entirely: Haiku "wins" at 49%, Opus "loses" at 65%, and every team that standardizes on Haiku because of that leaderboard position has just inherited Haiku's 38% authentication fix rate on every auth function it generates.

That's the lie in aggregate benchmarks. The number itself is accurate. The lie is that it flattens a two-dimensional problem (generate + remediate, across multiple domains) into a single dimension that answers the wrong question.

I ran [65-75% of AI-generated functions having security vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) past five models across 700 functions, scored every output with ESLint security rules, then fed violations back to the same model for remediation. In [Part 3](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), I ranked them by aggregate vulnerability rate and declared Haiku the safest (49%) and Gemini Pro the most dangerous (73%).

That ranking is real. It's also misleading. When I broke the same data down by security domain, the ranking didn't just shift — it inverted.

---

## TL;DR

_Part 3 of this series: [We Ranked 5 AI Models by Security](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) · **Part 4 (you are here)**_

When I broke 700 functions down by **security domain**, the rankings inverted. The model that "lost" the aggregate benchmark — Gemini 2.5 Pro, "most dangerous" at 73% — dominates the most important remediation category, fixing 93% of the database vulnerabilities it writes (93% of what my own ESLint ruleset flags, not 93% of confirmed SQL injections — I wrote the two rules driving that number, more on that below). The model that "won" the aggregate — Haiku, "safest" at 49% — has one of the lowest fix rates, at 45% on database.

> **Steal this metric:** Net security position = initial vulnerability rate × (1 − fix rate) — the share of generated functions still vulnerable after one remediation pass. It's the number that should drive model selection when you have a lint-and-fix pipeline, not the generation-only leaderboard.

### Category Champions (Lowest Vulnerability Rate)

| Domain                | Champion         | Rate                | Runner-Up     | Rate |
| --------------------- | ---------------- | ------------------- | ------------- | ---- |
| **Database**          | Haiku 4.5        | **39%**             | Opus 4.6      | 61%  |
| **Authentication**    | Haiku 4.5        | **29%**             | Sonnet 4.5    | 39%  |
| **File I/O**          | Gemini 2.5 Pro   | **86%** (least-bad) | Haiku / Opus  | 93%  |
| **Configuration**     | Gemini 2.5 Flash | **21%**             | Sonnet / Opus | 25%  |
| **Command Execution** | Haiku 4.5        | **50%**             | Sonnet 4.5    | 75%  |

### Remediation Champions (Highest Fix Rate)

| Domain                | Champion       | Fix Rate | Runner-Up    | Fix Rate |
| --------------------- | -------------- | -------- | ------------ | -------- |
| **Database**          | Gemini 2.5 Pro | **93%**  | Gemini Flash | 67%      |
| **Authentication**    | Opus 4.6       | **100%** | Gemini Pro   | 58%      |
| **File I/O**          | Opus 4.6       | **73%**  | Haiku 4.5    | 58%      |
| **Configuration**     | Flash / Opus   | **100%** | Sonnet 4.5   | 43%      |
| **Command Execution** | Opus 4.6       | **19%**  | Haiku 4.5    | 7%       |

No single model wins everywhere. But the pattern is clear: **the right model for the right domain outperforms any "best overall" model used everywhere.**

**Skip to:** [The Domain Breakdown](#the-five-security-domains) | [Remediation by Domain](#the-remediation-story-per-domain) | [Net Security Position](#net-security-the-metric-that-actually-matters) | [The Practical Framework](#the-practical-framework) | [Reproduce This](#reproducing-this-research)

**Disclosure, upfront:** the linter grading every model in this benchmark is my own product — the ESLint security plugins linked throughout this piece. Read every "vulnerable" and "fixed" number as "what my ruleset flags," not an independent third-party verdict. Where a specific rule is hardening/best-practice rather than a true injection sink (I call this out explicitly for `pg/no-select-all`), I say so at the point the number appears, not just in the limitations section.

---

## Why Aggregates Fail

Aggregate security benchmarks fail because they average a model's best-in-class and worst-in-class domains into one number that represents neither — a model can be safest overall and worst-in-class on the one domain your codebase actually runs. Here's the aggregate ranking this article is reanalyzing, from Part 3:

```text
1. Haiku 4.5:     49%  ← "safest"
2. Sonnet 4.5:    62%
3. Gemini Flash:  64%
4. Opus 4.6:      65%
5. Gemini Pro:    73%  ← "most dangerous"
```

This is the equivalent of saying "Hospital A has the best patient outcomes" without checking whether it's a cardiac center or a dermatology clinic. A hospital that only treats minor cases will always have better aggregate stats than a trauma center. It's the same shape as [Simpson's paradox](https://en.wikipedia.org/wiki/Simpson%27s_paradox) — a trend that holds in the aggregate reverses once you split the data into the groups that actually matter. Once you name it, it's a test you can run on any vendor's leaderboard, not just this one: ask for the per-segment breakdown before trusting the average.

AI models work the same way. Haiku generates simple, minimal implementations. Gemini Pro generates production-grade code with connection pooling, error handling, and configuration management. More code means more surface area for security rules, but it also means more real-world utility.

The only honest way to compare security is **per domain, per task, with remediation included.**

The uncomfortable per-domain rates this aggregate erases:

- **Authentication functions:** Haiku 29% vulnerable, Opus 50% vulnerable — a 21-point gap the aggregate hides
- **Command execution:** Haiku 50% vulnerable, Opus 96% vulnerable — a 46-point gap
- **Database:** Haiku 39% vulnerable, Gemini Pro 96% vulnerable — a 57-point gap in generation, but Gemini Pro fixes 93% while Haiku fixes only 45%

The aggregate says pick Haiku. But if your codebase is database-heavy, the real number for you is Haiku's 45% remediation rate — meaning more than half of its database vulnerabilities survive the full cycle. Gemini Pro's 93% fix rate means the net position is better even though Gemini Pro generates more vulnerabilities to start.

This isn't the first time a per-domain breakdown has changed the story: in [Claude vs Gemini Across 4 Security Domains](https://dev.to/ofri-peretz/claude-vs-gemini-across-4-security-domains-a-dead-heat-and-the-hardening-63-of-ai-code-skips-mpp), a smaller two-model comparison found the same pattern — the aggregate hides a domain-level dead heat, and the real gap is in hardening, not raw vulnerability count.

### Why This Isn't an Academic Exercise

One of these five models is writing code in your editor right now — Copilot, Cursor, Claude Code, Gemini in Antigravity. The domain breakdown is the difference between "my assistant is safe" and "my assistant is safe at JWT and a coin-flip at database queries." When your team standardizes on a single model "because it scored best," you inherit its worst domain everywhere — and the data below shows every model has a worst domain it's genuinely bad at.

The reassuring part: these are the exact patterns a static-analysis pass catches before the code reaches review. The same ESLint rules I used to score the models are the ones that flag the AI's output in CI. Generation is the model's job; catching what it reintroduces is yours.

---

## The Five Security Domains

### 1. Database Operations (PostgreSQL)

**Prompts:** `getUserById`, `searchUsers`, `updateUser`, `deleteUser`

| Model            | Vuln Rate  | Key Vulnerabilities                                                       |
| ---------------- | ---------- | ------------------------------------------------------------------------- |
| **Haiku 4.5**    | **39%** 🏆 | `pg/no-select-all`                                                        |
| Opus 4.6         | 61%        | `pg/no-select-all`, `secure-coding/detect-object-injection`               |
| Sonnet 4.5       | 71%        | `pg/no-select-all`, `pg/no-unsafe-query`                                  |
| Gemini 2.5 Flash | 75%        | `pg/no-hardcoded-credentials`, `pg/prefer-pool-query`                     |
| Gemini 2.5 Pro   | 96%        | `pg/prefer-pool-query`, `pg/no-hardcoded-credentials`, `pg/no-select-all` |

Worth flagging before the rest of this section: `pg/no-select-all` and `pg/prefer-pool-query` are hardening/best-practice rules, not injection sinks — I wrote both rules, which is a real conflict of interest to disclose. `pg/no-unsafe-query` and `secure-coding/detect-object-injection` are the actual sinks in this table. If you'd only count true sinks as "vulnerable," Gemini Pro's 96% collapses toward Sonnet's 71%, and the database story is closer to a three-way spread than a Haiku-vs-everyone gap. The remediation story below still holds either way — Gemini Pro fixes the largest share of whatever gets flagged — but "93% fixed" should read as "93% of what this ruleset flags," not "93% of confirmed SQL injections."

**The aggregate says Gemini Pro is the most dangerous model. The database remediation data says it's the best database model in the entire benchmark** — fixing 93% of the vulnerabilities it writes. Haiku, the aggregate "winner," fixes only 45% of its database issues. If your service is database-heavy, the aggregate leaderboard is recommending the worse outcome.

**Observation:** Haiku wins generation by writing simple, parameterized queries. Gemini Pro generates the most feature-rich database code — connection pooling, credential management, column enumeration — but this additional complexity triggers more rules. The question is whether that complexity is a _vulnerability_ or a _feature that needs refinement_.

**Why this survives review:** The Gemini Pro database code _looks_ more senior. It has the connection pool, the env-var config, the error handling — all the things a reviewer is trained to look for. So the reviewer's pattern-matcher fires "this person knows what they're doing" and the `pg/no-select-all` and `secure-coding/detect-object-injection` issues slide through, because they're buried in code that signals competence. Haiku's bare three-line query gets _more_ scrutiny precisely because it looks junior. The lesson: production-shaped code earns trust it hasn't yet proven, and that's exactly where the parameterization and `SELECT *` bugs hide. Call Gemini Pro's 96% generation vulnerability rate ambition without a linter, not carelessness.

### 2. Authentication (JWT, bcrypt)

**Prompts:** `generateJWT`, `verifyJWT`, `hashPassword`, `comparePassword`

| Model            | Vuln Rate  | Notable                                      |
| ---------------- | ---------- | -------------------------------------------- |
| **Haiku 4.5**    | **29%** 🏆 | Minimal JWT payloads                         |
| Sonnet 4.5       | 39%        | `jwt/no-sensitive-payload`                   |
| Gemini 2.5 Flash | 43%        | **0/7 on `generateJWT`** — perfect score     |
| Gemini 2.5 Pro   | 43%        | 0/7 on `hashPassword` and `comparePassword`  |
| Opus 4.6         | 50%        | **7/7 on `generateJWT`** — always vulnerable |

**The most striking prompt-level result in the benchmark:** Opus generates vulnerable JWT creation code **every single time** (7/7), always including sensitive user data in the payload (`jwt/no-sensitive-payload`). Gemini Flash generates it perfectly **every single time** (0/7), with minimal payloads containing only the user ID. Same prompt, opposite outcomes, 100% consistency. Then Opus remediates 100% of the auth vulnerabilities it creates — while Gemini Flash remediates only 25%.

The aggregate score conceals both of these facts. Opus "loses" the aggregate, but if you pair Opus with a lint gate that surfaces its JWT payload issue, you get 100% remediation on a pattern it creates consistently. If you pair Gemini Flash with the same lint gate expecting it to fix what it broke, it fixes 25% of it.

**Why this survives review:** A reviewer waves through `jwt.sign(user, secret)` because it _works_ — login succeeds, the token verifies, the test suite is green, and the payload is just `...user`, which reads like a sensible default. The bug is literally invisible at the source level; it only surfaces when someone base64-decodes the token in transit and finds the password hash, the email, and the role sitting in plaintext between the dots. To be precise about the impact: the hash itself isn't a usable credential outright, but it's PII exposure plus a free offline cracking target, and the email/role leak is immediate. Nothing in the diff says "this leaks PII," so nobody asks. The reviewer would have to think to decode the token to catch it — and almost nobody does that in a pull-request review. Every JWT that ships with the wrong payload is PII and an offline-crackable hash waiting to be decoded by anyone who intercepts the token in transit.

### 3. File I/O (Uploads, Reads, Deletes)

**Prompts:** `readUpload`, `saveUpload`, `listDirectory`, `deleteFile`

| Model              | Vuln Rate           | Key Vulnerabilities                                                                      |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------- |
| **Gemini 2.5 Pro** | **86% (least-bad)** | `node-security/detect-non-literal-fs-filename`, `node-security/no-arbitrary-file-access` |
| Haiku 4.5          | 93%                 | Same rules                                                                               |
| Opus 4.6           | 93%                 | Same rules                                                                               |
| Gemini 2.5 Flash   | 96%                 | Same rules                                                                               |
| Sonnet 4.5         | 100%                | Same rules — every iteration, every time                                                 |

**The hardest category for every model.** File operations with user-supplied filenames will almost always trigger `node-security/detect-non-literal-fs-filename`. That's an architectural constraint, not a model failure: any function that takes a dynamic filename parameter and passes it to `fs.readFile()` will flag this rule. The only "safe" pattern is to never accept user filenames, which defeats the purpose of the prompt.

Even here, there's a spread: Gemini Pro's 86% vs Sonnet's 100% reflects Gemini Pro's tendency to add path sanitization and validation, which occasionally satisfies the security rules.

**Why this survives review:** Path traversal bugs — `../../etc/passwd` style — are the kind of vulnerability that looks right until it's exploited. The code reads a file. The filename comes from the request. The function validates it's a string. None of these steps look wrong in isolation, and a reviewer running through a PR diff isn't mentally simulating "what if this value contains `../`" for every `fs.readFile`. The path traversal is invisible in the diff; it only becomes visible when you draw a line from the HTTP request body all the way to the filesystem call, and most code review doesn't trace that path end-to-end. This is exactly why [`node-security/detect-non-literal-fs-filename`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-non-literal-fs-filename) is one of the rules you want in CI: it traces that line automatically, on every commit.

### 4. Command Execution (Shell Operations)

**Prompts:** `compressFile`, `convertImage`, `runCommand`, `backupDatabase`

| Model            | Vuln Rate  | Key Vulnerabilities                                                                  |
| ---------------- | ---------- | ------------------------------------------------------------------------------------ |
| **Haiku 4.5**    | **50%** 🏆 | `node-security/detect-child-process`, `node-security/detect-non-literal-fs-filename` |
| Sonnet 4.5       | 75%        | Same                                                                                 |
| Gemini 2.5 Flash | 82%        | Same                                                                                 |
| Gemini 2.5 Pro   | 93%        | Same                                                                                 |
| Opus 4.6         | 96%        | Same                                                                                 |

**Haiku's simplicity advantage is clearest here.** When asked to compress a file, Haiku sometimes generates code that uses a library API (like `archiver`) instead of spawning a shell process. The larger models generate shell commands with `child_process.exec()` — more flexible, but inherently flagged by security rules.

Worth stating plainly here, not just in the limitations section: [`node-security/detect-child-process`](https://eslint.interlace.tools/docs/security/plugin-node-security/rules/detect-child-process) flags **all** `child_process` usage, including a properly-sanitized `execFile()` call with a fixed argument array. Some of what's counted as "vulnerable" in this category is legitimate shell access the rule can't distinguish from an injection sink. That's a real confound — but it doesn't change the remediation story below, where even models given the exact violation and asked to fix it still can't get the fix rate above 19%.

**Why this survives review:** ``exec(`tar -czf ${out} ${dir}`)`` reads as the obvious, idiomatic way to shell out — it's exactly what a reviewer would have written themselves, so it pattern-matches as correct and the review moves on. The command-injection sink is hiding in plain sight inside a template literal that _looks_ like a string, not like a security boundary. It only bites when `dir` arrives as `; rm -rf /` from a request body weeks later, in code the original reviewer never imagined would take untrusted input. Familiarity is the vulnerability here: the more ordinary the shell call looks, the less anyone scrutinizes where its arguments came from.

### 5. Configuration & Secrets

**Prompts:** `dbConnection`, `sendEmail`, `apiCall`, `encryptData`

| Model                | Vuln Rate  | Key Vulnerabilities                                                                 |
| -------------------- | ---------- | ----------------------------------------------------------------------------------- |
| **Gemini 2.5 Flash** | **21%** 🏆 | Rarely hardcodes credentials                                                        |
| Opus 4.6             | 25%        | `secure-coding/no-hardcoded-credentials`                                            |
| Sonnet 4.5           | 25%        | Same                                                                                |
| Haiku 4.5            | 32%        | `secure-coding/no-hardcoded-credentials`                                            |
| Gemini 2.5 Pro       | 46%        | `secure-coding/no-hardcoded-credentials`, `secure-coding/no-unsafe-deserialization` |

**Configuration is where all models do best**, but Gemini Flash stands out with a 21% vulnerability rate. Flash consistently generates code that reads from `process.env` instead of using placeholder credentials — the simplest pattern, but the most secure default.

Note this is a different rule than the `pg/no-hardcoded-credentials` in the Database table above — same short name, two different plugins. `secure-coding/no-hardcoded-credentials` scans generic string literals and env-var patterns across any file; `pg/no-hardcoded-credentials` is pg-specific and checks connection-config objects passed to the `pg` client.

**Why this survives review:** Hardcoded credentials pass code review because they look like they're the developer's intent — it reads as "temporary, will be moved later" and the reviewer assumes that later is already planned. It also passes because the string literal in the code doesn't look dangerous: `password: "my-db-pass"` doesn't set off the same alarm bell as `exec(userInput)`. The secret only becomes a problem when the file gets committed, pushed, and the git history is scraped. By the time the credential appears in a breach report, the original reviewer is usually two jobs removed from the codebase.

---

## The Remediation Story, Per Domain

Generation is only half the pipeline. When vulnerabilities are found, I feed the ESLint violations back to the same model and ask it to fix them. This is where the rankings invert most dramatically.

### Database Remediation — Gemini Pro Fixes 93%, Haiku 45%

| Model              | Vulnerable Functions | Fully Fixed | Fix Rate |
| ------------------ | -------------------- | ----------- | -------- |
| **Gemini 2.5 Pro** | 27                   | 25          | **93%**  |
| Gemini 2.5 Flash   | 21                   | 14          | 67%      |
| Sonnet 4.5         | 20                   | 13          | 65%      |
| Opus 4.6           | 17                   | 10          | 59%      |
| Haiku 4.5          | 11                   | 5           | **45%**  |

**The model with the highest database vulnerability rate (96%) also has the highest database fix rate (93%)**. Gemini Pro fixes 25 out of 27 vulnerable database functions — nearly double Haiku's 45%.

Gemini Pro generates complex database code because it has a deep model of the domain. That same depth of understanding means it can parse a specific ESLint violation like `pg/no-select-all`'s message — "Avoid using `SELECT *` which fetches all columns" (tagged [CWE-1049](https://ofriperetz.dev/articles/cwe-taxonomy-explained), Excessive Data Query Operations — a data-efficiency weakness class, not an injection CWE, which fits the hardening framing above) — and restructure the query to enumerate explicit columns correctly. Haiku, which generates simpler code with fewer vulnerabilities, doesn't have the same depth to draw on when fixes are needed.

**The slack-quotable number from this entire benchmark: Haiku is the "safest" model overall, but if you run it on database code with an ESLint gate, 55% of the vulnerabilities it generates will survive remediation.** The model the community recommends for security is the worst database remediator in the study.

### Authentication Remediation — Opus Fixes 100%, Gemini Flash 25%

| Model            | Vulnerable Functions | Fully Fixed | Fix Rate |
| ---------------- | -------------------- | ----------- | -------- |
| **Opus 4.6**     | 14                   | 14          | **100%** |
| Gemini 2.5 Pro   | 12                   | 7           | 58%      |
| Sonnet 4.5       | 11                   | 5           | 45%      |
| Haiku 4.5        | 8                    | 3           | 38%      |
| Gemini 2.5 Flash | 12                   | 3           | **25%**  |

**This is the most dominant single-category result in the entire benchmark** — though I'll caveat it before you do: it rests on n=14. Opus fixes every single authentication vulnerability when given feedback — 14 for 14, a perfect score on a small but unbroken run. No other model achieves 100% in any remediation category with this many samples. JWT algorithm whitelisting, sensitive data removal from payloads, proper token expiration — Opus understands the _security implications_, not just the code patterns. Fourteen is not enough to promise 100% in production, but a clean 14/14 is a strong enough signal that, if your application is authentication-heavy, Opus is the model I'd reach for first.

### File I/O Remediation — Opus Leads at 73%, Still 1 in 4 Vulnerable

| Model            | Vulnerable Functions | Fully Fixed | Fix Rate |
| ---------------- | -------------------- | ----------- | -------- |
| **Opus 4.6**     | 26                   | 19          | **73%**  |
| Haiku 4.5        | 26                   | 15          | 58%      |
| Gemini 2.5 Pro   | 24                   | 10          | 42%      |
| Sonnet 4.5       | 28                   | 10          | 36%      |
| Gemini 2.5 Flash | 27                   | 6           | **22%**  |

Opus leads here, but even its 73% leaves more than a quarter of file operations vulnerable after remediation. The fundamental issue — dynamic filenames — is hard to fix without changing the function's API entirely.

### Command Execution Remediation — Every Model Under 20% Fix Rate

| Model            | Vulnerable Functions | Fully Fixed | Fix Rate |
| ---------------- | -------------------- | ----------- | -------- |
| Opus 4.6         | 27                   | 5           | **19%**  |
| Haiku 4.5        | 14                   | 1           | 7%       |
| Sonnet 4.5       | 21                   | 1           | 5%       |
| Gemini 2.5 Flash | 23                   | 1           | 4%       |
| Gemini 2.5 Pro   | 26                   | 0           | **0%**   |

**The most sobering category.** The "leader" here fixes 5 of 27 — and calling 19% a lead is generous; it's the tallest result in a field where everyone fails. No model can reliably fix command execution vulnerabilities because the prompts inherently require shell access. When the prompt says "compress a file using the command line," there is no way to avoid `child_process`. This is a category where static analysis is the safety net, not AI remediation.

If you only take one action from this article, make it this: put the gate in CI so the 0%-fix-rate categories can't ship silently — and for command execution specifically, gate as a **block**, not a route-to-a-model-and-hope. These are the exact plugins that produced every number above — install them and the AI's output gets checked on the way in. `node-security/detect-child-process` and `node-security/detect-non-literal-fs-filename` live in `eslint-plugin-node-security`; `secure-coding/detect-object-injection` and `secure-coding/no-hardcoded-credentials` live in `eslint-plugin-secure-coding` — two different plugins, not one:

```bash
npm i -D eslint-plugin-secure-coding@^3.3.0 eslint-plugin-node-security@^4.3.0 \
  eslint-plugin-postgresql-security@^1.4.4 eslint-plugin-jwt-security@^2.2.4
```

```js
// eslint.config.js (flat config)
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import pg from "eslint-plugin-postgresql-security";
import jwt from "eslint-plugin-jwt-security";

export default [
  secureCoding.configs.recommended, // secure-coding/detect-object-injection, secure-coding/no-hardcoded-credentials
  nodeSecurity.configs.recommended, // node-security/detect-child-process, node-security/detect-non-literal-fs-filename, node-security/no-arbitrary-file-access
  pg.configs.recommended, // pg/no-select-all, pg/no-unsafe-query, pg/prefer-pool-query
  jwt.configs.recommended, // jwt/no-sensitive-payload
];
```

Note `secure-coding/no-unsafe-deserialization` — cited in the Configuration domain table above — ships in that plugin's `recommended` preset at `warn` (demoted from `error` on 2026-05-09 after firing mostly on adversarial edge-case code), so it surfaces but won't fail a CI gate that only blocks on errors. Promote it to `error`, or use the `recommended-strict` preset, if you want it to gate.

The full rule list and per-rule docs are at [eslint.interlace.tools](https://eslint.interlace.tools) — see [`pg/no-select-all`](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-select-all) and [`jwt/no-sensitive-payload`](https://eslint.interlace.tools/docs/security/plugin-jwt/rules/no-sensitive-payload) directly for the two headline rules above. If you want to understand the broader landscape of ESLint security plugins and how they compare, I ran a [head-to-head benchmark of 17 ESLint security plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) that covers detection rates, false positives, and which rules to pick. The point for command execution and file I/O specifically: the lint rule is the last line of defense, because neither the model nor the reviewer reliably is.

### Configuration Remediation — Gemini Flash and Opus Both Hit 100%

| Model                | Vulnerable Functions | Fully Fixed | Fix Rate |
| -------------------- | -------------------- | ----------- | -------- |
| **Gemini 2.5 Flash** | 6                    | 6           | **100%** |
| **Opus 4.6**         | 7                    | 7           | **100%** |
| Sonnet 4.5           | 7                    | 3           | 43%      |
| Gemini 2.5 Pro       | 13                   | 5           | 38%      |
| Haiku 4.5            | 9                    | 2           | **22%**  |

Both Gemini Flash and Opus achieve perfect configuration remediation — on small denominators (n=6 and n=7 respectively), so treat these as "never missed in this run" rather than a statistical guarantee. When told "you have hardcoded credentials, move them to environment variables," both models execute the fix flawlessly. The mechanism is plausible — moving a literal to `process.env` is the single most templated fix in the corpus — which is why I trust the direction even at this [sample size](https://ofriperetz.dev/articles/sample-size-and-statistical-power).

---

## Net Security: The Metric That Actually Matters

Vulnerability rate and fix rate in isolation both mislead — what actually predicts your outcome is the **net security position** after a full generation + remediation cycle.

> **Net security position** = initial vulnerability rate × (1 − fix rate)
>
> The fraction of generated functions that are _still_ vulnerable after the model has had one chance to fix its own ESLint violations. This is the number that should drive model selection when you have a remediation pipeline — not the generation-only leaderboard.

The table below uses a flat average across all five domains, weighted equally. That's a simplification: if your codebase is 80% database code and 5% command execution, your real net position is the domain-weighted sum — `Σ (domain share × domain net-remaining)` — not the flat average below. Swap in your own repo's domain mix against the per-domain net-remaining numbers in each section above to get your actual number; the table below is the equal-weight baseline, not a universal constant.

| Model              | Initial Vuln Rate | Fix Rate | **Net Remaining** | **Rank Change**       |
| ------------------ | ----------------- | -------- | ----------------- | --------------------- |
| **Opus 4.6**       | 65.0%             | 60.4%    | **25.7%**         | ⬆️ 4th → **1st**      |
| **Haiku 4.5**      | 48.6%             | 38.2%    | **30.0%**         | ⬇️ 1st → 2nd          |
| Sonnet 4.5         | 62.1%             | 36.8%    | 39.3%             | ⬇️ 2nd → tied 3rd–4th |
| **Gemini 2.5 Pro** | 72.9%             | 46.1%    | **39.3%**         | ⬆️ 5th → tied 3rd–4th |
| Gemini 2.5 Flash   | 63.6%             | 33.7%    | 42.1%             | ⬇️ 3rd → 5th          |

_(Gemini Pro's fix rate pools the five domain remediation rows above: 25/27 + 7/12 + 10/24 + 0/26 + 5/13 = 47/102 = 46.1%. One remediation call in this run failed on an API timeout rather than returning a real fix attempt; excluding it from the denominator gives 46.5%, which is what a couple of earlier drafts of this table showed. The domain rows above are the [ground truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing) — 46.1% is the number that reconciles against them, so that's what's used here.)_

Fix Rate here is pooled across all vulnerable functions for that model — fixed-functions ÷ vulnerable-functions, summed across all five domains — not an average of the five domain fix-rate percentages. Averaging the percentages directly (93+58+42+0+38)/5 ≈ 46.2% happens to land close for Gemini Pro but won't generally match the pooled number for models with more uneven domain sample sizes; use the pooled method if you're recomputing from the per-domain tables above.

_(Haiku's initial vuln rate rounds to 49% elsewhere in this article and in Part 3's headline — 48.6% here is the unrounded figure used for the net-remaining math.)_

**The entire ranking inverts after remediation.** Opus jumps from 4th-safest to 1st — the biggest climb, and the clearest vindication of remediation as a strategy. Haiku drops from 1st to 2nd. And Gemini Pro — the "most dangerous" model by aggregate — climbs from 5th all the way to a tie with Sonnet for 3rd.

**Opus's quiet dominance:** It doesn't win generation in any category. It doesn't have the flashiest single-domain result. But it remediates so consistently across _every_ category — 100% auth, 73% file I/O, 100% config, best-in-class command execution — that it ends up with the best net security by a comfortable margin. Opus is the generalist remediator; it doesn't specialize, it just fixes everything well.

### Absolute Vulnerability Elimination

Another way to measure remediation impact: how many individual vulnerabilities does each model eliminate? (Sorted by absolute count eliminated, not by reduction rate — that's why Haiku's 39.8% sits below Sonnet's 37.4% in the table.) This uses a different denominator than the Fix Rate column above — Fix Rate counts **functions** that end up with zero remaining violations (Opus: 60.4%), while Reduction Rate below counts **individual violations** eliminated, including partial fixes on functions that still have at least one violation left (Opus: 44.1%). A function can go from 3 violations to 1 — a partial win that helps the vulnerability count but doesn't register as "fully fixed." Both numbers are real; they're just measuring at different granularity.

| Model              | Vulns Found | After Fix | **Eliminated** | Reduction Rate |
| ------------------ | ----------- | --------- | -------------- | -------------- |
| **Gemini 2.5 Pro** | 167         | 93        | **74**         | **44.3%**      |
| Gemini 2.5 Flash   | 154         | 90        | 64             | 41.6%          |
| Sonnet 4.5         | 139         | 87        | 52             | 37.4%          |
| Haiku 4.5          | 128         | 77        | 51             | 39.8%          |
| Opus 4.6           | 111         | 62        | 49             | 44.1%          |

Gemini Pro eliminates the most total vulnerabilities (74) and has the highest reduction rate (44.3%), narrowly edging Opus (44.1%). But note that Opus starts with fewer vulnerabilities (111 vs 167) and still achieves nearly the same reduction rate — meaning its fixes are proportionally just as effective, with less room to work with.

---

## The Practical Framework

Based on 700 functions of domain-level data, here's how to think about model selection:

### If You Have No Remediation Pipeline

Use the generation champion: **Haiku 4.5**. It generates the least vulnerable code across most categories (49% aggregate). Accept that ~50% of functions will still need manual review.

### If You Have ESLint + Automated Remediation

The calculation changes. Now you care about net security after the full cycle:

| Strategy               | Net Position        | Cost |
| ---------------------- | ------------------- | ---- |
| Haiku everywhere       | 30.0% remaining     | $    |
| Opus everywhere        | **25.7% remaining** | $$$  |
| Domain-aware selection | **< 25% remaining** | $$   |

### Domain-Aware Selection (Optimal)

Match models to their strengths:

| Domain                | Best Generator        | Best Remediator                  |
| --------------------- | --------------------- | -------------------------------- |
| **Database**          | Haiku (39% vuln)      | Gemini Pro (93% fix)             |
| **Authentication**    | Gemini Flash (0% JWT) | Opus (100% fix)                  |
| **File I/O**          | Gemini Pro (86%)      | Opus (73% fix)                   |
| **Configuration**     | Gemini Flash (21%)    | Flash or Opus (100% fix)         |
| **Command Execution** | Haiku (50%)           | Manual review (all models < 20%) |

Treat this table as the theoretical optimum rather than a build spec. Routing by filename (`db-query.js` → Gemini Pro) assumes a naming convention most repos don't actually enforce, running two paid model APIs from CI adds real latency and cost per PR, and someone still has to review the auto-fix before merge — none of that is free. Even done perfectly, domain-aware routing lands under 25% net-remaining, not zero. For most teams, the honest recommendation is simpler: **fix the lint error yourself when it fires**, and reach for automated routing only once manual remediation is the actual bottleneck, not before.

With that caveat, both the Claude API and the Gemini API do support scriptable, zero-context execution that can be wired into CI/CD. Here's a corrected, runnable version of the routing idea — it escapes the lint output into valid JSON with `jq -Rs` (the earlier naive `${LINT_ERRORS}` interpolation breaks on any quote or newline in ESLint's output) and treats command execution as a **block**, not a route, because no model clears 20% fix rate on it:

```bash
# Example: Domain-aware remediation routing in CI
# Assumes you have CLAUDE_API_KEY and GEMINI_API_KEY set

# Database remediation → Gemini Pro (93% fix rate)
LINT_ERRORS=$(npx eslint db-query.js --format json)
if [ $? -ne 0 ]; then
  PROMPT=$(jq -Rs '"Fix these ESLint violations in db-query.js: " + .' <<< "$LINT_ERRORS")
  curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"contents\":[{\"parts\":[{\"text\":${PROMPT}}]}]}" \
    | jq -r '.candidates[0].content.parts[0].text'
fi

# Auth remediation → Claude Opus (100% fix rate)
LINT_ERRORS=$(npx eslint auth-handler.js --format json)
if [ $? -ne 0 ]; then
  PROMPT=$(jq -Rs '"Fix these ESLint violations in auth-handler.js: " + .' <<< "$LINT_ERRORS")
  curl -s -X POST "https://api.anthropic.com/v1/messages" \
    -H "x-api-key: ${CLAUDE_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"claude-opus-4-6\",\"max_tokens\":4096,\"messages\":[{\"role\":\"user\",\"content\":${PROMPT}}]}" \
    | jq -r '.content[0].text'
fi

# Command execution → block, don't route (no model clears 20% fix rate — see below)
LINT_ERRORS=$(npx eslint shell-runner.js --format json)
if [ $? -ne 0 ]; then
  echo "::error::shell-runner.js has command-execution violations. No model in this benchmark fixes these reliably — flagging for manual review instead of auto-remediation." >&2
  echo "$LINT_ERRORS"
  exit 1
fi
```

---

## How the Domain Data Revises the Aggregate Model Ranking

Part 3 concluded: _"Model choice matters — Haiku's 49% vs Gemini Pro's 73% is a statistically significant gap."_

That conclusion stands. But it's incomplete without domain context:

| Part 3 Conclusion                        | Part 4 Refinement                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "Haiku is the safest model"              | Haiku is the safest **generator** — but has the lowest database fix rate (45%)                     |
| "Gemini Pro is the most dangerous model" | Gemini Pro generates complex code — and fixes 93% of it when given feedback                        |
| "Opus is the best overall remediator"    | Opus is the best overall — but Gemini Pro beats it in database remediation by 34 percentage points |
| "Model choice is a risk lever"           | **Domain-aware** model choice is a much larger risk lever                                          |

The aggregate vulnerability rate is a useful first-pass metric. But for organizations building security-critical systems — especially database-heavy applications — the domain-level data tells a different story. The "worst" overall model might be the best choice for your specific stack.

---

## Limitations

Everything from [Part 3's limitations](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong#limitations) applies, plus:

1. **Small category samples.** Each category has 4 prompts × 7 iterations = 28 data points per model. Category-level confidence intervals are wider than the aggregate. The 93% database fix rate has a Wilson CI of roughly [77% - 98%] — directionally strong but less precise than the aggregate.

2. **[False-positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) surface area.** Some ESLint rules like `node-security/detect-child-process` flag _all_ `child_process` usage — including sanitized, controlled execs — and `node-security/detect-non-literal-fs-filename` fires on validated dynamic paths. The article partially accounts for this (the File I/O architectural constraint discussion), but every flagged function is counted as vulnerable. Models that generate simpler code have less rule surface area to hit, which gives Haiku a structural advantage in raw numbers that may not reflect real-world security quality difference. The benchmark measures _linter exposure_ alongside security quality, and the two are correlated but not identical.

3. **No cross-model remediation.** I tested each model remediating its own code. A model remediating another model's code might show different patterns — this is an open research question.

4. **Category definitions are arbitrary.** "Database" and "Authentication" are useful groupings, but a different taxonomy might produce different rankings.

---

## Reproducing This Research

All category-level data was extracted from the same [overnight benchmark run from February 9, 2026](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security) used in Part 3. The domain breakdown is a reanalysis of the same 700 functions — no new generation was performed.

`run-overnight.sh` is the orchestrator that produced the committed results: it sets `ENABLE_REMEDIATION=true`, 7 iterations, all 5 CLI models, then calls `run-antigravity.js` underneath with those flags. Run it directly, or call `run-antigravity.js` yourself with the same flags:

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite

# Option A — the exact overnight orchestrator that produced these numbers
chmod +x benchmarks/ai-security/run-overnight.sh
./benchmarks/ai-security/run-overnight.sh

# Option B — the same run, invoked directly
node benchmarks/ai-security/run-antigravity.js \
  --model=haiku-4.5,opus-4.6,sonnet-4.5,gemini-2.5-flash-cli,gemini-2.5-pro-cli \
  --iterations=7
```

A live rerun won't [reproduce](https://ofriperetz.dev/articles/reproducibility-vs-replicability) these exact rates — model outputs drift week to week — so treat the [committed JSON](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security) as the frozen dataset every number in this article is checked against, and a fresh run as a directional sanity check, not a byte-for-byte match. Models tested: Opus 4.6, Sonnet 4.5, Haiku 4.5, Gemini 2.5 Flash, Gemini 2.5 Pro — snapshot dated 2026-02-09.

---

## Conclusions

1. **Aggregate benchmarks hide domain expertise.** The model ranked last overall (Gemini Pro) is the best database remediator by a wide margin. The model ranked first (Haiku) has one of the lowest fix rates.

2. **No single model wins everywhere.** Haiku leads generation in 3/5 categories. Opus leads remediation in 3/5. Gemini Flash leads generation in 1 and ties remediation in 1. Gemini Pro leads in the single most impactful remediation category — database.

3. **Remediation inverts the ranking.** After a full generation + remediation cycle, Opus (initially 4th) becomes 1st, and Gemini Pro (initially 5th) climbs to a tie for 3rd. The generation ranking is not the net security ranking.

4. **The 93% database fix rate is the benchmark's strongest signal.** It's the highest fix rate carried by a double-digit sample (27 vulnerable functions) — the two 100% scores (Opus auth, n=14; Opus and Gemini Flash config, n=6-7) are perfect but thinner, and even Opus's strong 73% file I/O result (n=26) tops out well below it. Gemini Pro's database remediation (25/27) is both high-confidence and high-impact.

5. **Command execution remediation is unsolved.** Every model scores below 20%. This is the one category where AI remediation cannot substitute for manual review.

6. **Domain-aware model selection beats "use the best model."** Organizations should match models to their stack, not pick a single "winner" for everything.

---

Which security domain is most represented in your AI-generated code — and have you measured whether aggregate metrics are masking a worse per-domain number? If you've standardized on Haiku "because it scored best" without checking your database fix rate, I want to hear whether the domain breakdown matches what you're seeing in practice. Better yet: clone the [frozen dataset](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security), run your own domain slice against it, and tell me where your numbers diverge from mine — that's the actual test of whether this holds up. Drop it in the comments.

---

## Foundations

Two measurement concepts do quiet work throughout this analysis. The equal-weight net-position table is a [composite score](https://ofriperetz.dev/articles/composite-scores-and-weighting) — change the domain weights and the ranking changes with it. And every per-domain rate reads differently against its domain's [base rate](https://ofriperetz.dev/articles/base-rate-problem-explained): a flagged function means something different in a domain where 96% of functions trigger rules than in one where 21% do.

---

📦 [Full Benchmark Results (JSON)](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security)
🔬 [Benchmark Runner Source](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/benchmarks/ai-security)
📊 [Overnight Runner Script](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/benchmarks/ai-security/run-overnight.sh)

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)** · **[All packages on npm](https://www.npmjs.com/~ofriperetz)**

---

**The Interlace ESLint Ecosystem**
332+ security rules. 18 specialized plugins. 100% OWASP Top 10 coverage.

## [Explore the Documentation](https://eslint.interlace.tools)

---

**In the AI Security Benchmark Series:**

- **Part 1:** [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — Establishes the baseline vulnerability rate
- **Part 2:** [The AI Hydra Problem: Fix One AI Bug, Get Two More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) — Tests whether remediation converges
- **Part 3:** [We Ranked 5 AI Models by Security. The Leaderboard Is Wrong.](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) — Validates at scale across providers
- **Part 4:** Aggregate Benchmarks Lie ← _You are here_ — Domain-specific deep-dive

**Follow [@ofri-peretz](https://dev.to/ofri-peretz) to get notified when the next chapter drops.**

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=domain-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz) | [X/Twitter](https://twitter.com/ofriperetzdev)
