---
devto_url: "https://dev.to/ofri-peretz/precision-recall-and-f1-for-static-analysis-same-score-opposite-tools-53ib"
devto_id: 4182392
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/precision-recall-f1-for-static-analysis.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/precision-recall-f1-for-static-analysis.jpg"
title: "Precision, Recall, and F1 for Static Analysis: Same Score, Opposite Tools"
description: "A tool with 100% recall and 2% precision and a tool with 2% recall and 100% precision score the same F1: 3.9%. One number cannot tell you which failure mode you're buying. Definitions, the security asymmetry, F-beta, and a worked example with two static-analysis tools that share a precision score and behave nothing alike."
slug: "precision-recall-f1-for-static-analysis"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis
reading_time_minutes: 7
tier: "T1"
series: "Foundations"
arc: 2
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

F1 gives the scanner that screams at everything and the one that stays almost silent the same score — and it is the number every vendor table leads with.

Tool A finds all 50 vulnerabilities in your codebase and buries them under 2,450 false alarms: 100% recall, 2% precision. Tool B raises exactly one flag, which is correct, and misses the other 49: 100% precision, 2% recall. F1 for both: **3.9%**.

Same number, opposite products: one drowns every real finding in noise, the other stays silent through almost everything. A single score that maps both to 3.9% cannot tell you which failure mode you are buying. This page is the reference for what sits underneath it.

## The Three Counts {#three-counts}

Every headline score in a static-analysis benchmark reduces to three counts against a labeled corpus:

- **TP (true positive)** — the tool flagged a real vulnerability.
- **FP (false positive)** — the tool flagged safe code.
- **FN (false negative)** — a real vulnerability the tool stayed silent on.

The fourth cell, the true negative — "every line the tool correctly ignored" — is unbounded, which is why accuracy flatters any tool that mostly stays quiet; the full grid lives in [the confusion matrix article](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn). And all three counts assume someone already decided what "a real vulnerability" means — a labeling step with failure modes of its own, covered in [ground truth in security testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing).

## Precision: When It Fires, Is It Right? {#precision}

**Precision = TP / (TP + FP).** Of everything the tool flagged, the fraction that was real.

Concrete case: a SAST scanner raises 22 SQL-injection flags on a service; 11 are real, 11 are safe string concatenations it misread. That is 50.0% precision — one false alarm per real bug. Precision is the number your developers feel, because they are the ones who triage every flag.

## Recall: Of Everything There, How Much Did It Find? {#recall}

**Recall = TP / (TP + FN).** Of all the real vulnerabilities in the corpus, the fraction the tool caught.

Concrete case: a conservative scanner that only fires on high-confidence patterns catches 4 of the 40 real vulnerabilities in a codebase, with 1 false alarm: 80.0% precision, 10.0% recall. When it fires, trust it — but it stayed silent on 36 of 40. Recall is the number your attackers feel, because false negatives are the findings that ship.

## F1: One Number, Two Hidden Failure Modes {#f1}

**F1 = 2PR / (P + R)** — the harmonic mean of precision and recall. Unlike an arithmetic mean, it punishes imbalance: 100% on one side cannot rescue 2% on the other, which is how both tools in the opening land on 3.9%.

That property is also its blind spot. F1 tells you the two ratios are _balanced or not_; it never tells you _which one collapsed_. The misconception worth deleting is the one the opening demonstrated: **two tools with the same F1 behave the same.** They don't. The value-investing rule applies: price is what you pay, value is what you get. A headline score is the price tag; the three counts are the books. Read the books.

## The Worked Numbers {#worked-numbers}

An illustrative benchmark makes the point concrete. Take a corpus of 50 seeded vulnerabilities — SQL injection, SSRF, path traversal — plus safe counterparts, and run three scanners with different temperaments:

