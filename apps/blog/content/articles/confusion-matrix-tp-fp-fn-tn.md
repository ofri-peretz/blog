---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/confusion-matrix-tp-fp-fn-tn-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/confusion-matrix-tp-fp-fn-tn.jpg?v=b2"
devto_url: "https://dev.to/ofri-peretz/the-confusion-matrix-what-tp-fp-fn-and-tn-actually-mean-1h32"
devto_id: 4182366
title: "The Confusion Matrix: What TP, FP, FN, and TN Actually Mean"
description: "A cancer screen can be 90% accurate and still wave through two-thirds of the tumors it exists to catch. The confusion matrix is the honest ledger behind that number — and accuracy is usually the last thing you should read."
slug: "confusion-matrix-tp-fp-fn-tn"
published: true
date: 2026-07-17
published_at: "2026-07-19T23:36:49.093Z"
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn
reading_time_minutes: 6
tier: "T0"
series: "Foundations"
arc: 1
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A cancer screen a clinic is evaluating reports 90% accuracy on the trial set: 900 of 1,000 scans called correctly. The number is technically true. But of the 60 scans that actually showed a tumor, the screen caught only 20 — it waved 40 real tumors through as clean. The headline said how often the test was right. It said nothing about what kind of wrong the other 10% was.

That asymmetry is the whole problem. A test that misses two-thirds of the tumors in front of it can still headline 90% accuracy, as long as the healthy scans — which vastly outnumber the sick ones — come back correct. Accuracy isn't a lie; it's a ratio that doesn't distinguish between a false alarm and a missed tumor. The confusion matrix is the honest ledger underneath that ratio: a 2×2 grid that forces you to name not just how much you got wrong, but which direction.

**Accuracy tells you how often a detector is wrong. The confusion matrix tells you which way — and which way is the only part that costs anything.** A radiologist reading a scan, a bank scoring a transaction, a spam filter holding a legitimate email: each fails in two directions that cost different amounts, and each is lying to you the moment it collapses those two directions into one blended number.

## The Four Cells {#the-four-cells}

