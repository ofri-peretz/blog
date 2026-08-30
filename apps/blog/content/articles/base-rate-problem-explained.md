---
devto_url: "https://dev.to/ofri-peretz/the-base-rate-problem-why-95-precision-means-nothing-without-context-29ik"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/base-rate-problem-explained-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/base-rate-problem-explained.jpg?v=b2"
title: "The Base Rate Problem: Why 95% Precision Means Nothing Without Context"
description: "A test that scores 95% precision on a balanced sample can be right under 2% of the time when the thing it hunts is rare. That's not a bug in the arithmetic — it's the base rate problem, and it's why benchmark conditions rarely predict field behavior."
slug: "base-rate-problem-explained"
tier: "T0"
series: "Foundations"
arc: 3
published: true
date: 2026-07-17
published_at: "2026-07-18T23:34:23.463Z"
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
devto_id: 4176288
canonical_url: https://ofriperetz.dev/articles/base-rate-problem-explained
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A test can be 95% accurate and still be wrong most times it fires. That is not a lie hiding in the number or a trick of arithmetic — it is the most common way a measurement taken under test conditions misleads a decision made in the field. Radiologists meet it in cancer screening, fraud teams in payments, investors every time a screen surfaces a hundred "bargains" and hands back mostly traps.

The decisive variable is the **base rate** — how rare the thing you are hunting actually is in the pile you are searching. Change it and the answer changes without touching the detector at all. That is the whole problem in one line: **a benchmark number is a ceiling, not a forecast.**

The gap is not hypothetical. A detector that scores near-perfect precision on a balanced benchmark can throw a wall of false alarms the moment it meets real, mostly-clean data — a pattern I have documented in my own security tooling ([the FP-tax benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark)). Nothing about the detector changed between the two settings. Only the base rate did.