| Scanner            | TP  | FP  | FN  | Precision | Recall | F1    |
| ------------------ | --- | --- | --- | --------- | ------ | ----- |
| Aggressive matcher | 50  | 50  | 0   | 50.0%     | 100.0% | 66.7% |
| Balanced           | 35  | 9   | 15  | 79.5%     | 70.0%  | 74.5% |
| Conservative       | 10  | 2   | 40  | 83.3%     | 20.0%  | 32.3% |

Three readings no single column supports:

**Similar precision, different products.** Balanced (79.5%) and Conservative (83.3%) look interchangeable on precision. Balanced has 3.5× the recall (70.0% vs 20.0%), and F1 spreads them to 74.5 vs 32.3. Comparing the two on precision alone compares the wrong thing.

**Averages conceal; per-check numbers reveal.** The aggressive matcher's 50.0% precision reads like a coin flip until you split it by check. One broad rule — a regex that flags any string concatenation feeding a database query — fired 8 of its false alarms against just 2 real SQL-injection hits: 20% precision hiding inside the 50% average. That 20% check is the one a team mutes first. Pull the per-check breakdown before you quote the tool-level number.

**A perfect row is a question, not an answer.** A scanner that posts 100/100/100 on a corpus is usually reporting that the corpus is exhausted, not that the tool is flawless. Read a perfect row as a reason to build harder fixtures — be more suspicious, not less.

Cited by: for a real, version-stamped run of this arithmetic across the Node.js linting ecosystem — real tools, real counts, one row per plugin, down to a single rule that fired 8 of a plugin's 11 false positives — see the [FP-tax benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark).

## The Security Asymmetry {#security-asymmetry}

In most domains, precision and recall errors cost about the same. In security they don't. A false positive costs minutes: a developer reads the flag, recognizes safe code, moves on. A false negative ships a vulnerability. On raw cost per error, recall should dominate.

But the second-order effect inverts the naive conclusion. Sustained low precision trains developers to distrust the tool — first the inline suppression, then the rule lands in the shared config's `off` list. A muted rule has an effective recall of zero, whatever the benchmark said. This is the false-positive tax: precision failures convert into recall failures through human behavior — which is why optimizing any single number in isolation fails exactly as [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) predicts.

The framing that survives both effects: **recall-first, precision-floor.** Choose tools by what they catch, subject to a hard minimum on precision — below the floor, the catch rate is theoretical because nobody is listening.

## The Assumption F1 Hides {#f-beta-and-cost}

F1 weights precision and recall equally. That is a choice, not a law — and for security it is the wrong default. Van Rijsbergen's Fβ generalizes the metric: **Fβ = (1+β²)PR / (β²P + R)**, where β is how many times more you value recall than precision. F2 (recall counts double) is the defensible default when a false negative ships a vulnerability and a false positive costs triage minutes.

Recomputing the two similar-precision scanners above under F2:

| Scanner                          | F1    | F2    |
| -------------------------------- | ----- | ----- |
| Balanced (P 79.5% / R 70.0%)     | 74.5% | 71.7% |
| Conservative (P 83.3% / R 20.0%) | 32.3% | 23.6% |

The order does not change. The gaps do: Conservative, the precision champion, drops from 32.3 to 23.6 as F2 charges it properly for 20% recall, and Balanced's lead over it stretches from 42 to 48 points. That is the lesson — metric choice moves magnitudes before it moves ranks, so check that a conclusion survives the switch before you trust it.

