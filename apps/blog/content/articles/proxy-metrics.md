---
devto_url: "https://dev.to/ofri-peretz/proxy-metrics-the-number-you-optimize-is-not-the-thing-you-want-kml"
devto_id: 4182397
title: "Proxy Metrics: The Number You Optimize Is Not the Thing You Want"
description: "GDP is not prosperity, price is not value, a test score is not learning. Every dashboard number stands in for a construct it can't fully measure — the discipline is knowing each gap and pairing every proxy with the counter-metric that catches its gaming."
slug: "proxy-metrics"
published: true
date: 2026-07-17
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/proxy-metrics
reading_time_minutes: 6
tier: "T0"
series: "Foundations"
arc: 12
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

Every number on a dashboard is a proxy. GDP stands in for a nation's prosperity, yet it counts a car crash and the cleanup afterward as growth, while a parent raising three children for free adds nothing to it. A blood-pressure reading stands in for cardiovascular health, yet it climbs the instant a nervous patient sits down in the cuff. A credit score stands in for whether a borrower will repay, yet it cannot see the lifelong renter who simply never borrowed. Each of these is the best single number anyone has, and each is wrong in a way the number itself will never show you.

I reach for numbers like these anyway. Refusing proxies is not discipline; it is refusing to measure, because almost nothing worth wanting can be measured directly. The discipline is knowing, precisely, what each number fails to measure.

I learned the distinction from markets before I ever learned it from a dashboard. A stock's price is a proxy for a business's worth — precise to the cent, quoted all day, and routinely wrong. Mr. Market hands you a fresh number every morning; the discipline is remembering the number is his mood, not the company. I read every metric that way now. GDP is not prosperity, a download is not a decision, and the morning you forget the gap is the morning you start buying the map instead of the territory.

---

## What a Proxy Metric Is {#what-a-proxy-is}

A proxy metric is a measurable stand-in for something you cannot measure directly. The thing you actually want — measurement theory calls it the _construct_ — is almost always abstract: "health," "prosperity," "skill," "quality," "security." What you can observe is a correlate: blood pressure, GDP, a credit score, a customer-satisfaction survey, a scan for known-bad patterns. The correlate is the proxy. The construct is why you bothered.

This is the normal condition of measurement, not a defect. Medicine runs on it: a drug trial may track a _surrogate endpoint_ — lower blood sugar, a shrinking tumor — because the real endpoint, living longer, takes years to observe. Sometimes the surrogate moves and the patient does not. A class of anti-arrhythmic drugs once corrected the irregular heartbeats they targeted while quietly raising deaths: the proxy improved and the construct got worse at the same time. The pattern is identical across domains; only the nouns change.

Value investing has the cleanest statement of the idea. "Price is what you pay; value is what you get," as Warren Buffett put it — the market prints a precise number all day, and that number is a proxy for a value nobody can observe directly. Investors who forget the distinction buy prices. The rest of us optimize dashboards.

