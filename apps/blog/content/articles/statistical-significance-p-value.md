---
title: "Statistical Significance and p-Values: What p > 0.05 Actually Means"
description: "p > 0.05 — the line of output that separates a real finding from a lucky one. What a p-value actually means, the three ways it gets misread, and when running a significance test is the wrong move entirely."
slug: "statistical-significance-p-value"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/statistical-significance-p-value
reading_time_minutes: 7
tier: "T0"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A three-way test of a checkout page came back with variant C on top: 34% conversion against 32% and 30%. "Variant C wins" was sitting right there — concrete, clickable, the kind of line that ends a meeting. Then the significance test said the gaps were exactly the size chance produces, so the honest report was a null: three variants, no measurable difference. The uncomfortable part is that the null is what makes the rest trustworthy — an analyst who only ever finds significant effects is either the luckiest person alive or is not really testing.

Beat the market for a year and the statement in your hand looks like proof of skill. But line up enough traders and someone runs heads ten flips straight — luck wearing skill's coat. Significance is the one question that pulls the two apart: edge, or coin? I make my own winners answer it before I believe them, because the story where I was right is the one I will always tell myself too easily.

What follows: what that line means, what it does not, and — the part most tutorials skip — when running a test at all is the wrong move.

---

## What Does a p-Value Actually Mean? {#what-p-means}

A p-value answers one narrow question: **assuming there is no real difference — the null hypothesis — how probable is data at least as extreme as what I observed?**

Formally: p = P(data this extreme | null is true). The conditioning only runs one way: assume a boring world where nothing is going on, then ask how surprising your measurement would be inside it. A small p-value says the data would be rare under the null — evidence against the boring world. A large one says the data is unremarkable there — compatible with "no difference," and equally compatible with "a real difference this sample was too small to see."

The question is domain-blind: it reads identically for two drugs on the same trial, two spam filters on the same mailbox, or two blackjack systems over the same shoe.

The 0.05 threshold is a convention, not physics — Fisher proposed it in *Statistical Methods for Research Workers* (1925) as a convenient working line, and it stuck. Nothing in the world changes between p = 0.049 and p = 0.051. Declare the threshold before the test; report the actual value either way.

## What a p-Value Does Not Mean {#what-p-does-not-mean}

The list of things a p-value is not is longer than the list of things it is. Greenland and colleagues cataloged 25 misinterpretations in one 2016 paper. Three do most of the damage:

**It is not the probability the null hypothesis is true.** p = P(data | null), not P(null | data). Flipping that conditional is the most common statistical error in print.

**It is not effect size.** With a large enough sample, a trivially small difference produces a tiny p-value. Significant means detectable, not important.