The grown-up version is cost-sensitive evaluation: put a currency cost on each FP (triage time × flag volume) and each FN (expected incident cost), then minimize expected total cost instead of maximizing any F-score. Those costs hinge on how rare real vulnerabilities are in your codebase — [the base rate problem](https://ofriperetz.dev/articles/base-rate-problem-explained), which earns its own page.

## How to Read a Vendor's Table {#how-to-read}

Four questions, in order:

1. **Where are the raw counts?** TP/FP/FN recover every ratio; ratios without counts recover nothing.
2. **Is precision per-rule or tool-wide?** A 50% average can hide a 20% rule, and the 20% rule is the one your team will mute.
3. **Are the numbers version-stamped and dated?** A tool's precision is a property of a specific version, on a specific corpus, on a specific date; last quarter's build, re-run after a rules update, can post a different number. An unstamped number is a claim about nothing in particular.
4. **Points or curves?** ML classifiers sweep a threshold, so they report precision-recall curves (Davis & Goadrich is the standard treatment). Rule-based scanners and linters are binary — a rule is on or off, with no threshold to sweep — so an honest benchmark reports operating points. A PR curve on a rule-based benchmark is decoration.

For prior art: the closest public relative is the OWASP Benchmark Project, which scores SAST tools on a large Java corpus using the same TP/FP-derived arithmetic. The same discipline transfers to any ecosystem — pick a labeled corpus, report operating points, and publish the raw counts so every ratio stays recoverable.

None of these metrics decides for you. Used together, they make it impossible for a single flattering number to decide _against_ you. Next in the Foundations arc: why a precision number earned on a balanced corpus quietly falls apart at production base rates — [The Base Rate Problem](https://ofriperetz.dev/articles/base-rate-problem-explained).

If this is the reference page you wished vendor tables came with, bookmark it and [follow me on Dev.to](https://dev.to/ofri-peretz) — the rest of the Foundations series is written the same way.

---

## Quick Reference {#quick-reference}

| Metric    | Formula        | Question it answers                    | Blind spot                                            |
| --------- | -------------- | -------------------------------------- | ----------------------------------------------------- |
| Precision | TP / (TP + FP) | When it fires, is it right?            | Says nothing about what was missed                    |
| Recall    | TP / (TP + FN) | Of what's there, how much did it find? | Says nothing about noise                              |
| F1        | 2PR / (P + R)  | Are the two in balance?                | Symmetric — hides _which_ side failed                 |
| F2        | 5PR / (4P + R) | Balance, valuing recall 2×             | Still one number; weights still a choice              |
| Accuracy  | (TP+TN) / all  | How often was it right overall?        | Needs TN — unbounded and near-meaningless for linters |

---

## References

Sokolova, M., & Lapalme, G. (2009). [A systematic analysis of performance measures for classification tasks](https://doi.org/10.1016/j.ipm.2009.03.002). _Information Processing & Management_, 45(4), 427–437. The standard taxonomy of classification metrics — which measures are invariant to which changes in the confusion matrix, and therefore which are safe to compare across corpora.

Van Rijsbergen, C. J. (1979). _[Information Retrieval](https://www.dcs.gla.ac.uk/Keith/Preface.html)_ (2nd ed.). Butterworths. The origin of the effectiveness measure that F1 descends from, including the β parameter — the primary source for the fact that F1's equal weighting was always meant to be adjustable.

Davis, J., & Goadrich, M. (2006). [The relationship between Precision-Recall and ROC curves](https://doi.org/10.1145/1143844.1143874). _Proceedings of ICML 2006_. Why precision-recall space is the right lens under class imbalance, and the context for when curves (threshold tools) versus points (binary tools) are the honest report.

OWASP Benchmark Project. [owasp.org/www-project-benchmark](https://owasp.org/www-project-benchmark/). A public, scored SAST benchmark built on TP/FP-derived metrics over a Java test suite — the closest existing prior art to a hand-labeled, operating-point leaderboard.

Saito, T., & Rehmsmeier, M. (2015). [The precision-recall plot is more informative than the ROC plot when evaluating binary classifiers on imbalanced datasets](https://doi.org/10.1371/journal.pone.0118432). _PLOS ONE_, 10(3), e0118432. The companion piece for why ROC-style reporting flatters tools when real positives are rare — which in security codebases they always are.

---

_Foundations series: ← [The Confusion Matrix](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) · [hub](https://ofriperetz.dev/foundations) · [The Base Rate Problem](https://ofriperetz.dev/articles/base-rate-problem-explained) →_

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). [Source on GitHub](https://github.com/ofri-peretz/eslint-benchmark-suite) · [npm](https://www.npmjs.com/search?q=%40interlace) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
