---
devto_url: "https://dev.to/ofri-peretz/ranking-vs-measuring-what-a-leaderboard-throws-away-31d0"
devto_id: 4182377
title: "Ranking vs. Measuring: What a Leaderboard Throws Away"
description: "A rank is what's left of a measurement after you throw away the distances, the uncertainty, and the ties. When a leaderboard means something, when it's just ordering noise, and the four scales of measurement that tell them apart."
slug: "ranking-vs-measuring"
published: true
date: 2026-07-17
tier: "T0"
series: "Foundations"
arc: 9
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/ranking-vs-measuring
reading_time_minutes: 7
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

The world chess rating list and a "top 10 players" listicle look like the same object. They are not. One prints a number next to each name — a rating, on a scale where a 100-point gap means a specific, repeatable thing. The other prints only the order. Strip the ratings off the first list and you can never get them back: you are left with 1, 2, 3, and no way to know whether first place leads second by a canyon or by a coin flip.

A rank is what's left of a measurement after you throw away the distances, the uncertainty, and the ties. That sentence is an inventory, and this page itemizes it.

---

## What are the four scales of measurement? {#scales-of-measurement}

This distinction is older than any leaderboard. In 1946, the psychologist S. S. Stevens sorted every number science records into four scales, each supporting strictly more arithmetic than the last. The table is short enough to memorize and settles most metric arguments before they start:

| Scale | What it carries | Legal operations | Examples |
|---|---|---|---|
| **Nominal** | Category membership | Count, mode | A stock ticker; a blood type |
| **Ordinal** | Order, nothing more | Compare, median — **never average** | A leaderboard rank; a credit rating; star ratings |
| **Interval** | Order + equal distances | Add, subtract, mean | Temperature in °C; a chess Elo rating |
| **Ratio** | Interval + a true zero | Everything, including "twice as much" | Height in cm; a runner's time; income in dollars |

Anchor it with three objects from one domain: in finance, a ticker is nominal, a credit rating is ordinal, a share price is ratio. The scale determines the arithmetic, and most dashboard sins are scale violations. "Average credit rating: BBB+" averages ordinal labels as if the distance from B to BB equalled the distance from A to AA; nothing promises that. "Average rank across events" does the same to a set of standings — it treats the #1→#2 gap as equal to the #9→#10 gap, which is precisely the information a rank no longer contains. You can compare ranks. You cannot do arithmetic on them and expect the result to mean anything.

## What does a rank destroy? {#what-a-rank-destroys}

Three things, by construction.

**Distances.** Three sprinters finishing a 100 m final in 9.8 s, 9.9 s, and 12.5 s rank exactly the same as three finishing in 9.8, 11.0, and 12.5: first, second, third. The ordering is identical; the story it should tell is opposite. In one race, second and third sit a stride apart; in the other, second place is closer to winning than to losing to third.

**Uncertainty.** A measurement arrives with an error bar; a rank is a bare integer. Fourth place might mean "comfortably fourth" or "statistically tied with everyone from #2 to #6." The list renders both identically, and integers read as exact.

**Ties.** A sorted list forces a total order: every pair must resolve, including pairs the instrument cannot tell apart. Chess handles this honestly — the rating list prints both the rank and the rating, so you can see whether #1 leads #2 by a 150-point gulf or by rounding. Strip the ratings and both situations collapse into the same two lines of text. Most leaderboards publish only the two lines of text.

## When do rankings flip inside the noise? {#ties-and-noise}

The misconception this page exists to kill: **"#1 on the leaderboard means measurably better than #2."** A leaderboard cannot help producing a total order — sorting does not check significance. When two entries sit inside each other's error bars, their order is an artifact of the sample: run the contest again and they swap.

Two chess players rated 2005 and 2000 will trade places over a weekend of games; the five-point "lead" is noise. Two rated 2400 and 2000 will not. An A/B test tells the same story: a variant converting 123 of 1,000 visitors (12.3%) "beats" one converting 120 of 1,000 (12.0%), but that gap is well inside what a re-run would move — the ranking exists, the difference doesn't. The formal way to ask "is this gap real or is it noise" is a significance test; ordering noise looks identical to ordering signal until you run one, and [the full statistical telling lives in the p-values article](https://ofriperetz.dev/articles/statistical-significance-p-value). Wait a year and a close ranking reshuffles: last season's top-ranked fund rarely repeats.

The number I trust is a 100-point Elo gap: it's a real interval — it predicts who wins often enough to bet on, and it survives a rematch. The number I don't is fourth place versus fifth on a leaderboard where the whole field sits within a few rating points. Elo is a system built to turn a measurement into a rank, and even it won't pretend #4 and #5 differ when the ratings beneath them say they don't. When the system that invented player-ranking refuses to oversell its own order, that's the bar.

## How do leaderboards manufacture discoveries? {#multiple-comparisons}

Every cell of a leaderboard is another hypothesis test, and each test at 95% confidence carries a 5% false-alarm rate. Run twenty comparisons and one spurious "winner" is the expected outcome, not bad luck. Run a few hundred and you are guaranteed headlines. A drug trial that finds no overall effect but reports "significant in left-handed patients over 60" has usually just sliced its data into enough subgroups that one crossed the line by chance. A leaderboard with dozens of categories does the same: it crowns a fresh champion in whichever column you read first.