A proxy is _good_ exactly to the degree that it tracks its construct — a question of [validity, not reliability](https://ofriperetz.dev/articles/valid-vs-reliable-metrics). A metric can be perfectly reliable, returning the same number on every run, while measuring the wrong thing every time.

## The Proxy Gap {#the-proxy-gap}

The proxy gap is the distance between what a metric actually measures and what you read it as. Two properties make it dangerous.

First, the gap is invisible in the number itself. A statistics office reports 3% GDP growth; nothing in the figure tells you whether it came from rising wages or from rebuilding after a flood. The gap lives entirely outside the data, in the difference between the measurement procedure and the construct — so no amount of staring at the metric reveals it.

Second, the gap widens under optimization pressure. This is [Goodhart's Law](https://ofriperetz.dev/articles/goodharts-law-explained) doing its work: the moment you target a proxy, you improve it by the cheapest available route, and the cheapest route rarely runs through the construct. A school told to raise its average exam score can teach better — or it can quietly counsel its twenty weakest students to stay home on test day. The second route is cheaper.

> **Named misconception:** "If the metric goes up, the thing improved." The proxy moved. Whether the construct moved is a separate empirical question — and under optimization pressure the two actively diverge, because the cheapest way to move a proxy usually runs around the construct, not through it.

## Where Proxies Famously Fail {#proxy-failure-modes}

The failure pattern is old and well documented. Lines of code as a measure of programmer productivity is the ancestral software case: reward lines, receive lines — bloated code, duplicated logic, resistance to deletion. Tom DeMarco, who helped canonize measurement-driven software management, spent his 2009 _IEEE Software_ retrospective walking back how much of engineering should be governed by metrics at all.

Jerry Muller's _The Tyranny of Metrics_ (2018) is a book-length catalog of the same pattern outside software. His best-known case: score surgeons on their patients' mortality rates, and some surgeons stop operating on the sickest patients. The proxy improves while the construct — care for the people who most need it — gets worse. Muller finds the identical shape in policing (arrests over safety), in universities (citation counts over scholarship), and across public administration.

Software delivery produced its own famous proxy set with the DORA metrics (Forsgren, Humble & Kim, _Accelerate_, 2018). Deployment frequency stands in for delivery health; teams game it by slicing one release into ten trivial deploys — which is exactly why DORA pairs its speed metrics against stability metrics like change-failure rate. Forsgren then co-authored the SPACE framework (2021), which builds "no single metric" in as a founding principle rather than a caveat — the closest prior art to the counter-metric rule below, applied one metric at a time instead of at framework scale.

The audit generalizes to any dashboard: write down what a number _actually_ measures next to what you _wish_ it meant, and the gap becomes hard to un-see. Body-mass index measures weight over height squared, yet a muscular athlete and a sedentary desk worker can both post a BMI of 27 while sharing almost nothing about their health — a proxy built to describe populations, routinely misread as a verdict on an individual.

## How to Choose a Proxy {#choosing-proxies}

Two rules cover most of the discipline.

**Rule 1: prefer the proxy closest to the construct that you can afford to measure.** Risk-adjusted mortality sits closer to _quality of care_ than raw mortality, because it stops rewarding case-selection. Body-fat percentage sits closer to _health_ than BMI. Closer proxies almost always cost more to collect — more instrumentation, more time, more follow-up — which is exactly why the cheap, distant ones dominate dashboards. Treat that as a cost decision you are making, not a fact of nature.

**Rule 2: pair every proxy with a counter-metric that catches its gaming.** Deployment frequency pairs with change-failure rate. A sales team's _calls made_ pairs with _deals closed_, so nobody wins by dialing numbers and hanging up. A model that looks flawless on the data it was tuned on pairs with a test on data it has never seen — because the [base rate](https://ofriperetz.dev/articles/base-rate-problem-explained) of what you are hunting is rarely the same in the wild as in the sample you built on. A proxy with no counter-metric is an unfalsifiable claim wearing a number.

Proxies are not the enemy. They are the only measurements you will ever have, and the honest dashboard is not the one with the fewest numbers — it is the one whose owner can state each number's gap out loud. The next problem arrives immediately after: you hold five honest proxies and a decision that needs one number. Merging them means choosing weights, and weights are opinions — that is the subject of [composite scores and weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting), next in this series.

If this page earns a bookmark, take it — and [follow me on Dev.to](https://dev.to/ofri-peretz) to catch the next canonical in the measurement series as it lands.

---

## Quick Reference {#quick-reference}

| Proxy                   | Construct it stands in for | Known gap                                  | Counter-metric pairing                   |
| ----------------------- | -------------------------- | ------------------------------------------ | ---------------------------------------- |
| GDP                     | National prosperity        | Counts disasters and cleanup as growth     | Median wage · wellbeing surveys          |
| Stock price             | A business's worth         | Sentiment, momentum, and mood              | Owner earnings · free cash flow          |
| Body-mass index         | Health                     | Muscle reads as fat; built for populations | Body-fat % · metabolic panel             |
| Standardized test score | Learning                   | Teaching to the test; roster gaming        | Transfer tasks · later-life outcomes     |
| Deploy frequency        | Delivery health            | Trivial-deploy slicing                     | Change-failure rate (DORA's own pairing) |
| Lines of code           | Productivity               | Rewards verbosity, punishes deletion       | None — retire it                         |

---

## References

Goodhart, C. A. E. (1975). "Problems of Monetary Management: The UK Experience." _Papers in Monetary Economics_, Reserve Bank of Australia. The original observation that statistical regularities collapse once used for control — the mechanism behind every widening proxy gap.

Strathern, M. (1997). "['Improving Ratings': Audit in the British University System](https://www.cambridge.org/core/journals/european-review/article/abs/improving-ratings-audit-in-the-british-university-system/FC2EE640C0C44E3DB87C29FB666E9AAB)." _European Review_, 5(3), 305–321. The source of the familiar measure-becomes-target phrasing commonly misattributed to Goodhart; her university-audit case is itself a proxy-gap study.

Muller, J. Z. (2018). _[The Tyranny of Metrics](https://press.princeton.edu/books/paperback/9780691191911/the-tyranny-of-metrics)_. Princeton University Press. The book-length catalog of proxy failures across medicine, education, policing, and business — the surgeon-scorecard case above is his.

Forsgren, N., Humble, J., & Kim, G. (2018). _[Accelerate: The Science of Lean Software and DevOps](https://itrevolution.com/product/accelerate/)_. IT Revolution Press. Defines the DORA metrics and, notably, pairs speed metrics with stability metrics precisely to resist single-proxy gaming.

Forsgren, N., Storey, M.-A., Maddila, C., Zimmermann, T., Houck, B., & Butler, J. (2021). "[The SPACE of Developer Productivity](https://doi.org/10.1145/3454122.3454124)." _ACM Queue_, 19(1). The framework that made "no single metric" a design principle rather than a disclaimer — prior art for per-metric counter-pairing.

DeMarco, T. (2009). "[Software Engineering: An Idea Whose Time Has Come and Gone?](https://doi.org/10.1109/MS.2009.101)" _IEEE Software_, 26(4). A founder of software-metrics culture revisiting how much control measurement should really carry — the field's most cited note of metrics humility.

---

_Cited by / worked examples: [I built what I benchmark — how I try not to cheat](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) runs this exact audit on a detection tool, where a perfect score on a corpus you wrote yourself is partly a statement about the corpus; [the FP-tax benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark) is the leaderboard those numbers come from._

_Foundations series: ← [Valid vs reliable metrics](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) · [hub](https://ofriperetz.dev/foundations) · [Composite scores & weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) →_

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
