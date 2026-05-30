---
title: "Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain."
description: "Part 3 ranked 5 AI models by overall vulnerability rate. But when we broke the data down by security domain — database, auth, file I/O, command execution — the rankings inverted. The 'worst' model fixes 93% of database vulnerabilities. The 'best' model fails at remediation. Aggregate numbers hide domain expertise."
slug: "aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain"
canonical_url: "https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain"
devto_url: "https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj"
devto_id: 3688611
published_at: "2026-05-17T15:40:50Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gjifodfaukn49e9y18ux.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gjifodfaukn49e9y18ux.png"
reading_time_minutes: 12
tags:
  - "ai"
  - "security"
  - "googleai"
  - "javascript"
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

Every AI benchmark I've seen makes the same mistake. They rank models by a single number — accuracy, pass rate, vulnerability rate — and call it a day.

In [Part 3](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), we did exactly that. We ranked 5 models from Claude and Gemini by aggregate vulnerability rate and declared Haiku the safest (49%) and Gemini Pro the most dangerous (73%).

That ranking is real. It's also misleading.

---

## TL;DR

When we broke 700 functions down by **security domain**, the rankings inverted. The model that "lost" the aggregate benchmark dominates the most important remediation category. The model that "won" has one of the lowest fix rates.

### Category Champions (Lowest Vulnerability Rate)

| Domain                | Champion         | Rate    | Runner-Up     | Rate |
| --------------------- | ---------------- | ------- | ------------- | ---- |
| **Database**          | Haiku 4.5        | **39%** | Opus 4.6      | 61%  |
| **Authentication**    | Haiku 4.5        | **29%** | Sonnet 4.5    | 39%  |
| **File I/O**          | Gemini 2.5 Pro   | **86%** | Haiku / Opus  | 93%  |
| **Configuration**     | Gemini 2.5 Flash | **21%** | Sonnet / Opus | 25%  |
| **Command Execution** | Haiku 4.5        | **50%** | Sonnet 4.5    | 75%  |

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

---

## Why Aggregates Fail

Part 3's aggregate ranking:

```text
1. Haiku 4.5:     49%  ← "safest"
2. Sonnet 4.5:    62%
3. Gemini Flash:  64%
4. Opus 4.6:      65%
5. Gemini Pro:    73%  ← "most dangerous"
```

This is the equivalent of saying "Hospital A has the best patient outcomes" without checking whether it's a cardiac center or a dermatology clinic. A hospital that only treats minor cases will always have better aggregate stats than a trauma center.

AI models work the same way. Different models generate fundamentally different **types** of code — varying in complexity, architectural patterns, and feature richness. Haiku generates simple, minimal implementations. Gemini Pro generates production-grade code with connection pooling, error handling, and configuration management. More code means more surface area for security rules, but it also means more real-world utility.

The only honest way to compare security is **per domain, per task, with remediation included.**

---

## The Five Security Domains

### 1. Database Operations (PostgreSQL)

**Prompts:** `getUserById`, `searchUsers`, `updateUser`, `deleteUser`

| Model            | Vuln Rate  | Key Vulnerabilities                                                       |
| ---------------- | ---------- | ------------------------------------------------------------------------- |
| **Haiku 4.5**    | **39%** 🏆 | `pg/no-select-all`                                                        |
| Opus 4.6         | 61%        | `pg/no-select-all`, `detect-object-injection`                             |
| Sonnet 4.5       | 71%        | `pg/no-select-all`, `pg/no-unsafe-query`                                  |
| Gemini 2.5 Flash | 75%        | `pg/no-hardcoded-credentials`, `pg/prefer-pool-query`                     |
| Gemini 2.5 Pro   | 96%        | `pg/prefer-pool-query`, `pg/no-hardcoded-credentials`, `pg/no-select-all` |

**Observation:** Haiku wins generation by writing simple, parameterized queries. Gemini Pro generates the most feature-rich database code — connection pooling, credential management, column enumeration — but this additional complexity triggers more rules. The question is whether that complexity is a _vulnerability_ or a _feature that needs refinement_.

### 2. Authentication (JWT, bcrypt)

**Prompts:** `generateJWT`, `verifyJWT`, `hashPassword`, `comparePassword`

