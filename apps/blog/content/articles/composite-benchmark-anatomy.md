---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/composite-benchmark-anatomy.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/composite-benchmark-anatomy.jpg"
devto_url: "https://dev.to/ofri-peretz/25-of-my-benchmark-verdict-is-an-opinion-heres-the-anatomy-294d"
devto_id: 4183788
title: "25% of My Benchmark Verdict Is an Opinion. Here's the Anatomy."
description: "My serverless benchmark prints 0.88 vs 0.3025 — real measurements running on editorial weights. Every index has a committee; the only real question is whether it publishes its votes. Mine are here: seven dimensions, the null policy, and a ±50% attack on the weights."
slug: "composite-benchmark-anatomy"
published: true
date: 2026-07-19
tags:
  - "serverless"
  - "devops"
  - "node"
  - "aws"
canonical_url: https://ofriperetz.dev/articles/composite-benchmark-anatomy
tier: "T2"
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

On 2026-05-04, my benchmark harness printed its verdict on two Serverless Framework caching plugins: mine scored **0.88**; the community incumbent, **0.3025**. Every digit of that gap is arithmetic — seven dimensions, each one measured, normalized, weighted, summed. The raw JSON actually stores my side as `0.8800000000000001`, kept as-is: IEEE 754's reminder that a number can be very precise about being an opinion. Because the most consequential input in that file was never measured by any instrument: **Lifecycle Correctness is worth 25% of the score because I said so.**

A composite score is opinions wearing a number costume — the general argument, and the honesty requirements any composite owes its readers, live in [Composite Scores and Weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting), and I won't re-derive them here. What I owe you instead is the costume's pattern, dimension by dimension — including whether the verdict survives when you attack the weights.

---

## What are the seven dimensions — and where does each number come from? {#the-seven-dimensions}

| Dimension             | Weight | Interlace | Community  | Measured from                  |
| --------------------- | ------ | --------- | ---------- | ------------------------------ |
| Lifecycle Correctness | 25%    | 1.0       | 0.5        | local source + live AWS deploy |
| CLI Surface           | 15%    | 1.0       | 0.0        | local source                   |
| TypeScript Coverage   | 15%    | 1.0       | 0.0        | npm registry\*                 |
| Maintenance Signal    | 15%    | 1.0       | 0.0        | npm registry\*                 |
| Bundle Weight         | 10%    | **0.0**   | **1.0**    | npm registry\*                 |
| Hook Coverage         | 10%    | 1.0       | 0.375      | local source                   |
| Documentation Quality | 10%    | 0.8       | 0.4        | README scan                    |
| **Composite**         | Σ=1.0  | **0.88**  | **0.3025** |                                |

_\* Community side only. The Interlace values in these rows came from local source (`"source": "local"` in the result file) — version 0.0.0 has never been published._

Run stamped 2026-05-04, Node v24.12.0 on darwin/arm64. Two disclosures before anything else. First: my `@interlace/serverless-api-gateway-caching` was measured from local source at version 0.0.0, while the community's `serverless-api-gateway-caching` is the published 1.11.0 from the registry. That asymmetry makes one score in the table an artifact, not a measurement: my Maintenance Signal 1.0 rests on `daysSincePublish: 0, totalVersions: null, weeklyDownloads: 0` — an unpublished plugin scores perfect maintenance while the community's real 379-day publish gap scores 0. Read that row as _unmeasured_, not _excellent_. Second: the lifecycle numbers are not simulations. Both plugins went through a live-AWS end-to-end lifecycle run, and the two E2E result files sit on disk stamped 43 minutes apart from the same night.

