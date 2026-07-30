---
devto_url: "https://dev.to/ofri-peretz/composite-scores-and-weighting-your-overall-score-is-an-editorial-570g"
devto_id: 4182368
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/composite-scores-and-weighting-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/composite-scores-and-weighting.jpg?v=b2"
title: "Composite Scores and Weighting: Your 'Overall Score' Is an Editorial"
description: "An index looks like a measurement of 'the market.' It's a composite — a committee picks the members, a rule sets the weights, a calendar sets the rebalance. Editorial choices dressed as a number. Every overall score works this way; the honest ones publish the weights, the rationale, and what happens when the weights move."
slug: "composite-scores-and-weighting"
published: true
date: 2026-07-17
tier: "T0"
series: "Foundations"
arc: 13
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/composite-scores-and-weighting
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

The S&P 500 looks like a measurement of "the market." It isn't. It's a composite: a committee picks which ~500 companies count, a rule weights each by market value — so the ten largest drive roughly a third of the index — and a calendar decides when the membership changes. Nobody derived those choices from first principles. People chose them. Every "the market is up 1.2%" inherits all three.

That is not a quirk of one index. It is how every composite works — a credit score, a GDP figure, a hospital's star rating, a decathlon total. Under the single number sits a table of weights, and a person chose them. A composite is opinions wearing a number costume; the honest version publishes the costume's pattern.

---

## What Is a Composite Score? {#what-a-composite-is}

A composite score takes several sub-metrics, normalizes each onto a common scale, multiplies each by a weight, and sums the results into one scalar:

```text
composite = Σ ( normalize(metricᵢ) × weightᵢ )
```

Composites exist because decisions need scalars. A loan is approved or declined; a patient is admitted or sent home. Nobody hands a decision-maker seven numbers and gets a decision back. The compression is the entire value — and the entire risk, because it deletes information and the weights decide which information dies.