**Skip to:** [The math](#the-math) | [Why balanced test sets](#why-balanced-fixtures) | [Where it hits hardest](#where-it-hits) | [Two numbers you need](#two-numbers) | [Quick reference](#quick-reference)

---

## The math, stated plainly {#the-math}

Precision on a balanced test answers one question: "when the detector fires, how often is it right — at the base rate baked into the test?" It does not answer the question you actually care about: "when it fires in the field, how often is it right?" The distance between those two answers is the base rate.

**Scenario A — the trial.** A screening test is validated on a balanced set: 50 cases with the condition, 50 without. Base rate = 50%. At 90% sensitivity (it catches 45 of the 50 real cases) and a 5% false-positive rate (it flags 2.5 of the 50 healthy ones), precision = 45 / 47.5 = **94.7%** — rounds to 95%, looks excellent.

**Scenario B — the clinic.** The same test, unchanged, now screens 100,000 people from a population where 1 in 1,000 truly has the condition — 100 sick, 99,900 healthy.

- True positives: 100 × 0.90 = **90**
- False positives: 99,900 × 0.05 = **4,995**
- Share of positive results that are real: 90 / 5,085 = **under 2%**

A test that looked 95% reliable in the trial is right less than 2% of the time in the clinic. Its sensitivity is identical. Its false-positive rate is identical. The only thing that changed is the base rate — how common the condition is in the room.

This is Bayes' theorem applied to detection:

> **P(real | flag) = sensitivity × base_rate / (sensitivity × base_rate + FP_rate × (1 − base_rate))**

It is the same result that ambushes every new medical student: a test that is 99% accurate for a disease affecting 1 in 1,000 people flags far more healthy patients than sick ones, because the 999 healthy people each carry a small false-positive chance and collectively swamp the handful who are actually ill. Epidemiologists named this **base-rate neglect** long before detection tooling existed; every field that runs a detector re-discovers it the hard way.

The exact field number depends on the detector's real false-positive rate, but the structure does not: any non-zero rate, multiplied across a large population of true negatives, overwhelms a handful of true positives.

---

## Why balanced test sets exist {#why-balanced-fixtures}

If balanced tests mislead, why run them? Because they measure something real and worth isolating: whether a detector _can_ tell a true case from a convincing look-alike, independent of how common the case is. A drug trial enriches for sick patients; a benchmark uses a 50/50 corpus; both trade realism for a clean read on discrimination.

A balanced precision of 95% — or even 100% — is therefore a **ceiling claim, not a field claim.** It is genuinely useful for comparing two detectors head-to-head: a tool that scores 50% on a balanced set has a discrimination problem no base rate will fix. But it was never a promise about what lands in your inbox. (It is also the number most likely to get quoted out of context — including by me, on an off day.) The honest move is to publish two results: one balanced set to measure the ceiling, and one realistic run against messy real-world data to show how close the field comes to it. A benchmark that reports only its balanced number is telling you half the story.

---

## Where it hits hardest {#where-it-hits}

The base rate bites hardest wherever the thing you hunt is genuinely rare and the cost of missing it tempts you to cast a wide net.

**Value investing.** Every value investor learns the difference between a stock that looks cheap and one that is cheap — and the gap between them is just the base rate of how often "cheap" means "broken." No amount of conviction in the screen moves that number. A filter that surfaces 200 "undervalued" names in a market where genuine mispricings are rare hands back mostly value traps, not bargains — the disease-test arithmetic, wearing a ticker symbol.

**Rare-event security.** The same trap shows up in software security. A credential-scanning rule once fired hundreds of times on a well-maintained open-source codebase whose real count of leaked secrets was zero — a base rate so near zero that any non-zero false-positive rate made the rule wrong every time it spoke ([full write-up](https://dev.to/ofri-peretz/my-credential-rule-reported-842-secrets-in-vercelai-the-real-count-was-0-249p), [rule design](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough)). Same rule, different base rate — Scenario B at a more extreme magnitude.

---

## The two numbers you actually need {#two-numbers}

Any honest evaluation of a detector needs two numbers, not one.

**1. Precision on a balanced test** — the discrimination ceiling: can it tell a true case from a look-alike when both appear equally often? A benchmark measures this reliably, and it is the right number for comparing detectors head-to-head.

**2. False-positive rate on realistic data** — what actually sets the field experience: at the base rate you truly face, what fraction of alarms are real? This means measuring the detector on a realistic population and counting. If someone hands you only the first number, ask for the second before you trust the first.

Neither number alone tells the story. A detector with 99% balanced precision but a 1% field false-positive rate is useless on a 0.01% base rate — the Scenario B collapse. One with 80% balanced precision and a 0.01% false-positive rate is far more actionable, even though it loses the balanced comparison. Rank on the second number when you can get it; the first is a screening filter, not the verdict.

The math also hands you one lever. You cannot polish a detector out of a base-rate problem — its false-positive rate has a floor — but you can raise the base rate by narrowing what you look at. Point the test only at the high-risk subgroup, and it reports far cleaner: a higher base rate lifts precision without improving the detector at all.

For the underlying TP / FP / FN / TN definitions, see the [confusion matrix reference](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn).

---

## Quick reference {#quick-reference}

| Setting             | Base rate | Balanced-test precision | Real-world precision |
| ------------------- | --------- | ----------------------- | -------------------- |
| Balanced test set   | 50%       | 95%                     | ~95%                 |
| Uncommon condition  | 1%        | 95%                     | ~15%                 |
| Rare condition      | 0.1%      | 95%                     | ~2%                  |
| Very rare condition | 0.01%     | 95%                     | ~0.2%                |

Row 1 is the test condition: at a 50% base rate, field precision equals the measured benchmark precision by definition. Rows 2–4 apply Bayes' theorem with 90% sensitivity and a 5% false-positive rate held constant across all four rows — only the base rate moves. The collapse from 95% to 0.2% comes entirely from that one column. Your detector's real numbers depend on its actual false-positive rate.

**The formula:**

```
P(real | flag) =
    sensitivity × base_rate
    ─────────────────────────────────────────────────────
    sensitivity × base_rate + FP_rate × (1 − base_rate)
```

Where:

- **sensitivity** (recall) = true positive rate — the fraction of real cases the detector catches (e.g., 0.90)
- **base_rate** = fraction of the searched population that truly has the condition
- **FP_rate** = false-positive rate — the fraction of true negatives the detector wrongly flags

**Named misconception:**

> "High precision on a benchmark means few false positives in the field."

The honest version: high precision on a balanced benchmark means the detector **can** discriminate — a ceiling on what is possible. Field behavior depends on the base rate of what you are hunting, which a balanced benchmark deliberately hides. The ceiling and the floor can sit very far apart.

---

## References

1. Kahneman, D. (2011). _Thinking, Fast and Slow_. Farrar, Straus and Giroux. Chapter 16 covers base rate neglect — the cognitive failure mode that makes this problem invisible even to people who know the math.

2. Bayes, T., & Price, R. (1763). [An essay towards solving a problem in the doctrine of chances](https://doi.org/10.1098/rstl.1763.0053). _Philosophical Transactions of the Royal Society_, 53, 370–418. The original formulation, available in full from JSTOR.

3. Fawcett, T. (2006). [An introduction to ROC analysis](https://doi.org/10.1016/j.patrec.2005.10.010). _Pattern Recognition Letters_, 27(8), 861–874. Section 7 on class imbalance covers this same mechanism in machine-learning framing — the math is identical.

4. Saito, T., & Rehmsmeier, M. (2015). [The precision-recall plot is more informative than the ROC plot when evaluating binary classifiers on imbalanced datasets](https://doi.org/10.1371/journal.pone.0118432). _PLOS ONE_, 10(3), e0118432. The direct argument for why precision-recall curves matter more than ROC on imbalanced data — where a low base rate does its damage.

5. Ioannidis, J. P. A. (2005). [Why most published research findings are false](https://doi.org/10.1371/journal.pmed.0020124). _PLOS Medicine_, 2(8), e124. The base rate problem applied to entire research literatures: when the prior probability of a true hypothesis is low, even well-powered studies produce mostly false positives — the closest prior art for what a low base rate does to any detector, statistical test, or screen.

---

_Foundations series: ← [Precision, Recall, F1](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) · [hub](https://ofriperetz.dev/foundations) · [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement) →_

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · [npm](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
