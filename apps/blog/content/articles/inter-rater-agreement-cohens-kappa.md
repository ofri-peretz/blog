---
devto_url: "https://dev.to/ofri-peretz/inter-rater-agreement-and-cohens-kappa-when-your-labels-are-opinions-2jdk"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/inter-rater-agreement-cohens-kappa.jpg?v=2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/inter-rater-agreement-cohens-kappa.jpg?v=2"
title: "Inter-Rater Agreement and Cohen's Kappa: When Your Labels Are Opinions"
description: "Two radiologists agreed on 92 of 100 scans. Cohen's kappa scores that at 0.16 — barely above chance. When labels are judgment calls, raw percent agreement is the wrong check. Here is the right one."
slug: "inter-rater-agreement-cohens-kappa"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
devto_id: 4176294
canonical_url: https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa
reading_time_minutes: 6
tier: "T0"
series: "Foundations"
arc: 10
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Two radiologists read the same 100 screening mammograms, each marking every scan "clear" or "suspicious." They agree on 92 of them. Cohen's kappa scores that agreement at **0.16** — one band above "no better than chance."

Here is the arithmetic that makes both numbers true at once. Suppose each radiologist calls 95 of the 100 scans "clear" — a normal rate in screening, where the disease is rare. Two people labeling at those frequencies *at random* would agree about 90.5% of the time. No shared standard, no second read, no skill: 90.5% agreement, free. The impressive-looking 92% sits one and a half points above what indifference produces.

So, the misconception this article exists to retire: **"90% agreement means the raters agree."** It doesn't — not until you subtract the agreement that chance hands out for free.

The distinction matters anywhere labels come from judgment rather than fact. A knockout is a fact; you can settle it from the video. Who won a close round is an opinion — which is why three judges score it, and why they sometimes disagree. Facts and opinions need different honesty checks, and Cohen's κ is the check for opinions.

---

## Why Isn't 90% Agreement Enough? {#why-agreement}

Every measurement pipeline stands on labels. Spam or not spam, malignant or benign, fraud or legitimate, guilty or acquitted — before any accuracy or F1 score exists, someone (a person, an instrument, a model) assigned those labels. If the labeling is unreliable, every metric computed downstream of it is decoration. The naive reliability check — percent agreement between two labelers — fails in exactly the situations where you need it most.

Two quantities separate the honest check from the naive one:

- **Observed agreement (p_o)** — the fraction of items both raters labeled identically.
- **Chance agreement (p_e)** — the agreement you would expect if each rater kept their labeling *frequencies* but assigned labels at random.

