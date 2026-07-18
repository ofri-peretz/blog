---
title: "Bias in Measurement: The Silent Failure Mode in Benchmark Design"
description: "A blood panel, a fund's track record, and a security benchmark can all report a clean, confident number that is quietly wrong. Measurement bias doesn't announce itself — the five kinds, and how to catch each before you publish."
slug: "bias-in-measurement"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/bias-in-measurement
reading_time_minutes: 6
tier: "T0"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

In 1943, the U.S. Navy studied the bombers returning from raids over Europe and mapped the bullet holes — clustered on the wings, fuselage, and tail — to decide where to add armor. The mathematician Abraham Wald told them to armor the opposite: the engines and the cockpit, the places with almost no holes. The planes hit *there* were not in the data. They were the ones that never came back.

That is measurement bias: the number you measure is not the number you think you are measuring. It has sunk clinical trials, trading backtests, and A/B tests the same way it nearly fooled the Navy — a plausible-looking result rarely gets a second look, and "the planes that come back have few engine hits" looked exactly plausible enough.

---

## Types of Bias in Benchmark Design {#types-of-bias}

Five kinds of measurement bias recur in any process that scores something against a fixed set of cases — a drug against a placebo, a strategy against ten years of prices, a spam filter against a labeled inbox. They are not mutually exclusive; one broken study can carry several at once. Each example below is drawn from a different field on purpose, because the failure mode belongs to all of them.

### 1. Environmental Bias

The instrument or the conditions of measurement — not the thing being measured — move the result. A blood analyzer calibrated 15% low reports every sample as low: nothing errors, no alarm sounds, and a patient's genuinely elevated marker hides inside a normal-looking number. The reading is precise, repeatable, and wrong.

### 2. Corpus Bias

The test set is built with knowledge of what you are testing. A trading strategy tuned on the same 2010–2020 price history it then reports returns on will always look brilliant — it has already seen every answer. The backtest measures how well the rules fit the past, not how they will trade tomorrow. Design the test after seeing what wins, and you measure the fit, not the skill.

### 3. Selection Bias

Which comparisons you include. A new drug that beats a sugar pill has proven it beats nothing — not that it beats the standard treatment patients already take. Weak comparators flatter any result by proximity; the honest question is always *who did you leave out?*

### 4. Version Bias

Citing a number measured under one set of conditions as if it still holds under another. A fund advertising its 2021 return of +28% in a 2026 brochure is quoting a figure that no longer describes it — the holdings, the manager, and the market have all changed. Both numbers can be individually correct and still mislead when one stands in for the other. No single lie is told; the bias lives in the mismatch.

### 5. Survivorship Bias

Excluding the cases that failed to finish. Reported mutual-fund returns overstate the average fund by roughly 1.5% a year, because the funds that closed — the losers — drop out of the index, and only the survivors are left to average. It is the same shape as Wald's bombers: the cases you can see are the cases that made it back.

---

## A Result of Zero Is a Question {#the-unicorn-incident}

Any chess player strong enough to be dangerous shares one reflex: the free piece is the one you distrust most. A result that looks too clean is not a gift — it is a line you have not finished reading.

I nearly published my own too-clean line: a security linter that scored **0 of 40** on a vulnerability corpus, until a re-run under a supported runtime returned **22 of 40** — the zero was the measuring instrument failing silently, not the tool finding nothing. The full forensic walkthrough lives in [I Built What I Benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat).

A result of zero is a question, not an answer. Zero can be correct; it can also mean the measurement never ran. You cannot tell which from the number alone — only from the conditions that produced it, which is why those conditions belong in your methodology, not a footnote. The same holds for every suspiciously round result: 100% recall, a perfect score, an unbroken streak. Cleanliness is a prompt to re-read the line, not to move.

---

## How to Catch Measurement Bias Before Publishing {#catching-bias}

Five checks, in the order I run them, before any number goes into a draft.

**1. Re-run suspicious clean results in a different environment first.** All-zeros, perfect recall, or a flawless score means the test *completed* — not that the result is valid. Change the instrument, the machine, or the conditions before you attribute the output to the thing you meant to measure. If the number moves, it was the environment.

**2. Record and publish the exact conditions of every measurement.** Version, instrument, settings, date. A number you cannot reproduce from the conditions you wrote down is not evidence; it is an anecdote.

**3. Measure each subject in isolation.** Separate run, separate setup, no shared state. Interaction effects between things measured together are real, and isolation removes that source of variance.