The classical fix, Bonferroni's, is an instinct more than a formula: the more comparisons you run, the stronger the evidence each one must clear, in proportion. The modern refinement, Benjamini and Hochberg's false discovery rate (1995), concedes that at scale some false discoveries are inevitable and controls what fraction of your claimed discoveries are false instead. You need neither formula to use the instinct: before believing any cell, count how many cells were computed.

## When is a leaderboard actually valid? {#leaderboard-conditions}

A ranking is legitimate when it is a *presentation* of a measurement, not a replacement for one. Four conditions:

**1. The measurements are printed next to the order.** Stevens compliance: give readers the interval- or ratio-scale numbers; keep the rank as a reading aid.

**2. The gaps are large relative to the noise.** A diagnostic test with 95% sensitivity against one with 55% is a real result — the gap survives any statistical correction you throw at it. Two tests at 72% and 70% are an ordering the sample cannot defend: one reclassified case flips them. Same column — the first comparison is a finding, the second is decoration.

**3. Same instrument, same subjects, same conditions for every row.** Otherwise the rows are not comparable and the order is theatre.

**4. The formula is public.** Chess ratings are the model here: the Elo formula is published, so anyone with the game results can recompute a rating and check the list. Contrast that with a "power ranking" that publishes only an ordering — unfalsifiable by design. A ranking of software weaknesses built the same way, on a public scoring formula, is [checkable in exactly this sense](https://ofriperetz.dev/articles/cwe-taxonomy-explained). And most leaderboards sort by a composite score, which means [the weights chose the winner before anything was measured](https://ofriperetz.dev/articles/composite-scores-and-weighting) — that problem gets its own article.

The academic gold standard, Demšar's 2006 protocol for comparing systems across many datasets, uses rank-based tests *on purpose*: when the things you are ranking are not measured on a common scale, ordinal is the honest choice, so it attaches significance machinery to the ranks rather than pretending raw scores can be averaged. Ranks used with discipline, not as decoration.

So the order of operations is the entire argument: measure, publish the measurement with its uncertainty, then — if it helps the reader — sort. A leaderboard is a UI element, not a result. Built that way, a ranking stops being something to argue about and becomes something to check: gaps you can query, formulas you can recompute, ties you can see. And when the thing you are measuring is itself a judgment call, ordering is not even the first problem — agreement is. That is [Cohen's κ](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa), next in this series.

---

## Quick reference {#quick-reference}

| Question for any leaderboard | Healthy answer | Red flag |
|---|---|---|
| Are raw measurements printed next to the ranks? | Interval/ratio numbers on every row | Ordering only — unfalsifiable |
| Is the #1→#2 gap large vs. re-run noise? | Gap survives correction (Elo 2400 vs 2000; test 95% vs 55%) | Adjacent rows a coin flip (72% vs 70%) |
| Same subjects, conditions, instrument per row? | Pinned and published | Mixed conditions, ordered anyway |
| Is the scoring formula public? | Recomputable (a published formula, like Elo) | "Proprietary methodology" |
| How many comparisons produced the wins? | Counted, corrected, or both | Hundreds of cells, every win reported |
| What arithmetic was done on the ranks? | Compare, median | Averaged ranks; "mean credit rating: BBB+" |

This page is built to be a reference — bookmark it for the next time a leaderboard is used as an argument, and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the measurement series.

**Related:** builds on [p-values & statistical significance](https://ofriperetz.dev/articles/statistical-significance-p-value); its cousin is [composite scores & weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting); a public-formula ranking done right is the [software-weakness Top 25](https://ofriperetz.dev/articles/cwe-taxonomy-explained).

**Cited by:** the worked numbers behind "gap survives vs. gap is noise" live in the evidence tier — [a five-way ranking that turned out wrong](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), [a detection benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark), and [a 17-tool comparison](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

---

## References

Stevens, S. S. (1946). [On the Theory of Scales of Measurement](https://doi.org/10.1126/science.103.2684.677). *Science*, 103(2684), 677–680. The origin of nominal/ordinal/interval/ratio and of the legal-operations idea this article's first table compresses.

Benjamini, Y., & Hochberg, Y. (1995). [Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x). *Journal of the Royal Statistical Society, Series B*, 57(1), 289–300. The modern answer to leaderboards that run hundreds of comparisons: control the fraction of false discoveries, not the chance of any.

Demšar, J. (2006). [Statistical Comparisons of Classifiers over Multiple Data Sets](https://www.jmlr.org/papers/v7/demsar06a.html). *Journal of Machine Learning Research*, 7, 1–30. The canonical benchmarking protocol — rank-based tests used deliberately, with significance machinery attached.

MITRE. *CWE Top 25 Most Dangerous Software Weaknesses — Methodology*. https://cwe.mitre.org/top25/ — a real-world ranking with a published, recomputable formula; the standard other leaderboards should be held to.

---

*Foundations series: ← [p-values & significance](https://ofriperetz.dev/articles/statistical-significance-p-value) · [hub](https://ofriperetz.dev/foundations) · [Cohen's κ / inter-rater agreement](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
</content>
</invoke>