Two structural notes first. If you rank anything by a composite, the ranking inherits every property of the composite — [a ranking is a composite with the weights hidden](https://ofriperetz.dev/articles/ranking-vs-measuring). And normalization is not optional. Sum a decathlete's events as raw numbers — 100m in seconds (~10), long jump in metres (~8), javelin in metres (~60) — and the javelin becomes the real weight; biggest range, so it buries the sprint. That is why the decathlon converts every event to points on a published table *before* adding. Skip it and the largest-range metric wins, and nobody voted for it.

## Why Are the Weights Opinions? {#weights-are-opinions}

The standard defense is: "the overall score is objective — it's computed." The arithmetic is objective. The weights it runs on are editorial choices, encoding what one person believes matters. **Computed is not the same as neutral.** The misconception survives because the arithmetic is genuinely rigorous — but rigor downstream of an opinion is still an opinion.

So the first two honesty requirements for publishing any composite:

1. **Publish the components alongside the scalar.** The scalar is for deciding; the components are for understanding — a reader who can't decompose your score can't usefully disagree with it.
2. **Publish the weights and their rationale.** Not just the numbers — the reasoning. A weight without a rationale is unfalsifiable.

A credit score is the everyday example. FICO publishes exactly what goes into the number:

| Component | Weight | Rationale |
|---|---|---|
| Payment history | 35% | Past repayment is the strongest signal of future repayment |
| Amounts owed (utilization) | 30% | How much of available credit is drawn predicts distress |
| Length of credit history | 15% | A longer track record is more data to trust |
| New credit / recent inquiries | 10% | A burst of applications signals risk |
| Credit mix | 10% | Handling varied credit types shows capability |

The unifying principle — recent behavior outweighs age and variety — is defensible. It is also a choice. A rival score built from the *same* credit file weights those categories differently, so one borrower reads "good" on one scale and "fair" on the other. The borrower didn't change; the editorial choices did — two objective computations, two verdicts, because two people weighted the same facts differently.

A stock index looks like one clean number — "the market," in a single line. It's really a set of choices: which companies get in, a rule that lets the biggest ones move it most, a calendar that decides when the list changes. The tidy number is the last place any of that shows. Every "overall score" runs the same trick — a scalar standing in front of the choices that built it.

## Does Your Ranking Survive a Weight Change? {#sensitivity-analysis}

The third honesty requirement is the one almost nobody publishes: **weight sensitivity**. Shift every weight ±50%, recompute, re-rank. If the order holds, the composite is telling you something about the things it ranks. If the order flips, the ranking is an artifact of the weights — a coin toss wearing precision.

Two candidates at 74 and 71 on a 100-point hiring composite will usually swap when one competency's weight moves from 15% to 22%; a gap like 91 versus 34 survives far more abuse before the verdict changes. Both produce an identical-looking ranking — only the sensitivity report tells "A beats B" apart from "A beats B under my weights, and barely." The survey literature on composite indicators (Greco et al. 2019) treats weight sensitivity as the central critique; any published index should hold itself to the same bar.

If your composite feeds a published ranking and you haven't perturbed the weights, you don't yet know whether you built a measurement or a slot machine.

## When Should You Composite at All? {#when-to-composite}

Composite when one decision needs one axis: approve or decline, pick one option, track one trend. Otherwise, keep the components apart. The failure modes of compositing too eagerly:

- **Compositing metrics that answer different questions.** A hospital's surgical-complication rate and its patient-satisfaction survey measure different things; fuse them into one "quality star" and you flatten exactly the difference a patient choosing a surgeon cares about. [Different questions need different metrics](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) — a composite across them answers a question nobody asked.
- **Compositing proxies.** A weighted blend of GDP and a stock-market index [measures froth twice](https://ofriperetz.dev/articles/proxy-metrics) and wellbeing never. Compositing inherits every gap between each proxy and its target — and hides them better.
- **Confusing reliability with validity.** A composite is perfectly reliable by construction — same inputs, same scalar, every time. That says nothing about whether it tracks anything you care about: [reliability and validity are different properties](https://ofriperetz.dev/articles/valid-vs-reliable-metrics), and a composite gets the first free while borrowing credibility for the second.
- **Imputing missing dimensions.** If a dimension isn't measured yet, report the composite as n-of-k with the nulls visible. Never fill the hole with a neutral midpoint — imputing manufactures data and launders "we didn't measure it" into "it's average."

One composite handles this well: the big global university rankings publish their weights — teaching, research, citations, international outlook — beside the score. Move the research weight down and teaching up, and the top of the table reshuffles with not one underlying number changed. Because the weights are public, you can run that experiment yourself and check whether the verdict survives *your* priorities. That is the test a composite should invite — and the [benchmark where I put these exact weighting choices to work on real numbers](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) is where my own weights do the same job.

## What Does an Honest Composite Look Like in the Wild? {#case-studies}

Three reference implementations, all with public methodology — the bar any honest composite gets measured against:

**Lighthouse.** Google publishes the weights behind its web-performance score, per metric, per version. The weights *changed* between versions — the same page scores differently with zero change to the page. That looks like a flaw and is the discipline: versioning the metric versions the verdict — made visible instead of silently moved.

**OpenSSF Scorecard.** A 0–10 composite rating an open-source project's security health across roughly 18 automated checks, methodology public. Every check, weight, and aggregation step is inspectable, so arguments about a score become arguments about the methodology — the genre done in the open.

**The Human Development Index.** The UN's HDI folds life expectancy, education, and income into one number with a published formula — and in 2010 it switched from an arithmetic to a geometric mean, reshuffling country rankings with not one underlying statistic changed. A public formula is why decades of critique stayed arguments about method, not mysteries.

None of this is new. The OECD/JRC handbook standardized composite-indicator construction in 2008 — normalization and sensitivity analysis as required steps. Most published scores ignore that literature; the fix is cheap. Publish the components. Publish the weights and why. Publish what happens when they move. Then let people argue with the weights instead of trusting them.

Every component inside every composite rests on something more fundamental: somebody deciding what the right answer was. That's the next question — ground truth.

---

## Quick Reference {#quick-reference}

| Rule | Why |
|---|---|
| Publish components alongside the scalar | The scalar decides; the components explain |
| Publish weights AND rationale | A weight without reasoning is unfalsifiable |
| Publish weight sensitivity (±50% re-rank) | If the order flips, the ranking is a weight artifact |
| Normalize before weighting | Otherwise the biggest-range metric silently wins |
| Report missing dimensions as n-of-k | Imputing a neutral value manufactures data |
| Version the weights | Changed weights = changed verdicts; readers must see which version scored them |
| Composite only when one decision needs one axis | Dashboards can keep the seven numbers; gates can't |

---

## Related Reading

- [Ranking vs measuring](https://ofriperetz.dev/articles/ranking-vs-measuring) — a ranking is a composite with hidden weights
- [Valid vs reliable metrics](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) — composites are reliable by construction, valid only by design
- [Proxy metrics](https://ofriperetz.dev/articles/proxy-metrics) — compositing proxies compounds their gaps
- [Different metrics for different package types](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) — the worked benchmark where these weighting choices earn their keep
- [Sample size and statistical power](https://ofriperetz.dev/articles/sample-size-and-statistical-power) — small-n components make every composite twitchy

## References

- OECD / JRC European Commission (2008). *[Handbook on Constructing Composite Indicators: Methodology and User Guide](https://doi.org/10.1787/9789264043466-en)*. OECD Publishing. The authoritative methodology reference — a ten-step construction process in which normalization and sensitivity analysis are required, not optional. Free PDF from the OECD.
- Greco, S., Ishizaka, A., Tasiou, M., & Torrisi, G. (2019). "[On the Methodological Framework of Composite Indices: A Review of the Issues of Weighting, Aggregation, and Robustness](https://doi.org/10.1007/s11205-017-1832-9)." *Social Indicators Research*, 141, 61–94. Survey of composite-indicator critiques; weight sensitivity is the recurring one.
- Google Chrome team. *[Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)* (developer.chrome.com/docs/lighthouse/performance/performance-scoring). Per-metric weights, per version, with a public score calculator — the worked example of versioned weights.
- OpenSSF. *[Scorecard documentation](https://github.com/ossf/scorecard)* (github.com/ossf/scorecard). Checks, weights, and aggregation for the 0–10 composite — the transparency benchmark for a security-health score.
- UNDP. *[Human Development Report — Technical Notes](https://hdr.undp.org/)* (hdr.undp.org). The HDI methodology, including the 2010 shift from an arithmetic to a geometric mean — a worked example of an aggregation choice moving rankings with no change in the data.

---

If this is a reference you'll want open the next time someone hands you an "overall score," bookmark it — and I publish the rest of this measurement series on [Dev.to](https://dev.to/ofri-peretz); follow there to catch the next one.

*Foundations series: ← [Proxy metrics](https://ofriperetz.dev/articles/proxy-metrics) · [hub](https://ofriperetz.dev/foundations) · [Ground truth in security testing](https://ofriperetz.dev/articles/ground-truth-in-security-testing) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