The "measured from" column matters as much as the scores. Registry-sourced dimensions are [proxy metrics](https://ofriperetz.dev/articles/proxy-metrics): publish cadence stands in for maintenance, type definitions stand in for TypeScript support. And a README scan is [reliable without being automatically valid](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) — it returns the same 0.8 every run; whether 0.8 captures what "good documentation" means to you, the harness cannot answer.

## How do kilobytes, hook counts, and pass rates become one scale? {#normalization}

The seven dimensions arrive in incompatible units: bundle size in kilobytes, hook coverage as a count of lifecycle hooks handled, lifecycle correctness as pass/fail steps against a live deploy, documentation as a scan score. A weighted sum over raw units lets the biggest-range unit silently win — the classic [mixing-scales trap](https://ofriperetz.dev/articles/composite-scores-and-weighting). So every dimension is normalized to 0–1 before any weight touches it.

The community plugin's Hook Coverage of 0.375 is not a grade someone typed in — it's 3 hooks counted against a ceiling of 8, and that ceiling is my own plugin's full hook-and-command surface, which guarantees my side a 1.0. That denominator is a normalization policy that happens to flatter its author, and it deserves the same suspicion as the bundle curve coming next. On Bundle Weight, my 78 KB unpacked against the community's 47 KB came out 0 against 1 — which tells you the normalization curve is itself a policy decision. A gentler curve would have given my 78 KB partial credit; this one didn't, and I left it that way. Normalization choices change scores without changing a single measurement, so they belong in the published methodology, not in a footnote you have to diff the source to find.

## What happens when a dimension can't be measured? {#null-dimensions}

The harness has a standing rule for dimensions it cannot measure — historically the AWS-dependent ones, when there's no live deploy to run against: score them **null** and never impute a value. An imputed dimension is an invented measurement wearing the same costume as the real ones. But the null path deserves the least flattering disclosure in this article: when nulls are present, `compositeScore` renormalizes over the measured subset — null dimensions drop out of both numerator and denominator — so a partial run still prints one clean-looking composite. Renormalizing isn't imputation, but it quietly moves weight onto whatever happened to be measurable. The day before this run did exactly that: three of seven dimensions measured, and the harness stored `0.7499999999999999` vs 0.25 — IEEE 754 again, equally precise about a composite built from 40% of the total weight, with nothing in the numbers admitting four dimensions were missing. The _n_-of-7 label that makes a partial composite honest currently lives one layer up, in [the claims registry](https://ofriperetz.dev/articles/claims-registry-evidence-framework) rather than the harness output — a real gap: "3-of-7, here's what's missing" should be printed by the code, not patched on at the claims layer. In this run the null path went unused — `dimensionScores` holds numeric values for all seven keys, on both plugins (don't cite the `skipped` array for this; it was empty in the partial run too) — and I'm telling you anyway, because a policy you only hear about when it's exercised is a policy you can't audit.

## Why is Lifecycle Correctness worth 25% — and who decided? {#weights-rationale}

I decided. Here's the reasoning, in tiers.

**25% — the damage tier.** Lifecycle Correctness is the only dimension where failure means the plugin actively harms your deployment instead of merely annoying you. A caching plugin that mishandles the deploy lifecycle doesn't degrade politely — it leaves your API Gateway stage in a state you didn't ask for.

**15% × 3 — the daily-use tier.** CLI Surface, TypeScript Coverage, Maintenance Signal: the things you touch or depend on every working day. Individually smaller than correctness, collectively 45% of the score.

**10% × 3 — the comfort tier.** Bundle Weight, Hook Coverage, Documentation Quality: real costs you can see coming and route around.

Reasonable people could defend a different split — which is the point. The common misconception is that **a benchmark score computed from real measurements is objective.** The measurements are objective; the weights they run through are editorial, and computed is not neutral. Nor is admitting that unusual: Lighthouse versions its scoring weights and OpenSSF Scorecard publishes its full methodology — the composite-scores canonical walks both. Same page, new Lighthouse version, different score — which means every performance score you've ever pasted into a report was a committee vote you didn't attend. Every index has a committee. The only real question is whether the committee publishes its votes.

## Does the winner survive a ±50% attack on the weights? {#sensitivity}

If a ranking flips when the weights shift, the composite is telling you about the committee, not the plugins. So attack mine as hard as ±50% allows. Halve every weight where my plugin leads: Lifecycle to 12.5%, CLI, TypeScript, and Maintenance to 7.5% each, Hooks and Docs to 5% each. Raise the one dimension where my plugin _loses_ — Bundle Weight — by half, to 15%. Renormalize so the weights sum to 1.0 again.

The composite becomes roughly **0.73 vs 0.42**. The order holds, and not by luck: the community plugin leads exactly one dimension out of seven, so no ±50% reweighting exists in which one 10%-class dimension outvotes six others. Push past ±50% and, holding the other six weights in proportion, Bundle Weight needs roughly **43% of the whole composite** — against its actual 10% — to flip the winner. The gap is score-broad, not weight-fragile.

That surviving loss deserves its own sentence. My plugin scores **0** on Bundle Weight — 78 KB unpacked against the community's 47 KB — and it's printed in the table above at full weight, in a benchmark I wrote, scoring a plugin I built, under weights I chose. That conflict of interest is real, and the two controls you can audit against it are the published loss and the sensitivity math you can redo on a napkin — the full self-benchmark process is in [I Built What I Benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat). A composite that survives its own worst dimension in public is worth more than one that never shows a loss.

If you'd have weighted it differently, don't argue in the abstract — the whole run is one command: `npm run bench:caching` from `serverless/benchmarks`, and this run's output sits at `benchmarks/benchmark-results/api-gateway-caching/2026-05-04_v1.0/result.json` in the repo. Change the weights, re-run it; if your reweighting flips the order, that's a finding and I want it in an issue. The strongest evidence that this harness follows the data even when it disagrees with me is the next article in this series: the time our loudest serverless claim died under its own E2E run — [We Were Wrong About sls remove](https://ofriperetz.dev/articles/we-were-wrong-about-sls-remove).

---

## Quick reference {#quick-reference}

| Question                     | Answer                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| What is the composite?       | Weighted sum over 7 dimensions; weights sum to 1.0                                                                         |
| Result (2026-05-04 run)      | Interlace **0.88** vs community **0.3025**; all 7 dimensions measured                                                      |
| Who sets the weights?        | The author — editorial, published, versioned with the results                                                              |
| Weight tiers                 | Damage 25% · daily-use 15%×3 · comfort 10%×3                                                                               |
| Mixed units?                 | Every dimension normalized to 0–1 before weighting                                                                         |
| Unmeasurable dimension?      | Null, never imputed; harness renormalizes over measured dims — _n_-of-7 label lives at the claims layer (this run: 7-of-7) |
| ±50% adversarial reweighting | ~0.73 vs ~0.42 — the order holds                                                                                           |
| The honest loss              | Bundle Weight: 78 KB vs 47 KB → scored 0 vs 1, published at full weight                                                    |
| Versions measured            | Interlace 0.0.0 (local source, unpublished) vs community 1.11.0 (npm)                                                      |
| Reproduce                    | `npm run bench:caching` in `serverless/benchmarks` → `benchmark-results/api-gateway-caching/`                              |

## External references

- [OECD/JRC — Handbook on Constructing Composite Indicators: Methodology and User Guide (2008)](https://doi.org/10.1787/9789264043466-en) — the authoritative methodology reference for composite indicators; the normalization and sensitivity sections above are the single-benchmark version of its checklist.
- [Lighthouse performance scoring documentation](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring) — Google's published, versioned scoring weights: the working precedent for treating a weight change as a verdict change.

---

_What's the largest weight you'd assign differently in that table — and which dimension would you demote to pay for it?_

---

## Related deep dives

- [Composite Scores and Weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) — the tier-0 canonical this benchmark instantiates: why composites exist, the honesty requirements, and the Lighthouse / OpenSSF Scorecard case studies
- [I Built What I Benchmark. Here's How I Try Not to Cheat.](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — the conflict-of-interest process behind every benchmark on this site
- [The Claims Registry](https://ofriperetz.dev/articles/claims-registry-evidence-framework) — the claim→evidence-file contract that this run's result file feeds
- [Proxy Metrics](https://ofriperetz.dev/articles/proxy-metrics) — why registry-sourced dimensions measure stand-ins, not the thing itself
- [Valid vs Reliable Metrics](https://ofriperetz.dev/articles/valid-vs-reliable-metrics) — the difference a README scan can't close on its own

{% cta https://github.com/ofri-peretz/serverless %} Star the serverless repo — you've just read exactly how its scores are built {% endcta %}

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