| Model            | Vuln Rate  | Notable                                      |
| ---------------- | ---------- | -------------------------------------------- |
| **Haiku 4.5**    | **29%** 🏆 | Minimal JWT payloads                         |
| Sonnet 4.5       | 39%        | `jwt/no-sensitive-payload`                   |
| Gemini 2.5 Flash | 43%        | **0/7 on `generateJWT`** — perfect score     |
| Gemini 2.5 Pro   | 43%        | 0/7 on `hashPassword` and `comparePassword`  |
| Opus 4.6         | 50%        | **7/7 on `generateJWT`** — always vulnerable |

**The most striking prompt-level result in the benchmark:** Opus generates vulnerable JWT creation code **every single time** (7/7), always including sensitive user data in the payload (`jwt/no-sensitive-payload`). Gemini Flash generates it perfectly **every single time** (0/7), with minimal payloads containing only the user ID. Same prompt, opposite outcomes, 100% consistency.

### 3. File I/O (Uploads, Reads, Deletes)

**Prompts:** `readUpload`, `saveUpload`, `listDirectory`, `deleteFile`

| Model              | Vuln Rate  | Key Vulnerabilities                                          |
| ------------------ | ---------- | ------------------------------------------------------------ |
| **Gemini 2.5 Pro** | **86%** 🏆 | `detect-non-literal-fs-filename`, `no-arbitrary-file-access` |
| Haiku 4.5          | 93%        | Same rules                                                   |
| Opus 4.6           | 93%        | Same rules                                                   |
| Gemini 2.5 Flash   | 96%        | Same rules                                                   |
| Sonnet 4.5         | 100%       | Same rules — every iteration, every time                     |

**The hardest category for every model.** File operations with user-supplied filenames will almost always trigger `detect-non-literal-fs-filename`. This isn't a model failure — it's an architectural constraint. Any function that takes a dynamic filename parameter and passes it to `fs.readFile()` will flag this rule. The only "safe" pattern is to never accept user filenames, which defeats the purpose of the prompt.

Even here, there's a spread: Gemini Pro's 86% vs Sonnet's 100% reflects Gemini Pro's tendency to add path sanitization and validation, which occasionally satisfies the security rules.

### 4. Command Execution (Shell Operations)

**Prompts:** `compressFile`, `convertImage`, `runCommand`, `backupDatabase`

| Model            | Vuln Rate  | Key Vulnerabilities                                      |
| ---------------- | ---------- | -------------------------------------------------------- |
| **Haiku 4.5**    | **50%** 🏆 | `detect-child-process`, `detect-non-literal-fs-filename` |
| Sonnet 4.5       | 75%        | Same                                                     |
| Gemini 2.5 Flash | 82%        | Same                                                     |
| Gemini 2.5 Pro   | 93%        | Same                                                     |
| Opus 4.6         | 96%        | Same                                                     |

**Haiku's simplicity advantage is clearest here.** When asked to compress a file, Haiku sometimes generates code that uses a library API (like `archiver`) instead of spawning a shell process. The larger models generate shell commands with `child_process.exec()` — more flexible, but inherently flagged by security rules.

### 5. Configuration & Secrets

**Prompts:** `dbConnection`, `sendEmail`, `apiCall`, `encryptData`

| Model                | Vuln Rate  | Key Vulnerabilities                                     |
| -------------------- | ---------- | ------------------------------------------------------- |
| **Gemini 2.5 Flash** | **21%** 🏆 | Rarely hardcodes credentials                            |
| Opus 4.6             | 25%        | `no-hardcoded-credentials`                              |
| Sonnet 4.5           | 25%        | Same                                                    |
| Haiku 4.5            | 32%        | `no-hardcoded-credentials`                              |
| Gemini 2.5 Pro       | 46%        | `no-hardcoded-credentials`, `no-unsafe-deserialization` |

**Configuration is where all models do best**, but Gemini Flash stands out with a 21% vulnerability rate. Flash consistently generates code that reads from `process.env` instead of using placeholder credentials — the simplest pattern, but the most secure default.

---

## The Remediation Story, Per Domain

Generation is only half the pipeline. When vulnerabilities are found, we feed the ESLint violations back to the same model and ask it to fix them. This is where the rankings invert most dramatically.

### Database Remediation — The Biggest Surprise

| Model              | Vulnerable Functions | Fully Fixed | Fix Rate |
| ------------------ | -------------------- | ----------- | -------- |
| **Gemini 2.5 Pro** | 27                   | 25          | **93%**  |
| Gemini 2.5 Flash   | 21                   | 14          | 67%      |
| Sonnet 4.5         | 20                   | 13          | 65%      |
| Opus 4.6           | 17                   | 10          | 59%      |
| Haiku 4.5          | 11                   | 5           | **45%**  |

