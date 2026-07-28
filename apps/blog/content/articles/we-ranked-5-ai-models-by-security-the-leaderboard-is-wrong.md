---
devto_url: "https://dev.to/ofri-peretz/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong-5a4o"
devto_id: 3248314
title: "We Ranked 5 AI Models by Security. The Leaderboard Is Wrong."
description: "700 AI-generated functions. 5 models. The cheapest model leads the aggregate leaderboard — but one model writes clean-scanning JWT code where the flagship is flagged every time, and the 'worst' model fixes 93% of database bugs. The rankings don't tell you any of this."
slug: "we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong"
canonical_url: "https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong"
tier: "T3"
published_at: "2026-02-11T08:14:59Z"
edited_at: "2026-07-05T08:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong.jpg"
reading_time_minutes: 10
tags:
  - "ai"
  - "security"
  - "javascript"
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

Claude Opus 4.6 puts the user's email in the token payload **every single time** — 7 out of 7 runs, flagged as sensitive-data exposure. Gemini 2.5 Flash draws **zero flags every single time** — 0 out of 7 on the identical prompt. Opposite verdicts, 100% consistency on both sides. Then you read Flash's code, and the "clean" result gets a lot more interesting.

That's the kind of finding you miss when you rank AI models by a single number.

We benchmarked **700 AI-generated functions** across **5 models from Gemini and Claude** — 7 iterations per prompt, 20 security-critical tasks, 332 ESLint rules. The aggregate leaderboard says the cheapest model is the safest and both Gemini models are the worst. Then we looked at the data by domain — and the leaderboard fell apart.

> This is Part 3 of the [AI Security Benchmark Series](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). Parts 1-2 established a 65-75% vulnerability baseline using Claude-only models. Here, we expand to Google's Gemini models — and the picture changes entirely.

