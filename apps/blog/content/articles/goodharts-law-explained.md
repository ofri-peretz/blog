---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/goodharts-law-explained-og.jpg"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/goodharts-law-explained.jpg"
title: "Goodhart's Law in Benchmarking: When the Metric Becomes the Target"
description: "When a measure becomes a target, it ceases to be a good measure. Goodhart's Law is the failure mode where moving a number and improving the thing the number stood for split into two projects — and the cheaper one wins by default."
slug: "goodharts-law-explained"
published: true
date: 2026-07-17
tier: "T0"
series: "Foundations"
arc: 5
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
devto_id: 4176293
canonical_url: https://ofriperetz.dev/articles/goodharts-law-explained
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A benchmark score going up is not evidence that the thing it measures got better. In 2015, regulators found that roughly 11 million diesel cars were running software that could sense when they were strapped to an emissions test bench. On the bench, the engine ran clean and passed. On the open road, the same cars poured out nitrogen oxides at up to 40 times the legal limit. The lab number was real, repeatable, and completely unglued from the air people actually breathed. Goodhart's Law names that gap: the moment a measure becomes a target, moving the number and improving the thing the number stood for become two separate projects — and the cheaper one wins by default.

---

## What Does Goodhart's Law Actually Say? {#goodharts-law}

The line everyone quotes — "when a measure becomes a target, it ceases to be a good measure" — is **Marilyn Strathern's** 1997 phrasing, from her essay on audit in the British university system. The underlying observation belongs to **Charles Goodhart**, from a 1975 paper on UK monetary policy: statistical regularities used for control tend to collapse the moment they're used that way. Strathern coined the sentence everyone repeats; Goodhart found the mechanism it describes. Crediting the aphorism to Goodhart directly is the single most common way this concept gets misquoted, so it's worth being precise once, here.

The mechanism doesn't stay inside economics. Strathern's own case is publication counts: fund researchers by paper count and paper count rises, while research quality — the thing the metric was meant to track — has no obligation to follow. A school rewarded for test scores gets teaching-to-the-test. A support team scored on ticket-close time gets closed tickets, not solved problems. A hospital judged on a four-hour wait target parks patients in ambulances outside the door so the clock never starts. Campbell's Law (1979) reached the identical conclusion independently, from social-policy research — the generalization across domains is the rule here, not the exception. [Proxy metrics](https://ofriperetz.dev/articles/proxy-metrics) covers the same gap from the other side: Goodharting is what happens when the distance between a proxy and the thing it stands for gets exploited — on purpose, or without anyone noticing they're doing it.

I spend a lot of time reading markets, and it is the cleanest place to watch this happen in public. A company gets judged on one number — quarterly earnings per share — and slowly the number becomes the job. Revenue gets smoothed across quarters, buybacks get timed to lift the per-share figure, portfolios hug the index so no one ever looks wrong next to their peers. None of it grows the underlying business; all of it moves the number the business is graded on. In a landmark survey of 401 financial executives, Graham, Harvey and Rajgopal (2005) found that roughly 78% would sacrifice real economic value to report a smoother earnings number. That is managing to the number — Goodhart's Law with a salary and a shareholder deck.

None of this requires bad intent. Someone who has internalized what their system is good at will naturally build a test that rewards those strengths — not to cheat, but because those are the cases they have thought hardest about. The corruption is structural, not motivational.

> **Named misconception:** Goodhart's Law only applies to organizational metrics — KPIs, school scores, performance reviews. It applies anywhere a person with an incentive to look good controls both the thing being measured and the measurement itself, technical benchmarks fully included.

---

## The Three Ways a Benchmark Gets Gamed {#manifestations}

**Building the test around what you already pass** is the highest-risk form, because it doesn't feel like cheating. A trading desk that tunes a strategy on the exact price history it then reports returns against will always show a winner — the back-test and the design drew on the same data, so nothing is left to discover; the out-of-sample market it meets next is a different world. A school that drills the precise question bank lifts scores without lifting learning. The fix is sequencing, not virtue: fix the test from an independent standard *before* you build the thing it grades, so the test still has the power to surprise you.

**Choosing weak comparators** is the easiest form to execute and the easiest to hide. A fund benchmarks its returns against a deliberately soft index; a 40-0 boxing record gets built on hand-picked opponents; a new drug is trialled against a placebo when a proven standard-of-care treatment already exists and would be the honest thing to beat. A headline that reads "beats five rivals" means nothing if the five were chosen because they couldn't fight back. The defense is to compare against the strongest available alternative, at its current best — not the version that makes your margin look widest.

**Cherry-picking categories** is the quiet one: report only the dimensions where you win. A company highlights the two product lines that grew and buries the four that shrank; a study reports the three endpoints that moved and drops the ones that didn't. The defense is the same as for weak comparators, aimed at the scoreboard's rows instead of its opponents — state which categories you cover and which you don't in the same breath as the score, not in a footnote three sections later.