**And p > 0.05 does not prove there is no difference.** This is the misconception this article exists to kill. Non-significant means this data, at this sample size, could not distinguish the difference from noise. Absence of evidence is not evidence of absence — whether the test could even have detected a real effect is a question of [sample size and statistical power](https://ofriperetz.dev/articles/sample-size-and-statistical-power). A drug trial that reports p = 0.20 has not proven the drug useless; it failed to separate drug from placebo at the size it was run.

The misuse got bad enough that the American Statistical Association issued a formal position statement on a single statistical method (Wasserstein & Lazar, 2016), and one journal — *Basic and Applied Social Psychology* — banned p-values outright in 2015. When a field's own body has to publish "here is what our most-used tool does not mean," the problem is structural.

## The χ² Test: Three Variants, One Null Result {#the-chi-squared-case}

Back to the three checkout pages. Each variant drew 300 sessions that either converted or did not: a 3×2 contingency table, three variant rows, two outcome columns. Conversions came in at 96, 90, and 102 — the 32%, 30%, 34% that looked like a winner.

Chi-squared asks whether rows and columns are independent: if the variant had no effect, each one's converted/didn't split should match the overall split, give or take sampling noise. Overall, 288 of 900 sessions converted — 32% — so each variant "should" show about 96 conversions. The statistic measures how far the observed counts drift from the expected ones: here, χ² = 1.10. With (3−1)×(2−1) = 2 degrees of freedom, the α = 0.05 critical value is 5.991 — we measured 1.10, not close. The 4-point spread was exactly the size chance produces.

Publishing that is less noble than it sounds — the temptation runs the other way. Slice the data until something crosses 0.05 — by browser, by weekday, by traffic source — and something eventually will, by chance alone. That practice is p-hacking, and Head et al. (2015) found its fingerprints across whole disciplines by text-mining published p-values. The antidote is boring: decide the test up front, run it once, publish the number it returns — especially when it says no. (The same test deciding a real, published null on an open dataset is worked in full in [a companion piece](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).)

## Comparing Two Tools on the Same Cases {#comparing-tools-on-the-same-corpus}

The three-variant comparison used independent groups: each session belongs to one variant. Head-to-head evaluations are a different shape: two tools scored on the *same* items — say two screening tests read on the same 200 patients, test A flagging 30 and test B 24. That is paired data, and an independent-samples χ² is the wrong test. McNemar's (1947) is the right one: ignore every patient the two tests agree on and look only at the disagreement cells — b = patients A caught and B missed, c = the reverse. The statistic is (b−c)²/(b+c), one degree of freedom, critical value 3.841.

Say the disagreements split b = 12, c = 6. McNemar's statistic is (12−6)²/(12+6) = 36/18 = 2.0 — under 3.841. "Test A significantly beats test B" is unsupportable, even though 30 flags versus 24 looks decisive: the totals never answer, only the disagreements do. Flip it — if every disagreement points one way, b = 26, c = 0, the statistic is 26²/26 = 26, significant under any test. That is a gap, not noise. The b and c counts come straight from per-item [confusion-matrix bookkeeping](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn), and this is the exact test any head-to-head leaderboard owes you before claiming one entrant *significantly* beats its neighbor rather than merely outscoring it — [worked on a real corpus here](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark).

## When Not to Run a Significance Test {#when-not-to-test}

Every significance test assumes a sampling story: the data is a random draw from some population, and the test models the noise sampling introduces. Without a sampling story, a p-value is theater.

A complete census has no sampling story. A quality inspector who tests every one of the 40 units in a fixed production batch and finds 4 defective has measured *that batch* exactly — 4 of 40, no test needed. Wrap it in a p-value and you are answering a question nobody asked, because the batch was not a random draw from anything. What the exact count does not license is a leap to "4% of all units ever" — how far a fixed sample generalizes is a power question, not a significance one.

The checkout test earned its p-value because a genuine random process exists: each visitor is a draw from the stream of future visitors, and rerunning it returns different people. The rule of thumb: if you cannot name the population your data samples from, do not reach for a p-value. Report the exact number and its scope, and let it be what it is.

---

A p-value is a narrow tool with one honest job: stopping you from selling noise as a finding. It cost me a headline once and made what shipped more credible than the version I wanted. Next: when scores get lined up into a leaderboard, a rank throws away exactly the distances and uncertainty measured here — [ranking vs measuring](https://ofriperetz.dev/articles/ranking-vs-measuring) covers what survives that compression. And do not take any single number on faith: publish it, and let anyone re-run the test.

---

## Quick Reference {#quick-reference}

| You want to claim | Right move | Wrong move |
|---|---|---|
| "The difference between independent groups is real" | χ² on the contingency table; declare α before testing | Eyeballing raw counts |
| "Tool A beats tool B on the same items" | McNemar's test on the disagreement cells (b, c) | Independent-samples χ² on the totals |
| "p > 0.05, so they are equal" | Say "not distinguishable at this sample size"; check power | Claiming proof of no difference |
| "p < 0.05, so it matters" | Report effect size alongside p | Treating significance as importance |
| "We measured every unit in a fixed batch" | Report the exact number and its scope; no test | Wrapping a complete census in a p-value |
| "Variant C beats A and B" (three-way test) | 3×2 χ², df = 2: 1.10 < 5.991 → publish the null | Slicing the data until something crosses 0.05 |

*If this is the kind of page you will want open mid-argument, bookmark it — and [follow me on Dev.to](https://dev.to/ofri-peretz) to catch the next one in the series.*

---

## References

Wasserstein, R. L., & Lazar, N. A. (2016). [The ASA Statement on p-Values: Context, Process, and Purpose](https://doi.org/10.1080/00031305.2016.1154108). *The American Statistician*, 70(2), 129–133. Six principles from the field's own professional body; principle 2 — "p-values do not measure the probability that the studied hypothesis is true" — is the direction-of-conditioning error in one line.

Greenland, S., Senn, S. J., Rothman, K. J., Carlin, J. B., Poole, C., Goodman, S. N., & Altman, D. G. (2016). [Statistical tests, P values, confidence intervals, and power: a guide to misinterpretations](https://doi.org/10.1007/s10654-016-0149-3). *European Journal of Epidemiology*, 31, 337–350. The catalog of 25 misinterpretations. Read it before reviewing anything with a p in it.

Fisher, R. A. (1925). *Statistical Methods for Research Workers*. Oliver & Boyd. Where the 0.05 convention comes from — notable for how loosely Fisher himself held the line that later hardened into dogma.

McNemar, Q. (1947). [Note on the sampling error of the difference between correlated proportions or percentages](https://doi.org/10.1007/BF02295996). *Psychometrika*, 12(2), 153–157. The paired-proportions test — the correct tool whenever two systems are scored on the same items.

Head, M. L., Holman, L., Lanfear, R., Kahn, A. T., & Jennions, M. D. (2015). [The extent and consequences of p-hacking in science](https://doi.org/10.1371/journal.pbio.1002106). *PLOS Biology*, 13(3), e1002106. Text-mined p-value distributions across disciplines; the empirical case that selective analysis is widespread, and why pre-declared tests and published nulls matter.

---

*Foundations series: ← [Sample size & power](https://ofriperetz.dev/articles/sample-size-and-statistical-power) · [hub](https://ofriperetz.dev/foundations) · [Ranking vs measuring](https://ofriperetz.dev/articles/ranking-vs-measuring) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
