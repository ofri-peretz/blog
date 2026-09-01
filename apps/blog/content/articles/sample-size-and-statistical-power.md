---
devto_url: "https://dev.to/ofri-peretz/sample-size-and-statistical-power-what-a-small-sample-can-and-cannot-tell-you-p5h"
devto_id: 4182398
title: "Sample Size and Statistical Power: What a Small Sample Can and Cannot Tell You"
description: "A small test set is enough to prove a detector misses an entire category. It is not enough to support a confidence interval on a score. Both are true — here's how to know which claims your sample size actually supports."
slug: "sample-size-and-statistical-power"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/sample-size-and-statistical-power-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/sample-size-and-statistical-power.jpg?v=b2"
published: true
date: 2026-07-17
published_at: "2026-07-19T23:46:47.548Z"
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/sample-size-and-statistical-power
reading_time_minutes: 7
tier: "T0"
series: "Foundations"
arc: 7
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A fraud filter that catches zero of the last 200 confirmed-fraudulent charges needs no p-value to convict it. A trading strategy that beat its benchmark by five points last quarter might be genuine skill — or the kind of luck that evaporates by spring. Same data, same afternoon of analysis, two completely different standards of proof.

A test that returns zero detections across every known case of the thing it claims to catch doesn't need a significance test; that zero is a structural fact, and no amount of re-sampling changes it. But ask a subtler question — is a five-point edge real, or is it sampling noise — and the honest answer depends on numbers a summary table never shows: effect size, variance, statistical power. Knowing which of those two questions you're asking is the whole article.

---

## The Two Questions a Small Sample Can Answer {#what-n40-answers}

The first question: does this detector catch the failure at all?

A screening test that returns zero hits across every confirmed case of a disease doesn't need a significance test — you just need a sample large enough that one hit was structurally possible, and even a handful of cases clears that floor. Add forty more known-positive cases, still get zero, and the conclusion doesn't move; the same zero just grows more confident.

The second question is different in kind: is the gap between two contenders large enough to be real? (A composite score like an F1 rests on the same true-positive / false-positive bookkeeping covered in the [confusion matrix article](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn).) A five-point difference on a small sample could be genuine — or a fluctuation that vanishes if you swap three cases or re-run on a slightly different set. You cannot tell which without knowing the effect size.

The distinction underneath both: not every result carries sampling variability. Whether a deterministic test fires on a fixed, known input is a fact, not a draw from a distribution — no noise in that outcome to test. Statistical tests exist for questions where repeated sampling would produce a spread of answers. Run the same fixed case through the same check twice and you get the same output; a p-value on that has nothing left to measure.

---

## What Statistical Power Actually Means {#statistical-power}

Statistical power is the probability that a test detects a real effect when one genuinely exists. If the true gap between two contenders is fifteen points and you test it on a sample of forty, how often does the test come back significant? That probability is the power — the field's standard target is 80%, meaning you will still miss one in five real effects. Fine for an exploratory look; too low for a decision you are about to ship.

Three things move it: more observations sharpen the test's sensitivity to smaller effects; larger true effects are easier to detect than small ones; and a stricter significance threshold (α = 0.01 instead of 0.05) cuts false positives but demands a bigger sample to compensate.