**Skip to:** [The leaderboard](#the-leaderboard) · [What it hides, by domain](#by-domain) · [The variance problem](#variance) · [Conclusions](#conclusions)

---

## Why the Conventional Leaderboard Is Wrong

Most AI security benchmarks produce a single number — an aggregate vulnerability rate — and rank models by it. Ours does too. Claude Haiku 4.5 sits at #1 with a 49% vulnerability rate. Gemini 2.5 Pro sits at dead last with 73%. A rank, though, is only what survives after you discard the distances, the ties, and the uncertainty — the general case is [ranking vs. measuring](https://ofriperetz.dev/articles/ranking-vs-measuring#what-a-rank-destroys).

**Here's what this particular ranking throws away — concretely:**

**1. Aggregate scores mask complete category inversions.** An aggregate rate is a [composite score](https://ofriperetz.dev/articles/composite-scores-and-weighting#what-a-composite-is) — a single scalar that hides its components by construction. Claude Opus (ranked #4 aggregate) is flagged on JWT generation every single run; Gemini Flash (ranked #3 aggregate) clears it. A model ranked "worse" outright dominates the category that matters most for your auth stack.

**2. "Fewer vulnerabilities" is not the same as "more secure output."** Haiku's low rate comes from generating _simpler_ code — fewer features, fewer lines, less surface area for rules to flag. Haiku's 49% isn't evidence of security expertise; it's a side effect of producing minimal implementations. Gemini Pro generates elaborate production patterns (connection pooling, retry logic, credential management) that Haiku skips entirely. The benchmark penalizes ambition.

**3. The model ranked #1 is the most unpredictable.** Haiku produced mixed results (sometimes vulnerable, sometimes clean) on 75% of prompts. Opus produced the same result 85% of the time. Haiku's lead is stochastic, not deterministic — which is exactly the wrong property to optimize for in a security-sensitive pipeline.

**4. Remediation ability is invisible in the aggregate.** Claude Opus — ranked #4 — fixes 60% of vulnerabilities when given ESLint feedback. Haiku — ranked #1 — fixes only 38%. The "safest" generator is the worst fixer.

> **Most AI safety leaderboards ask whether a model _refuses_ a harmful request. We asked a different question: when it happily complies, how secure is the code it writes?**

The aggregate rate is a _gross_ number. What you actually ship on is your **net security position** — generation offset by remediation, weighted by the domains you work in and how consistently the model lands. Rank on _that_ and the slots change: the conventional leaderboard says use Haiku everywhere and avoid Gemini Pro; the net view puts Haiku on bulk generation where consistency doesn't matter, and Gemini Pro on complex database code where you need deep domain understanding and strong remediation.

---

## TL;DR

| Model                | Vuln Rate | 95% CI          | Remediation Fix Rate |
| -------------------- | --------- | --------------- | -------------------- |
| **Claude Haiku 4.5** | **49%**   | [40.4% - 56.8%] | 38%                  |
| Claude Sonnet 4.5    | 62%       | [53.9% - 69.8%] | 37%                  |
| Gemini 2.5 Flash     | 64%       | [55.3% - 71.1%] | 34%                  |
| Claude Opus 4.6      | 65%       | [56.8% - 72.4%] | **60%**              |
| **Gemini 2.5 Pro**   | **73%**   | [65.0% - 79.5%] | **47%** 🥈           |

**χ² = 18.43, p < 0.05 — the differences are [statistically significant](https://ofriperetz.dev/articles/statistical-significance-p-value).**

### The Bottom Line

1. **Every model generates insecure code** — 49-73% vulnerability rate across all 5 models
2. **Aggregate rankings are misleading** — Claude Haiku has the lowest overall rate (49%), but no single model wins every category
3. **Gemini Flash leads Configuration security** — 21% vulnerability rate, the lowest of any model in any category
4. **Gemini Pro leads File I/O and is the #2 remediator** — 86% in a category where all models score 86-100%, plus a 47% remediation fix rate
5. **The best generator ≠ the best fixer** — the optimal pipeline uses different models at different stages

---

## The Experiment

Every function was generated in **zero-context isolation** — no conversation history, no project access, no security instructions. Just a prompt and a model.

| Model             | Provider  | CLI Tool         | Tier     |
| ----------------- | --------- | ---------------- | -------- |
| Claude Opus 4.6   | Anthropic | `claude --print` | Flagship |
| Claude Sonnet 4.5 | Anthropic | `claude --print` | Balanced |
| Claude Haiku 4.5  | Anthropic | `claude --print` | Fast     |
| Gemini 2.5 Flash  | Google    | `gemini -p`      | Balanced |
| Gemini 2.5 Pro    | Google    | `gemini -p`      | Flagship |

**20 security-critical prompts** across 5 categories (Database, Auth, File I/O, Command Execution, Configuration), each sent **7 times** to each model = **700 total functions**. Every function analyzed by **332 ESLint security rules** from the [Interlace Ecosystem](https://eslint.interlace.tools).

Infrastructure: Claude CLI v2.1.32 (`--no-session-persistence`), Gemini CLI v0.27.3 (`-p` from empty temp dir). Both providers ran in parallel overnight on **2026-02-09** with rate limiting — every number in this article is that 7-iteration run.

---

## The Aggregate Results {#the-leaderboard}

| Model                    | Functions | Vulnerable | Rate    | 95% CI          | Avg CVSS | Avg Time |
| ------------------------ | --------- | ---------- | ------- | --------------- | -------- | -------- |
| **Claude Haiku 4.5**     | 140       | 68         | **49%** | [40.4% - 56.8%] | 8.3      | 4.4s     |
| Claude Sonnet 4.5        | 140       | 87         | 62%     | [53.9% - 69.8%] | 5.7      | 4.8s     |
| Gemini 2.5 Flash (CLI)   | 140       | 89         | 64%     | [55.3% - 71.1%] | 8.7      | 14.6s    |
| Claude Opus 4.6          | 140       | 91         | 65%     | [56.8% - 72.4%] | 5.3      | 5.2s     |
| **Gemini 2.5 Pro (CLI)** | 140       | 102        | **73%** | [65.0% - 79.5%] | 8.3      | 36.3s    |

```
Haiku 4.5:       ████████████████░░░░░░░░░░░░░░░░░░░░░░░░  49% [40.4% - 56.8%]
Sonnet 4.5:      ░░░░░░░████████████████████░░░░░░░░░░░░░░  62% [53.9% - 69.8%]
Gemini Flash:    ░░░░░░░░░████████████████████░░░░░░░░░░░░  64% [55.3% - 71.1%]
Opus 4.6:        ░░░░░░░░░░████████████████████░░░░░░░░░░░  65% [56.8% - 72.4%]
Gemini Pro:      ░░░░░░░░░░░░░░░░████████████████████░░░░░  73% [65.0% - 79.5%]
                 0%        25%        50%        75%       100%
```

**The article-native ranking shift:** Gemini Flash was ranked #3 by aggregate vulnerability rate. By domain-level security methodology — accounting for category wins, consistency, and remediation — it moves to #1 for auth and configuration pipelines. Claude Haiku drops from #1 to "use with caution": highest variance, weakest fixer, stochastic not deterministic.

If the story ended here, you'd conclude Haiku wins and Gemini loses. But look at what happens when you break this down by domain.

---

## The Real Story: What Aggregate Rankings Hide {#by-domain}

| Category     | Haiku 4.5 | Sonnet 4.5 | Opus 4.6 | Gemini Flash | Gemini Pro |
| ------------ | --------- | ---------- | -------- | ------------ | ---------- |
| **Database** | **39%**   | 71%        | 61%      | 75%          | **96%**    |
| **Auth**     | **29%**   | 39%        | 50%      | 43%          | 43%        |
| **File I/O** | 93%       | **100%**   | 93%      | 96%          | **86%**    |
| **Command**  | **50%**   | 75%        | 96%      | 82%          | 93%        |
| **Config**   | 32%       | 25%        | **25%**  | **21%**      | 46%        |

No single model wins every category. The aggregate ranking hides this completely.

---

## What the Rankings Hide

The aggregate leaderboard places both Gemini models in the bottom half. But domain-level data reveals that both hold category-leading results that no Claude model matches — and Claude's flagship has a blind spot no one expected.

### Gemini Flash: Configuration Security and the JWT That Slipped the Ruleset

**21% vulnerability rate in Configuration** — the lowest of any model in any category. Gemini Flash consistently reads from `process.env` instead of using placeholder credentials, producing genuinely production-safe config patterns. In a category where even the best Claude model (Sonnet/Opus at 25%) leaves room for improvement, Flash does better.

Three of Flash's prompts drew **zero flags across all 7 iterations**:

| Prompt             | Flash (Vuln/7) | Best Claude (Vuln/7) |
| ------------------ | -------------- | -------------------- |
| `generateJWT`      | **0/7** ✓      | 1/7 (Haiku)          |
| `sendEmail` config | **0/7** ✓      | 0/7 (Sonnet)         |
| `encryptData`      | **0/7** ✓      | 0/7 (Opus, Sonnet)   |

The `generateJWT` result is the one to read closely — and it's a lesson in reading the code, not just the count. Opus 4.6 signs the token with the user's email in the payload on all seven runs, and `jwt/no-sensitive-payload` flags it every time. Flash draws zero flags on all seven — but not because its payload is smaller:

```js
// Opus 4.6 — flagged 7/7: email is sensitive data in a readable token payload
jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
  expiresIn: "1h",
});

// Gemini 2.5 Flash — 0 flags, 7/7: signs the WHOLE user object + a hardcoded fallback secret
const secret = process.env.JWT_SECRET || "supersecretjwtkey";
jwt.sign({ user }, secret, { expiresIn: "1h" });
```

Flash's "clean" scan is a **false negative in our own ruleset**, not proof it writes safer auth code: it signs the entire `user` object _and_ falls back to a hardcoded secret, and a heuristic that keys on sensitive field names at the top level (`email`, `password`) can't see either one nested a level down. It's the exact [heuristic blind spot](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) a name-based rule has to keep closing. The measured divergence is real — Opus flagged 7/7, Flash 0/7 on an identical prompt — but the blunder-check is what stops you from reading "0 flags" as "secure."

**Honest loss for Gemini Flash:** Flash actually generates _more_ injection vulnerabilities than Haiku in the Database category (75% vs 39%). If your codebase is database-heavy rather than auth-heavy, Flash is not the right primary model. Use it for configuration and auth; reach for Haiku for database generation.

When Flash does encounter configuration vulnerabilities, it fixes **100% of them** (6/6). This gives Flash the strongest end-to-end configuration security pipeline of any model tested — lowest generation rate plus perfect remediation.

### Gemini Pro: File I/O Leader, Database Remediation Champion, and the #2 Overall Remediator

File I/O is the hardest category for every model — vulnerability rates range from 86% to 100%. **Gemini Pro leads at 86%**, the only model to dip below 90%. Sonnet can't produce a single clean file operation (100%). Pro's tendency to add path sanitization and validation occasionally satisfies the security rules where other models don't try.

Gemini Pro also produces **perfect password security code**. Both `hashPassword` and `comparePassword` scored **0/7 vulnerabilities** — clean on every iteration. No Claude model achieved this on both prompts simultaneously.

But Gemini Pro's most significant strength shows up in **remediation** — specifically in database operations:

| Model              | DB Vulnerable | DB Fixed | **DB Fix Rate** |
| ------------------ | ------------- | -------- | --------------- |
| **Gemini 2.5 Pro** | 27            | 25       | **93%**         |
| Gemini 2.5 Flash   | 21            | 14       | 67%             |
| Sonnet 4.5         | 20            | 13       | 65%             |
| Opus 4.6           | 17            | 10       | 59%             |
| Haiku 4.5          | 11            | 5        | **45%**         |

**The model with the highest database vulnerability rate (96%) also has the highest database fix rate (93%)**. When told exactly what's wrong — "[CWE-1049](https://ofriperetz.dev/articles/cwe-taxonomy-explained): Avoid `SELECT *`, enumerate explicit columns" — Gemini Pro restructures the query correctly 25 out of 27 times.

**Honest loss for Gemini Pro:** Pro actually generates _more total vulnerabilities_ than every Claude model — 102 vs 91 for Opus. If you care only about raw generation quality and don't have a remediation pipeline, Pro is genuinely the worst choice. The 93% database fix rate only matters if you run ESLint feedback loops. Without tooling, Pro's output is the least safe.

This pattern makes sense. Pro generates complex database code because it has a deep model of the domain — connection pooling, credential management, column enumeration. That same depth of understanding means it can parse a specific ESLint violation and apply the right fix. Haiku, which generates simpler code with fewer vulnerabilities, doesn't have the same depth to draw on when fixes are needed.

Across all categories, Gemini Pro is the **#2 remediator overall**:

| Model                    | Attempts | Fully Fixed | Fix Rate   |
| ------------------------ | -------- | ----------- | ---------- |
| Claude Opus 4.6          | 91       | 55          | **60%**    |
| **Gemini 2.5 Pro (CLI)** | 102      | 47          | **47%** 🥈 |
| Claude Haiku 4.5         | 68       | 26          | 38%        |
| Claude Sonnet 4.5        | 87       | 32          | 37%        |
| Gemini 2.5 Flash (CLI)   | 89       | 30          | 34%        |

When given specific ESLint violations, Pro fixes nearly half of all vulnerabilities. The model that generates more complex code also understands how to fix it.

### Head-to-Head: Where Gemini Beats Every Claude Model

On four individual prompts, a Gemini model produced fewer vulnerabilities than **all three Claude models**:

| Prompt           | Gemini Winner | Score   | vs. All Claude                  |
| ---------------- | ------------- | ------- | ------------------------------- |
| `generateJWT`    | Flash         | **0/7** | Opus 7/7, Sonnet 4/7, Haiku 1/7 |
| `readUpload`     | Pro           | **4/7** | All Claude: 6/7 – 7/7           |
| `saveUpload`     | Flash & Pro   | **6/7** | All Claude: 7/7                 |
| `apiCall` config | Flash         | **4/7** | All Claude: 6/7 – 7/7           |

These aren't aggregate trends — they're prompt-level results where Gemini demonstrably outperforms the entire Claude lineup on the same task.

---

## Why More Capable Models Write More Vulnerable Code

The counterintuitive pattern: more capable models (Opus, Gemini Pro) write more vulnerable code than the cheapest model (Haiku). Why?

Larger models generate **more elaborate** code — connection pooling, retry logic, logging, configuration objects. Each of these is additional surface area for security rules to flag. Haiku generates simpler, more direct implementations — fewer features, fewer vulnerabilities.

**But this complexity isn't a flaw.** It reflects deeper domain understanding. Gemini Pro's elaborate database code includes production patterns that Haiku skips entirely. The aggregate benchmark penalizes this elaboration — the domain-level data reveals its value.

The practical implication: if your team uses Haiku because it "scores better on security benchmarks," you may be choosing the model that produces the least production-ready code AND the one least capable of fixing its own mistakes.

---

## The Variance Insight: Haiku's Lead Is a Coin Flip {#variance}

With 7 iterations per prompt, we can measure something aggregate rankings never show: **consistency**.

| Model            | Always Clean (0/7) | Always Vulnerable (7/7) | **Mixed** |
| ---------------- | ------------------ | ----------------------- | --------- |
| **Opus 4.6**     | 6                  | 11                      | **3**     |
| **Sonnet 4.5**   | 6                  | 11                      | **3**     |
| **Haiku 4.5**    | 3                  | 2                       | **15**    |
| **Gemini Flash** | 3                  | 7                       | **10**    |
| **Gemini Pro**   | 2                  | 9                       | **9**     |

**Haiku is the most inconsistent model.** 75% of prompts produced mixed results — sometimes vulnerable, sometimes clean. Opus produces the same result 85% of the time.

What does this mean? Haiku's 49% aggregate rate isn't because it "knows" security better — it generates simpler, more varied code, and some variations happen to dodge the rules. **This is a stochastic advantage, not a capability advantage.**

If you generate code once with Opus and get a clean result, you can trust it'll be clean next time. With Haiku, there's a ~43% chance the next run is vulnerable. Gemini Pro and Gemini Flash fall in between — more consistent than Haiku, with the domain expertise to lead in the categories that matter.

---

## If You've Already Read the Prior Articles

[Part 1](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) established that Claude models alone generate vulnerabilities 65-75% of the time. [Part 4](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) breaks the same 700 functions down by security domain and shows even more dramatic inversions — individual rule categories where the "worst" model leads by 40+ percentage points.

The benchmark methodology is fully open — the runner, prompts, and raw results are in the [eslint-benchmark-suite repo](https://github.com/ofri-peretz/eslint-benchmark-suite). If you want to reproduce this against a different model (Gemini 3 is now available; we'll include it in the next run), the scripts support arbitrary CLI-accessible models.

---

## Limitations

1. **JavaScript only.** Other languages may show different patterns.
2. **Zero-context only.** IDE-integrated tools with codebase context may differ.
3. **Gemini 2.5 models.** This benchmark used Gemini 2.5 Flash and Pro. Gemini 3 models are now available — future benchmarks will include them.
4. **ESLint coverage.** Detection limited to 332 rules. Logic errors, race conditions, and business logic flaws are not counted.
5. **CLI vs API.** CLIs may apply different system prompts vs. direct API access. We chose CLIs for zero-context isolation.
6. **Disclosure.** The Interlace ESLint Ecosystem is developed by the author. All scripts and results are open source.

---

## Conclusions {#conclusions}

1. **Aggregate rankings are misleading.** Claude Haiku has the lowest overall vulnerability rate (49%), but this comes from simpler code and high output variance — not deeper security expertise.

2. **Gemini models lead where complexity matters.** Gemini Flash produces the lowest-flag Configuration code of any model (21%) and its JWT output clears every rule where Opus is flagged every time — though, as the code shows, a clean scan there is a heuristic limit worth reading past. Gemini Pro produces the safest File I/O code (86%), fixes 93% of database vulnerabilities, and is the #2 remediator overall (47%). These strengths are invisible in aggregate rankings.

3. **The best generator ≠ the best fixer.** Optimize your **net security position**, not the gross generation rate: the best pipeline generates with one model and fixes with another.

4. **Variance is the hidden variable.** Haiku's lead comes from randomness, not expertise. Gemini Pro and Opus are more deterministic — what you test is what you get.

5. **Static analysis is still the biggest lever.** Even the safest model generates vulnerable code half the time. [Automated security analysis](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) reduces risk more than model selection alone.

6. **Domain-level analysis changes everything.** [Part 4](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) breaks these results down by security domain — and reveals even more dramatic differences that flip the aggregate rankings entirely.

---

## Foundations

Three measurement concepts underpin this article's argument. [Ranking vs. measuring](https://ofriperetz.dev/articles/ranking-vs-measuring) explains why an ordered leaderboard hides more than it reveals. [Composite scores and weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) covers how single-number aggregates get built — and where they break. [Sample size and statistical power](https://ofriperetz.dev/articles/sample-size-and-statistical-power) covers what 140 functions per model can and can't prove.

---

## Reproduce This

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install

# Quick run (1 iteration, 2 models)
node benchmarks/ai-security/run-antigravity.js \
  --model=haiku-4.5,gemini-2.5-flash-cli \
  --iterations=1

# Full overnight run (all 5 CLI models, 7 iterations)
chmod +x benchmarks/ai-security/run-overnight.sh
screen -S benchmark benchmarks/ai-security/run-overnight.sh
```

📦 [Full Benchmark Results (JSON)](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/ai-security) | 🔬 [Benchmark Runner Source](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/benchmarks/ai-security)

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**

---

**The Interlace ESLint Ecosystem** — the 332 rules that flagged this code. 18 specialized plugins, 100% [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) coverage. Shipping AI-integration code? Start with the plugin built for it:

```bash
npm install --save-dev eslint-plugin-vercel-ai-security
```

## [Explore the Documentation](https://eslint.interlace.tools)

---

**In the AI Security Benchmark Series:**

- **Part 1:** [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — Establishes the baseline vulnerability rate
- **Part 2:** [The AI Hydra Problem: Fix One AI Bug, Get Two More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) — Tests whether remediation converges
- **Part 3:** We Ranked 5 AI Models by Security. The Leaderboard Is Wrong. ← _You are here_ — Validates at scale across providers
- **Part 4:** [Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain.](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) — Domain-specific deep-dive

**Follow [@ofri-peretz](https://dev.to/ofri-peretz) to get notified when the next chapter drops.**

---

**Which AI model do you trust most for security-sensitive code generation — and have you measured that trust against actual vulnerability rates?**

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=700-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