---

## What Keeps a Metric From Getting Goodharted {#prevention}

Four controls, not principles:

- **Fix the test before you build what it grades.** Medicine already institutionalized this: clinical trials pre-register their primary endpoint on a public registry before the data comes in, precisely so no one can go hunting for a flattering result afterward. Declaring the target in advance is what keeps the target honest.
- **Publish the whole protocol and the raw data.** Opacity is what lets Goodharting persist; publication is the structural antidote. If the choices that quietly favor one result over another are all on the table, anyone can check them — the claim stops depending on trust.
- **Publish the losses, not only the wins.** Warren Buffett's shareholder letters open with his own mistakes for a reason: a self-report that leads with where it fell short is far more credible than one that only ever wins. The hardest version of this is a benchmark whose author also wrote the thing under test — there, leading with your own false positives is the only thing that makes the wins believable.
- **Check the clean number against a messy one.** A system that scores perfectly on a curated test but stumbles on real, uncontrolled data was fit to the test, not to the world. A held-out real-world sample is the cheapest way to catch a result that was shaped to fit.

The riskiest number of all is the single aggregate score: one figure is easy to move without moving what it summarizes, because averaging hides exactly which parts improved and which quietly got worse. [Composite scores and weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) covers why a matrix resists Goodharting better than a scalar does — moving five numbers in the same direction, unnoticed, is harder than moving one.

Before trusting any benchmark, ask one question: which came first, the test or the thing it grades? If the answer is "the thing, then a test built to fit it," the score is measuring the author's confidence, not the capability. It's a fair question to ask of anyone's numbers — including mine.

*Cited by: [I Built What I Benchmark](https://ofriperetz.dev/articles/i-built-what-i-benchmark-heres-how-i-try-not-to-cheat) — these four controls run through a live conflict of interest, a benchmark whose author wrote the tool under test — and [its false-positive benchmark](https://ofriperetz.dev/articles/eslint-security-fn-fp-benchmark), the evidence table built on this foundation.*

If this cleared up why a rising score can still be the wrong signal, bookmark the page — and [follow me on Dev.to](https://dev.to/ofri-peretz) for the rest of the measurement series.

---

## Quick Reference {#quick-reference}

| Form | What it looks like | Prevention |
|------|-------------------|------------|
| Test built to fit | A perfect pass rate on a test designed after you already knew the answer | Fix the test from an independent standard before building what it grades |
| Category cherry-picking | "We score well on the five dimensions we chose to report" | Report every dimension you claim to cover — wins and losses in the same place |
| Weak comparators | Winning against opponents picked because they can't fight back | Compare against the strongest available alternative, at its current best |
| Post-hoc tuning | Re-tuning to lift the score without re-checking real-world effect | Validate on a held-out, real-world sample before republishing |
| Aggregation | A single overall score that hides which parts got worse | Publish the component numbers next to the total |

---

## References

Goodhart, C. A. E. (1975). Problems of Monetary Management: The UK Experience. *Papers in Monetary Economics*, Reserve Bank of Australia, vol. 1. The original paper — monetary policy context, but Goodhart himself never claimed the principle was domain-specific.

Strathern, M. (1997). ["Improving Ratings": Audit in the British University System](https://doi.org/10.1002/%28SICI%291234-981X%28199707%295:3%3C305::AID-EURO184%3E3.0.CO;2-4). *European Review*, 5(3), 305–321. The source of the "measure becomes a target" phrasing commonly misattributed to Goodhart; her academic-audit case is the generalization that made it a standalone aphorism.

Campbell, D. T. (1979). [Assessing the Impact of Planned Social Change](https://doi.org/10.1016/0149-7189%2879%2990048-X). *Evaluation and Program Planning*, 2(1), 67–90. Campbell's Law — the independent social-science formulation of the same structural mechanism, reached from outside economics entirely.

Graham, J. R., Harvey, C. R., & Rajgopal, S. (2005). [The Economic Implications of Corporate Financial Reporting](https://doi.org/10.1016/j.jacceco.2005.01.002). *Journal of Accounting and Economics*, 40(1–3), 3–73. A survey of 401 financial executives in which a large majority — roughly 78% — reported they would sacrifice long-term economic value to smooth reported earnings or hit an earnings target. The empirical source behind the earnings-management example above.

Manheim, D., & Garrabrant, S. (2018). [Categorizing Variants of Goodhart's Law](https://arxiv.org/abs/1803.04585). *arXiv:1803.04585*. A modern taxonomy separating the distinct failure modes bundled under "Goodhart's Law" (regressional, extremal, causal, adversarial) — useful background before designing a measurement system of your own.

---

*Foundations series: ← [Bias in measurement](https://ofriperetz.dev/articles/bias-in-measurement) · [hub](https://ofriperetz.dev/foundations) · [Reproducibility vs replicability](https://ofriperetz.dev/articles/reproducibility-vs-replicability) →*

*Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)*