Any detector makes one binary call per case — positive or negative — and every call lands in one of four cells: a **true positive (TP)** catches a real case (the tumor is there and the test flags it), a **true negative (TN)** correctly stays silent on a clean case, a **false positive (FP)** raises an alarm on a clean case, and a **false negative (FN)** stays silent on a real one. Full definitions and per-cell costs are in the [quick-reference table](#quick-reference) below. What matters here is that FP and FN are not interchangeable errors: a FP sends a healthy patient for a needless biopsy — cost, worry, and time that end in "nothing was wrong"; a FN sends a sick patient home reassured, the disease still there, found later and larger. Any single number that adds the two together, the way accuracy does, has already thrown away the only distinction that matters. Everything built from these four counts next — precision, recall, F1 — inherits that distinction, or loses it.

## Why Accuracy Is Almost Always the Wrong Number {#why-accuracy-fails}

**Accuracy = (TP + TN) / (TP + FP + FN + TN).** On paper that's the fraction of predictions you got right — exactly what you'd want. In practice it rewards silence. Most real populations are overwhelmingly negative — clean transactions, healthy patients, legitimate email — so TN dominates by orders of magnitude, and a detector that never fires can still post a near-perfect score.

Take a bank screening 10,000 transactions of which 10 are fraudulent: a detector that flags nothing scores TP = 0, FN = 10, TN = 9,990 — **99.9% accuracy, 0% recall.** A fraud detector that catches zero fraud and reports a 99.9% headline number is not a fraud detector; it's a silent pass wearing a good-looking number.

This is the base rate problem in miniature — the gap between how a metric behaves on a hand-balanced test set and how it behaves once the real class ratio is restored. The full mechanics, including why a precision number earned on a balanced corpus doesn't describe production behavior, are in [The Base Rate Problem](https://ofriperetz.dev/articles/base-rate-problem-explained). The misconception worth retiring here: that accuracy is a safe default metric. It's the wrong default for any detector — medical, fraud, security — where a false alarm and a missed case cost different amounts, which is to say, nearly every real one.

## Worked Numbers: Two Filters, One Test Set {#worked-numbers}

Take two spam filters run over the same 1,000 emails, of which 40 are actually spam. Both are defensible on a headline; they fail in opposite directions:

| Filter | TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| Filter A (aggressive) | 30 | 30 | 10 | 50.0% | 75.0% | 60.0% |
| Filter B (conservative) | 4 | 1 | 36 | 80.0% | 10.0% | 17.8% |

Filter A is the alarm-fatigue machine: for every real spam it catches, one legitimate email gets quarantined (50% precision — a 1:1 catch-to-false-alarm ratio). Worse, that false-positive rate is self-reinforcing — once people learn half of what the filter flags is fine, they start fishing real spam back out along with the mistakes and stop trusting the quarantine folder at all. That's an effective second drop in recall that never shows up in the table. Filter B is the inverse: near-silent, 90% of the spam sails straight into the inbox undetected, and because it almost never touches a legitimate email it reads as well-behaved from the outside — precisely because its failures don't generate alerts. F1 compresses both stories into one number — 60.0% versus 17.8% — but can't tell you which failure mode you're buying. Read precision and recall separately before you trust it.

## Type I and Type II Errors {#type-i-and-type-ii-errors}

Statistics has its own name for two of these four cells, and if you trained outside detection tooling you likely met the concept there first. A **false positive is a Type I error** — rejecting a true null hypothesis; here, the test declares "positive" when the null ("this case is clean") was actually true. A **false negative is a Type II error** — failing to reject a false null; the test stays silent when it should have flagged the case.

| Statistics term | Confusion-matrix cell | Reading it here |
|---|---|---|
| Type I error, rate α | False Positive | Clean case flagged as positive |
| Type II error, rate β | False Negative | Real case passed as clean |
| Power, 1 − β | — | ≈ recall: odds of catching a real case |

α and β aren't a cosmetic rename — they're the two error rates a significance test is built to control, and confusing "no significant difference" with "no error" is its own common mistake. [Statistical Significance and p-Values](https://ofriperetz.dev/articles/statistical-significance-p-value) covers what α and β actually bound and what a p-value can't tell you about either one.

So why keep two vocabularies for the same grid? Because whoever hands you "p < 0.05" and whoever hands you "our false-positive rate" are usually naming the same cell, and a report that speaks only one dialect gets talked past by a reader trained in the other.

In chess you can be up a queen and still be mated in one. The piece count never tells you which square loses the game — and which square is the only part that ever mattered. Accuracy is the piece count. The confusion matrix isn't a measurement tool so much as an honesty tool: filling in all four cells forces you to say not just how much you got wrong, but which direction. Someone who hands you the full grid has taken a position you can verify. Someone who hands you a bare accuracy number has committed to nothing — a 10% error rate could be 10% false alarms or 10% missed cases, and those are wildly different failures to live with. Next in the Foundations arc: what these same four counts do to precision and recall once two detectors stop being comparable on one blended score — [Precision, Recall, and F1 for Static Analysis](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis).

If this is the reference page you'll reach for the next time someone hands you a bare accuracy number, bookmark it and [follow me on Dev.to](https://dev.to/ofri-peretz) — the rest of the Foundations series is written the same way.

---

## Quick Reference {#quick-reference}

| Term | Definition | Example (a medical screen) | Cost |
|------|-----------|-------------------|------|
| TP (True Positive) | Positive prediction was correct | Test flags a real tumor | None — this is the job |
| FP (False Positive) | Positive prediction was incorrect | Test flags a healthy patient | Needless follow-up; alarm fatigue at scale |
| FN (False Negative) | Negative prediction was incorrect | Test misses a real tumor | The case ships undetected |
| TN (True Negative) | Negative prediction was correct | Test clears a healthy patient | None — this is also the job |

**The three metrics to read instead of accuracy:**

- **Precision** = TP / (TP + FP) — "When the detector fires, is it right?" High precision means a low false-alarm rate. A precision of 50% means half the cases someone investigates turn out to be phantoms.
- **Recall** = TP / (TP + FN) — "Of all the real cases in the population, how many does the detector catch?" High recall means few escapes. A recall of 10% means 90% of the real cases pass through undetected.
- **F1** = 2 × (Precision × Recall) / (Precision + Recall) — Harmonic mean of precision and recall. Useful as a single-number summary, but read precision and recall separately first: two detectors can have identical F1 scores with opposite precision/recall profiles and opposite real-world implications.

---

## References

1. Sokolova, M., & Lapalme, G. (2009). [A systematic analysis of performance measures for classification tasks](https://doi.org/10.1016/j.ipm.2009.03.002). *Information Processing & Management*, 45(4), 427–437. First comprehensive treatment of the conditions under which accuracy fails as a classification metric, including the base-rate sensitivity problem.

2. Davis, J., & Goadrich, M. (2006). [The relationship between Precision-Recall and ROC curves](https://doi.org/10.1145/1143844.1143874). *Proceedings of the 23rd International Conference on Machine Learning (ICML)*. Foundational work on why precision-recall curves dominate ROC curves for imbalanced class distributions — the theoretical grounding for why recall matters more than accuracy when one class is rare.

3. NIST Software Assurance Reference Dataset (SARD). NIST SAMATE project. [samate.nist.gov/SARD/](https://samate.nist.gov/SARD/). Ground-truth labeled corpus used as the methodological basis for fixture design in structured detector benchmarks.

4. Fawcett, T. (2006). [An introduction to ROC analysis](https://doi.org/10.1016/j.patrec.2005.10.010). *Pattern Recognition Letters*, 27(8), 861–874. Best single-paper reference for the full classification metric landscape, including the relationship between sensitivity (recall), specificity, and the tradeoffs that determine which metrics apply in a given problem domain.

---

## Related {#related}

**Builds on** — [The Base Rate Problem](https://ofriperetz.dev/articles/base-rate-problem-explained): why a metric earned on a balanced test set misleads once the real class ratio comes back.

**Read next** — [Precision, Recall, and F1 for Static Analysis](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis): the three metrics these four cells feed, and why one F1 score can hide two opposite tools.

**Cited by** — [The FP-Tax Benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) · [Bias in Measurement](https://ofriperetz.dev/articles/bias-in-measurement) · [Sample Size and Statistical Power](https://ofriperetz.dev/articles/sample-size-and-statistical-power) — evidence and foundations articles that report these four counts in the wild.

---

*Foundations series: [hub](https://ofriperetz.dev/foundations) · [Precision, Recall, and F1](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint-benchmark-suite) · [npm](https://www.npmjs.com/search?q=%40interlace) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