**The model with the highest database vulnerability rate (96%) also has the highest database fix rate (93%)**. Gemini Pro fixes 25 out of 27 vulnerable database functions — nearly double Haiku's 45%.

This pattern makes more sense than it first appears. Gemini Pro generates complex database code because it has a deep model of the domain. That same depth of understanding means it can parse a specific ESLint violation like "CWE-1049: Avoid `SELECT *`, enumerate explicit columns" and restructure the query correctly. Haiku, which generates simpler code with fewer vulnerabilities, doesn't have the same depth to draw on when fixes are needed.

### Authentication Remediation — Opus Dominates

| Model            | Vulnerable Functions | Fully Fixed | Fix Rate |
| ---------------- | -------------------- | ----------- | -------- |
| **Opus 4.6**     | 14                   | 14          | **100%** |
| Gemini 2.5 Pro   | 12                   | 7           | 58%      |
| Sonnet 4.5       | 11                   | 5           | 45%      |
| Haiku 4.5        | 8                    | 3           | 38%      |
| Gemini 2.5 Flash | 12                   | 3           | **25%**  |

**This is the most dominant single-category result in the entire benchmark.** Opus fixes every single authentication vulnerability when given feedback — 14 for 14, a perfect score. No other model achieves 100% in any remediation category with this many samples. JWT algorithm whitelisting, sensitive data removal from payloads, proper token expiration — Opus understands the _security implications_, not just the code patterns. If your application is authentication-heavy, Opus is the only model where remediation is effectively solved.

### File I/O Remediation — Everyone Struggles

| Model            | Vulnerable Functions | Fully Fixed | Fix Rate |
| ---------------- | -------------------- | ----------- | -------- |
| **Opus 4.6**     | 26                   | 19          | **73%**  |
| Haiku 4.5        | 26                   | 15          | 58%      |
| Gemini 2.5 Pro   | 24                   | 10          | 42%      |
| Sonnet 4.5       | 28                   | 10          | 36%      |
| Gemini 2.5 Flash | 27                   | 6           | **22%**  |

Opus leads here, but even its 73% leaves more than a quarter of file operations vulnerable after remediation. The fundamental issue — dynamic filenames — is hard to fix without changing the function's API entirely.

### Command Execution — Nobody Wins

| Model            | Vulnerable Functions | Fully Fixed | Fix Rate |
| ---------------- | -------------------- | ----------- | -------- |
| Opus 4.6         | 27                   | 5           | **19%**  |
| Haiku 4.5        | 14                   | 1           | 7%       |
| Sonnet 4.5       | 21                   | 1           | 5%       |
| Gemini 2.5 Flash | 23                   | 1           | 4%       |
| Gemini 2.5 Pro   | 26                   | 0           | **0%**   |

**The most sobering category.** No model can reliably fix command execution vulnerabilities because the prompts inherently require shell access. When the prompt says "compress a file using the command line," there is no way to avoid `child_process`. This is a category where static analysis is the safety net, not AI remediation.

### Configuration Remediation — Two Perfect Scores

| Model                | Vulnerable Functions | Fully Fixed | Fix Rate |
| -------------------- | -------------------- | ----------- | -------- |
| **Gemini 2.5 Flash** | 6                    | 6           | **100%** |
| **Opus 4.6**         | 7                    | 7           | **100%** |
| Sonnet 4.5           | 7                    | 3           | 43%      |
| Gemini 2.5 Pro       | 13                   | 5           | 38%      |
| Haiku 4.5            | 9                    | 2           | **22%**  |

Both Gemini Flash and Opus achieve perfect configuration remediation. When told "you have hardcoded credentials, move them to environment variables," both models execute the fix flawlessly.

---

## Net Security: The Metric That Actually Matters

The most useful metric isn't vulnerability rate or fix rate in isolation — it's the **net security position** after a full generation + remediation cycle.

| Model              | Initial Vuln Rate | Fix Rate | **Net Remaining** | **Rank Change**   |
| ------------------ | ----------------- | -------- | ----------------- | ----------------- |
| **Opus 4.6**       | 65.0%             | 60.4%    | **25.7%**         | ⬆️ 4th → **1st**  |
| **Haiku 4.5**      | 48.6%             | 38.2%    | **30.0%**         | ⬇️ 1st → 2nd      |
| Sonnet 4.5         | 62.1%             | 36.8%    | 39.3%             | — stays 2nd tier  |
| **Gemini 2.5 Pro** | 72.9%             | 46.1%    | **39.3%**         | ⬆️ 5th → ties 3rd |
| Gemini 2.5 Flash   | 63.6%             | 33.7%    | 42.1%             | — stays 3rd tier  |