**4. Cross-check against your own prior numbers.** A result that contradicts last month's run with no known cause is a signal to investigate before publishing, not a headline to ship. A drop from a known value to zero, with nothing in between to explain it, is never plausible on its own.

**5. Put the conditions in the methodology, not a footnote.** The environment that produced a number is part of the number. Stating it is what makes a result reproducible — not a defensive disclosure, the whole point.

---

## When the Measurer Owns the Result {#self-benchmarks}

Bias is worst when the same party designs the test and needs it to pass. Industry-funded drug trials report conclusions favoring the sponsor far more often than independent ones — not usually through fraud, but through a long series of small, individually defensible choices that all lean the same way. It is the mechanism [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) describes: when the measurer and the measured share an interest, the measured result consistently favors whoever ran the measurement.

The only honest answer is to publish the process, not just the score — the design, the raw counts, the re-runs, and the losses. That is the discipline I hold myself to in [I Built What I Benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat): go looking for the ways your own test rig is broken before anyone else does. Not the story that makes a benchmark look impressive — the one that makes it trustworthy.

> **Named misconception:** "A result of zero means nothing was there to find." It can also mean the measurement never ran — silently. The number looks identical either way; only the instrument that produced it tells you which one you got.

If a suspiciously clean number ever lands in your own draft, bookmark this page — and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the measurement series.

---

## Quick Reference {#quick-reference}

| Bias type | What it is | Detection | Prevention |
|-----------|------------|-----------|------------|
| Environmental | The instrument or conditions, not the subject, change the result | Re-run on a different instrument or environment; if the number changes, it was environmental | Calibrate and record the instrument; document conditions in the methodology |
| Corpus | The test set built (consciously or not) to match what you're measuring | Build the test set before tuning; compare it to an external standard | Anchor the test set to an outside reference, not to what your subject already passes |
| Selection | Only comparing against favorable alternatives | Ask "who's missing?" — name the strong comparators explicitly | Include the comparators that could beat you |
| Version | Citing a number from one condition as if it holds under another | Re-measure when conditions change before calling a number "current" | Publish the exact conditions alongside every number |
| Survivorship | Excluding the cases that failed to finish | Count what dropped out, not just what remains | Record the failures and include them in the comparison |

---

## References

Campbell, D. T. (1979). Assessing the impact of planned social change. *Evaluation and Program Planning*, 2(1), 67–90. Introduces Campbell's Law — "the more any quantitative social indicator is used for social decision-making, the more subject it will be to corruption pressures" — the governance version of measurement bias, where the act of measuring a metric changes the behavior being measured.

Goodhart, C. (1975). Problems of monetary management: the UK experience. *Papers in Monetary Economics*, Reserve Bank of Australia. The original observation behind corpus bias: when a measure becomes a target, the measure ceases to be a good measure. (The familiar "becomes a target" phrasing is Strathern's 1997 gloss on Goodhart, not a direct quote — see [Goodhart's Law, explained](https://ofriperetz.dev/articles/goodharts-law-explained) for the distinction.)

Huff, D. (1954). *How to Lie with Statistics*. W. W. Norton & Company. Chapter 1, "The Sample with the Built-in Bias," covers selection bias — and the built-in exclusions behind survivorship — with examples that are still the clearest treatment of the problem in print.

Kitchenham, B., & Pfleeger, S. (2002). Principles of Survey Research Part 4: Questionnaire Evaluation. *ACM SIGSOFT Software Engineering Notes*, 27(3), 20–23. On questionnaire validity and reliability — the framework that distinguishes construct validity (measuring what you claim to measure) from reliability (the instrument producing consistent readings, not introducing error).

---

## Related {#related}

**Read these first — the foundations this article stands on:** [the confusion matrix](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) defines the TP/FP/FN counts every bias distorts; [the base-rate problem](https://ofriperetz.dev/articles/base-rate-problem-explained) explains why a low base rate makes a clean number look plausible; [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) covers what happens when the measurer and the measured share an incentive.

**Cite this from — the work that depends on it:** the [FN/FP benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) and the [17-plugin comparison](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) publish the versions and environment this article argues you cannot omit; [I Built What I Benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) is the full self-audit, of which the zero-that-wasn't is a single move; [reproducibility vs. replicability](https://ofriperetz.dev/articles/reproducibility-vs-replicability) asks the next question — whether anyone else can get your number at all.

---

*Foundations series: ← [The Base Rate Problem](https://ofriperetz.dev/articles/base-rate-problem-explained) · [hub](https://ofriperetz.dev/foundations) · [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
