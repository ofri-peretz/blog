---
devto_url: "https://dev.to/ofri-peretz/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong-5a4o"
devto_id: 3248314
title: "We Ranked 5 AI Models by Security. The Leaderboard Is Wrong."
description: "700 AI-generated functions. 5 models. The cheapest model leads the aggregate leaderboard — but one model writes perfect JWT code where the flagship fails every time, and the 'worst' model fixes 93% of database bugs. The rankings don't tell you any of this."
slug: "we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong"
canonical_url: "https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong"
published_at: "2026-02-11T08:14:59Z"
edited_at: "2026-05-25T17:30:00Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2cazqf3s2d1rj53sheya.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2cazqf3s2d1rj53sheya.png"
reading_time_minutes: 9
tags:
  - "ai"
  - "security"
  - "googleai"
  - "gemini"
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

Claude Opus generates vulnerable JWT code **every single time** — 7 out of 7 runs, always leaking sensitive user data into the token payload. Gemini Flash generates it **perfectly every single time** — 0 out of 7. Same prompt. Opposite outcomes. 100% consistency on both sides.

That's the kind of finding you miss when you rank AI models by a single number.

We benchmarked **700 AI-generated functions** across **5 models from Gemini and Claude** — 7 iterations per prompt, 20 security-critical tasks, 332 ESLint rules. The aggregate leaderboard says the cheapest model is the safest and both Gemini models are the worst. Then we looked at the data by domain — and the leaderboard fell apart.

> This is Part 3 of the [AI Security Benchmark Series](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities). Parts 1-2 established a 65-75% vulnerability baseline using Claude-only models. Here, we expand to Google's Gemini models — and the picture changes entirely.

---

## TL;DR

| Model                | Vuln Rate | 95% CI          | Remediation Fix Rate |
| -------------------- | --------- | --------------- | -------------------- |
| **Claude Haiku 4.5** | **49%**   | [40.4% - 56.8%] | 38%                  |
| Claude Sonnet 4.5    | 62%       | [53.9% - 69.8%] | 37%                  |
| Gemini 2.5 Flash     | 64%       | [55.3% - 71.1%] | 34%                  |
| Claude Opus 4.6      | 65%       | [56.8% - 72.4%] | **60%**              |
| **Gemini 2.5 Pro**   | **73%**   | [65.0% - 79.5%] | **47%** 🥈           |

**χ² = 18.43, p < 0.05 — the differences are statistically significant.**

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

Infrastructure: Claude CLI v2.1.32 (`--no-session-persistence`), Gemini CLI v0.27.3 (`-p` from empty temp dir). Both providers ran in parallel overnight with rate limiting.

---

## The Aggregate Results

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

If the story ended here, you'd conclude Haiku wins and Gemini loses. But look at what happens when you break this down by domain.

---

## The Real Story: What Aggregate Rankings Hide

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

### Gemini Flash: Configuration Security and Perfect JWT Generation

**21% vulnerability rate in Configuration** — the lowest of any model in any category. Gemini Flash consistently reads from `process.env` instead of using placeholder credentials, producing genuinely production-safe config patterns. In a category where even the best Claude model (Sonnet/Opus at 25%) leaves room for improvement, Flash does better.

Three of Flash's prompts produced **zero vulnerabilities across all 7 iterations**:

| Prompt             | Flash (Vuln/7) | Best Claude (Vuln/7) |
| ------------------ | -------------- | -------------------- |
| `generateJWT`      | **0/7** ✓      | 1/7 (Haiku)          |
| `sendEmail` config | **0/7** ✓      | 0/7 (Sonnet)         |
| `encryptData`      | **0/7** ✓      | 2/7 (Opus, Sonnet)   |

The `generateJWT` result is particularly striking. Gemini Flash generates JWT creation code with minimal payloads containing only the user ID — **perfectly clean, every single time**. Opus, the flagship Claude model, generates vulnerable JWT code with sensitive user data in every single iteration (7/7). Same prompt, opposite outcomes, 100% consistency on both sides.

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

**The model with the highest database vulnerability rate (96%) also has the highest database fix rate (93%)**. When told exactly what's wrong — "CWE-1049: Avoid `SELECT *`, enumerate explicit columns" — Gemini Pro restructures the query correctly 25 out of 27 times.

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

On five individual prompts, a Gemini model produced fewer vulnerabilities than **all three Claude models**:

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

---

## The Variance Insight: Haiku's Lead Is a Coin Flip

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

## Limitations

1. **JavaScript only.** Other languages may show different patterns.
2. **Zero-context only.** IDE-integrated tools with codebase context may differ.
3. **Gemini 2.5 models.** This benchmark used Gemini 2.5 Flash and Pro. Gemini 3 models are now available — future benchmarks will include them.
4. **ESLint coverage.** Detection limited to 332 rules. Logic errors, race conditions, and business logic flaws are not counted.
5. **CLI vs API.** CLIs may apply different system prompts vs. direct API access. We chose CLIs for zero-context isolation.
6. **Disclosure.** The Interlace ESLint Ecosystem is developed by the author. All scripts and results are open source.

---

## Conclusions

1. **Aggregate rankings are misleading.** Claude Haiku has the lowest overall vulnerability rate (49%), but this comes from simpler code and high output variance — not deeper security expertise.

2. **Gemini models lead where complexity matters.** Gemini Flash produces the safest Configuration code of any model (21%) and generates perfect JWT code where Opus fails every time. Gemini Pro produces the safest File I/O code (86%), fixes 93% of database vulnerabilities, and is the #2 remediator overall (47%). These strengths are invisible in aggregate rankings.

3. **The best generator ≠ the best fixer.** The optimal pipeline uses different models at different stages — generating with one, fixing with another.

4. **Variance is the hidden variable.** Haiku's lead comes from randomness, not expertise. Gemini Pro and Opus are more deterministic — what you test is what you get.

5. **Static analysis is still the biggest lever.** Even the safest model generates vulnerable code half the time. [Automated security analysis](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) reduces risk more than model selection alone.

6. **Domain-level analysis changes everything.** [Part 4](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) breaks these results down by security domain — and reveals even more dramatic differences that flip the aggregate rankings entirely.

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

**The Interlace ESLint Ecosystem**
332+ security rules. 18 specialized plugins. 100% OWASP Top 10 coverage.

## [Explore the Documentation](https://eslint.interlace.tools)

---

**In the AI Security Benchmark Series:**

- **Part 1:** [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — Establishes the baseline vulnerability rate
- **Part 2:** [The AI Hydra Problem: Fix One AI Bug, Get Two More](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) — Tests whether remediation converges
- **Part 3:** We Ranked 5 AI Models by Security. The Leaderboard Is Wrong. ← _You are here_ — Validates at scale across providers
- **Part 4:** [Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain.](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) — Domain-specific deep-dive

**Follow [@ofri-peretz](https://dev.to/ofri-peretz) to get notified when the next chapter drops.**

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=700-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