Class imbalance is the trap. When 95% of items carry the majority label, chance agreement alone is 0.95 × 0.95 + 0.05 × 0.05 = 90.5%. Two raters can post ninety-plus percent raw agreement while their judgment on the minority class — the class you actually care about — is nearly uncorrelated. This is the same mechanism that makes accuracy meaningless for rare-event detection: when one class dominates, doing nothing scores well. The [base rate problem](https://ofriperetz.dev/articles/base-rate-problem-explained) covers that failure for detectors; percent agreement inherits it for raters.

Jacob Cohen's 1960 move was to change the question. Not "how often do they agree?" but "how much better than chance do they agree?"

## What Is Cohen's Kappa? The Formula {#kappa-formula}

```text
κ = (p_o − p_e) / (1 − p_e)
```

The numerator is the above-chance agreement the raters actually achieved. The denominator is the maximum above-chance agreement available. Kappa is the fraction of the achievable that was achieved: **1.0** means perfect agreement, **0** means exactly chance level, and negative values mean systematic *disagreement* — rarer, and usually a sign the raters are working from different definitions of the label.

Run the two radiologists through it. Their full contingency table, consistent with 92 matching reads (illustrative arithmetic, not a measured study):

|  | B: clear | B: suspicious |
|---|---|---|
| **A: clear** | 91 | 4 |
| **A: suspicious** | 4 | 1 |

- p_o = (91 + 1) / 100 = **0.92**
- p_e = (0.95 × 0.95) + (0.05 × 0.05) = **0.905**
- κ = (0.92 − 0.905) / (1 − 0.905) = 0.015 / 0.095 ≈ **0.16**

Look at where the disagreement concentrates. Each radiologist flagged five scans as suspicious; they overlapped on exactly one. On the minority class — the entire point of screening — these two "92%-agreeing" readers barely share an opinion. Kappa surfaces that; percent agreement buries it.

## How Do You Interpret a Kappa Value? {#interpreting-kappa}

The interpretation bands everyone cites come from Landis and Koch (1977): below 0 poor, up to 0.20 slight, 0.21–0.40 fair, 0.41–0.60 moderate, 0.61–0.80 substantial, 0.81–1.00 almost perfect (full table in the quick reference below).

The caveat that usually gets dropped: Landis and Koch themselves called the divisions "clearly arbitrary." The bands are conventions with fifty years of usage behind them, not statistical thresholds — nothing happens at 0.61. They function like the "weak/moderate/strong" adjectives for correlations: a shared vocabulary for communicating results, not laws for judging them. Report the κ value; use the band as a label, never as proof.

The most famous application is a demolition. Psychiatric diagnosis in the mid-20th century looked tolerably consistent as raw percent agreement. When Spitzer and Fleiss re-analyzed the field's reliability studies using kappa in 1974, agreement for most diagnostic categories landed in the unimpressive fair-to-moderate range — a result that helped push psychiatry toward the explicit diagnostic criteria of DSM-III. Subtracting chance didn't refine the picture. It changed the conclusion.

Cohen's κ handles exactly two raters and nominal labels. For more raters, missing data, or ordered scales, the standard generalization is Krippendorff's α, the workhorse reliability instrument of content analysis — the discipline that has been grading human judgment the longest. Any measurement that computes agreement today is importing that apparatus, not inventing it.

## Kappa vs Accuracy: Which One Do You Need? {#kappa-vs-accuracy}

Accuracy, precision, recall, and F1 all compare a classifier against ground truth. They presume a true label exists and that you hold it. That presumption deserves more suspicion than it gets — [ground truth in security testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing) walks through how much judgment can hide inside a label that looks like hard fact.

Kappa needs no ground truth at all. It is symmetric: it compares two raters to each other and asks only whether their judgments align beyond chance. That makes it the honest instrument for a specific situation — when no defensible true label exists.

The decision rule:

- **Fact-shaped label** (a knockout ended the fight, the card was charged twice, the biopsy came back malignant): build a labeled reference set and score precision, recall, and F1 against it.
- **Judgment-shaped label** ("too aggressive," "suspicious," "severe"): a reference set can never be more than its author's opinion written down. Measure whether *independent* judges agree instead.

Two Wall Street analysts both stamp a stock "buy," and it reads like agreement. It mostly isn't. Almost every analyst rates almost everything "buy," so landing on the same word costs them nothing — the base rate hands it over before either one has opened the filings. The rating I'd actually trust is the one where the two could easily have split and didn't: same stock, same quarter, for a reason chance didn't supply. Kappa is that suspicion turned into arithmetic — subtract the agreement the odds give away for free, and report what's left.

Putting this rule to work on a real benchmark — scoring judgment-style checks by agreement between independent tools instead of by accuracy against a corpus one person wrote — is walked through in [different metrics for different package types](https://ofriperetz.dev/articles/different-metrics-for-different-package-types).

One limit, stated plainly: kappa measures reliability, not correctness. Two raters who share a bias will agree — reliably, reproducibly, and wrong together. High κ means the label captures a shared standard rather than one person's mood; whether that standard tracks reality is a separate question no agreement statistic can answer.

The practical version of all this: find one number you publish that rests on judgment-call labels. Get a second, genuinely independent labeling of a sample — another expert, another instrument, a model you didn't build — and compute κ. If it comes back at 0.16, the metric was measuring one person's taste, and it is better to learn that before your readers do. If it comes back at 0.7, say so out loud: agreement you can show is worth more than agreement you assert.

Bookmark this for the next time someone quotes "94% agreement" at you — and if you want the rest of this measurement series as it lands, [follow me on Dev.to](https://dev.to/ofri-peretz).

---

## Quick Reference {#quick-reference}

| Quantity | Meaning |
|---|---|
| p_o | Observed agreement — fraction of items labeled identically |
| p_e | Chance agreement — expected overlap from the raters' label frequencies alone |
| κ = (p_o − p_e) / (1 − p_e) | Share of achievable above-chance agreement actually achieved |
| κ = 1 / 0 / < 0 | Perfect / chance-level / systematic disagreement |

| κ range | Landis & Koch label (convention, not law) |
|---|---|
| < 0 | Poor |
| 0.00–0.20 | Slight |
| 0.21–0.40 | Fair |
| 0.41–0.60 | Moderate |
| 0.61–0.80 | Substantial |
| 0.81–1.00 | Almost perfect |

| Situation | Right instrument |
|---|---|
| Fact-shaped label, ground truth available | Accuracy / precision / recall / F1 |
| Judgment-shaped label, two raters, nominal classes | Cohen's κ |
| More than two raters, missing data, ordered scales | Krippendorff's α |
| Raters may share a bias | κ **plus** an external validity check — agreement alone can't detect it |

---

## References

Cohen, J. (1960). [A coefficient of agreement for nominal scales](https://doi.org/10.1177/001316446002000104). *Educational and Psychological Measurement*, 20(1), 37–46. The original paper: chance-corrected agreement for two raters over nominal categories, motivated by exactly the imbalance problem in the hook.

Landis, J. R., & Koch, G. G. (1977). [The measurement of observer agreement for categorical data](https://doi.org/10.2307/2529310). *Biometrics*, 33(1), 159–174. Source of the interpretation bands — and of the in-print admission that the divisions are arbitrary.

Spitzer, R. L., & Fleiss, J. L. (1974). [A re-analysis of the reliability of psychiatric diagnosis](https://doi.org/10.1192/bjp.125.4.341). *British Journal of Psychiatry*, 125(587), 341–347. The field-changing application: chance-corrected agreement overturning conclusions that raw agreement supported.

Krippendorff, K. (2004). *[Content Analysis: An Introduction to Its Methodology](https://books.google.com/books/about/Content_Analysis.html?id=q657o3M3C8cC)* (2nd ed.). Sage. Develops α, the generalization of κ to many raters, missing data, and non-nominal scales — the reliability standard in content analysis and dataset annotation.

---

*Foundations series: ← [Ranking vs measuring](https://ofriperetz.dev/articles/ranking-vs-measuring) · [hub](https://ofriperetz.dev/foundations) · [Valid vs reliable metrics](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