**The entire ranking inverts after remediation.** Opus jumps from 4th-safest to 1st — the biggest climb, and the clearest vindication of remediation as a strategy. Haiku drops from 1st to 2nd. And Gemini Pro — the "most dangerous" model by aggregate — climbs from 5th to tie for 3rd, matching Sonnet.

**Opus's quiet dominance:** It doesn't win generation in any category. It doesn't have the flashiest single-domain result. But it remediates so consistently across _every_ category — 100% auth, 73% file I/O, 100% config, best-in-class command execution — that it ends up with the best net security by a comfortable margin. Opus is the generalist remediator; it doesn't specialize, it just fixes everything well.

### Absolute Vulnerability Elimination

Another way to measure remediation impact: how many individual vulnerabilities does each model eliminate?

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

This isn't theoretical — the Gemini CLI's `-p` flag and the Claude CLI's `--print` flag both support scriptable, zero-context execution that can be integrated into CI/CD pipelines:

```bash
# Example: Domain-aware generation + remediation

# Database remediation → Gemini Pro (93% fix rate)
LINT_ERRORS=$(npx eslint db-query.js --format json)
if [ $? -ne 0 ]; then
  cd $(mktemp -d) && gemini -p --model gemini-2.5-pro \
    "Fix these ESLint violations: $LINT_ERRORS"
fi

# Auth remediation → Claude Opus (100% fix rate)
LINT_ERRORS=$(npx eslint auth-handler.js --format json)
if [ $? -ne 0 ]; then
  cd $(mktemp -d) && claude --print \
    "Fix these ESLint violations: $LINT_ERRORS"
fi

# JWT generation → Gemini Flash (0/7 vuln — perfect)
cd $(mktemp -d) && gemini -p --model gemini-2.5-flash \
  "Write a JWT generation function"
```

---

## What This Changes About Part 3's Conclusions

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

2. **No cross-model remediation.** We tested each model remediating its own code. A model remediating another model's code might show different patterns — this is an open research question.

3. **Category definitions are arbitrary.** "Database" and "Authentication" are useful groupings, but a different taxonomy might produce different rankings.

---

## Reproducing This Research

All category-level data was extracted from the same [overnight benchmark results](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security) used in Part 3. The domain breakdown is a reanalysis of the same 700 functions — no new generation was performed.

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite

# Run the full benchmark yourself
node benchmarks/ai-security/run-antigravity.js \
  --model=haiku-4.5,opus-4.6,sonnet-4.5,gemini-2.5-flash-cli,gemini-2.5-pro-cli \
  --iterations=7
```

---

## Conclusions

1. **Aggregate benchmarks hide domain expertise.** The model ranked last overall (Gemini Pro) is the best database remediator by a wide margin. The model ranked first (Haiku) has one of the lowest fix rates.

2. **No single model wins everywhere.** Haiku leads generation in 3/5 categories. Opus leads remediation in 3/5. Gemini Flash leads generation in 1 and ties remediation in 1. Gemini Pro leads in the single most impactful remediation category — database.

3. **Remediation inverts the ranking.** After a full generation + remediation cycle, Opus (initially 4th) becomes 1st, and Gemini Pro (initially 5th) ties for 3rd. The generation ranking is not the net security ranking.

4. **The 93% database fix rate is the benchmark's strongest signal.** No other model achieves > 67% in any single remediation category except Opus's 100% authentication fix rate (but with only 14 samples). Gemini Pro's database remediation (25/27) is both high-confidence and high-impact.

5. **Command execution remediation is unsolved.** Every model scores below 20%. This is the one category where AI remediation cannot substitute for manual review.

6. **Domain-aware model selection beats "use the best model."** Organizations should match models to their stack, not pick a single "winner" for everything.

---

📦 [Full Benchmark Results (JSON)](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security)
🔬 [Benchmark Runner Source](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/benchmarks/ai-security)
📊 [Overnight Runner Script](https://github.com/ofri-peretz/eslint-benchmark-suite/blob/main/benchmarks/ai-security/run-overnight.sh)

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**

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

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=domain-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