Cohen (1988) gives the standard effect-size conventions — small = 0.2, medium = 0.5, large = 0.8 (Cohen's d). At 80% power and α = 0.05, detecting a medium effect needs roughly 64 observations per group; a small effect needs roughly 400.

I learned this at a poker table before I ever met it in a textbook: a player up after forty hands has proven nothing. Variance alone can float a mediocre player for an evening and sink a strong one. The edge — the thing you actually want to measure — only surfaces over thousands of hands. There, sample size isn't a technicality; it's the whole difference between reading skill and reading a good night. n is hands, and forty hands is a story, not a measurement.

The same arithmetic decides which comparisons a report can honestly make. Two diagnostic tests scoring 95% and 45% differ by fifty points — so large any sample of forty detects it. Two tests eight points apart — 63% against 55% — sit close enough that forty cases struggle to separate them from noise without a power calculation first. This is why a careful report leads with the categorical claim ("misses the entire category") and refuses to rank near-neighbours by a handful of points.

---

## When Variability Is Real: The Chi-Squared Case {#ai-model-test}

The opposite situation looks similar on the surface and needs the opposite treatment. Suppose you A/B-test three versions of a checkout page — call their conversion rates 68%, 71%, and 73% over a few hundred sessions each. The eye wants to crown the 73%. Whether the rate truly differs between versions needs a chi-squared test on the counts; run it and it comes back with a small statistic and p ≈ 0.4 — no significant difference, and the three-way ranking your eye drew is noise.

That test earns its p-value precisely because each visitor is a genuine random draw — the sampling story a hand-built checklist never has. [Statistical Significance and p-Values](https://ofriperetz.dev/articles/statistical-significance-p-value) owns the full contingency-table walkthrough, including the paired McNemar's-test version for comparing two tools on the same cases.

---

## When Your Test Cases Aren't a Random Sample {#not-a-random-sample}

This is where most people trip: a confidence interval requires the test set to be a random sample from some population. A hand-built set of cases is not one.

Think of a driving examiner's checklist of manoeuvres, a medical board's curated question bank, or a chess coach's hand-picked tactics puzzles. Each is deliberately constructed to cover chosen categories — which bounds a specific kind of validity (the set covers the categories you chose) without giving you a random draw from the space of situations that show up in the real world. Conflating the two manufactures false precision.

A confidence interval on "score over these forty cases" is computable and practically meaningless: the formula assumes repeated draws from a distribution, and deliberate test cases aren't that. The same problem sinks a p-value on "is performance significantly above 50% here" — it tells you whether you beat a coin flip on these particular cases, not on the next real one you face, because the two don't share a distribution.

What a constructed set is legitimately good for: exact, observational counts — did it catch this case, did it miss an entire category. What it cannot support: a confidence interval or significance claim about performance beyond the cases in it. The table below draws that line for every question type here.

---

## The Practical Rules {#practical-rules}

Four rules for reading any benchmark, audit, or scorecard:

**1. Category absence is evidence without statistics.** Zero out of N on a whole category needs no t-test — the tool has no coverage of that class of problem, full stop.

**2. Only run significance tests on a genuine sample.** A deliberately built set can't support a p-value about real-world generalization; outcomes drawn or generated at random, like the three-variant test above, can. Know which situation you're in before you reach for the test.

**3. State your n before your conclusion.** "Forty cases, missed the entire category" is complete on its own. "Forty cases, 5% higher score" needs a power calculation before it means anything — the sample size is part of the finding, not a footnote to it.

**4. Report null results.** "No significant difference" is an honest finding, not a result to bury. Publishing only the comparisons that reached significance is publication bias — the same distortion covered in [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement), operating at the analysis stage instead of during data collection.

> **Named misconception:** "A larger sample always gives more accurate results." A larger sample buys more power to detect small effects. It does not turn a deliberately constructed set into a random sample, and no sample size fixes that. Sample size and sampling method are different problems, and conflating them is what manufactures false precision.

---

## Quick Reference {#quick-reference}

| Question type | Needs significance test? | Why |
|---|---|---|
| Does the tool detect this failure at all? | No | Presence/absence, not magnitude — zero is zero |
| Which of two tools scores higher? | Depends on effect size | Run a power calculation before claiming the difference is real |
| Do three groups have different rates? | Yes (random sample) | Random draws + categorical comparison — chi-squared appropriate |
| Is our score significantly above 90% on a fixed test set? | No (constructed set) | Not a random sample; a CI would be false precision |
| Did it miss an entire category? | No | Observational count — report the zeros directly |
| Is a 5-point improvement real? | Yes | Small effect; small n has low power; significance test or power calc required |

*If this is the kind of page you'll want open mid-argument, bookmark it — and [follow me on Dev.to](https://dev.to/ofri-peretz) to catch the next one in the series.*

---

## References

Cohen, J. (1988). [*Statistical Power Analysis for the Behavioral Sciences*](https://doi.org/10.4324/9780203771587) (2nd ed.). Lawrence Erlbaum Associates. The foundational book on power analysis — defines the small/medium/large effect size conventions (d = 0.2 / 0.5 / 0.8) used throughout statistics and cited in this article.

Lakens, D. (2013). [Calculating and reporting effect sizes to facilitate cumulative science: a practical primer for t-tests and ANOVAs](https://doi.org/10.3389/fpsyg.2013.00863). *Frontiers in Psychology*, 4, 863. Accessible practical guide to effect size and statistical power — freely available online and the clearest non-textbook treatment of the topic.

Faul, F., Erdfelder, E., Lang, A.-G., & Buchner, A. (2007). [G\*Power 3: A flexible statistical power analysis program for the social, behavioral, and biomedical sciences](https://doi.org/10.3758/BF03193146). *Behavior Research Methods*, 39(2), 175–191. The paper behind the G\*Power tool (freely available at gpower.hhu.de) — the standard software for the power calculations referenced in this article.

Head, M. L., Holman, L., Lanfear, R., Kahn, A. T., & Jennions, M. D. (2015). [The extent and consequences of p-hacking in science](https://doi.org/10.1371/journal.pbio.1002106). *PLOS Biology*, 13(3). On what goes wrong when significance tests are applied carelessly — the publication bias and null-result-suppression problem that motivates rule four above.

---

## Related {#related}

**Builds on** — [The Confusion Matrix](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn): the four counts every score in this article is ultimately built from.

**Read next** — [Statistical Significance and p-Values](https://ofriperetz.dev/articles/statistical-significance-p-value): what a p-value means, the full chi-squared walkthrough, and the paired McNemar's test for comparing two tools on one set.

**Cited by** — [The FP-Tax Benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) and [We Ranked 5 AI Models by Security](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) — the evidence articles whose worked numbers (the leaderboard gaps, the null-result chi-squared) live where the product proof belongs. See also [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement) for the publication-bias angle.

---

*Foundations series: ← [Reproducibility vs replicability](https://ofriperetz.dev/articles/reproducibility-vs-replicability) · [hub](https://ofriperetz.dev/foundations) · [p-values & significance](https://ofriperetz.dev/articles/statistical-significance-p-value) →*

*Part of the Interlace ESLint ecosystem. [Source on GitHub](https://github.com/ofri-peretz/eslint-benchmark-suite) · [npm](https://www.npmjs.com/search?q=%40interlace) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
