---
devto_url: "https://dev.to/ofri-peretz/valid-vs-reliable-metrics-consistent-numbers-can-still-be-wrong-1a2m"
devto_id: 4182401
title: "Valid vs. Reliable Metrics: Consistent Numbers Can Still Be Wrong"
description: "A clock that runs ten minutes fast is perfectly reliable — the same wrong time every read — and completely invalid. Reliability and validity are independent properties, and confusing them is how confident dashboards stay green while the thing they measure quietly fails."
slug: "valid-vs-reliable-metrics"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/valid-vs-reliable-metrics-og.jpg?v=b2"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/valid-vs-reliable-metrics.jpg?v=b2"
published: true
date: 2026-07-17
published_at: "2026-07-19T23:47:32.870Z"
tier: "T0"
series: "Foundations"
arc: 11
tags:
  - "security"
  - "devsecops"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/valid-vs-reliable-metrics
reading_time_minutes: 6
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

A clock that runs ten minutes fast is the friendly kind of broken: it shows the same answer every time you look, so it feels dependable — right up until it makes you miss the train. The clock was never inconsistent. It was consistently wrong, which is the harder problem, because consistency is the part that looks like quality. That gap between _steady_ and _correct_ is the oldest distinction in measurement theory, and it's the one most dashboards quietly skip: a number can be perfectly **reliable** — the same value on every read — and still be **invalid** — pointed at the wrong quantity. Precision of the wrong thing is still the wrong thing.

Reliability versus validity applies identically whether you weigh yourself, price a stock, score a diagnostic test, grade a diver, or benchmark software. Reliability is a property of the instrument; validity is a property of the claim you attach to its number. They are independent — you can have either without the other — and telling them apart is the whole job.

## What Makes a Metric Reliable? {#reliability}

A metric is **reliable** when repeated measurement under the same conditions returns the same number. A scale that reads 82.0 kg five times in a row is reliable. A lab assay that returns 5.4 mmol/L on the same blood sample, run three times, is reliable — same sample, same number. Reliability never asks whether 82.0 or 5.4 is _correct_; only whether the instrument will say it again.

Reliability is a property of the _instrument_, not of the truth. That makes it the cheap property to check: you don't need to know anything about the world — take the measurement twice and compare. It's also the property people naturally police, because unreliability is loud. A blood-pressure cuff that gives a different reading every squeeze, a poll that swings ten points between identical samples, a stopwatch that disagrees with itself — a wobbling number announces itself, gets questioned, gets fixed.

That loudness is exactly what makes reliability feel like quality. It isn't. It's half of quality, and it's the easy half.

## What Makes a Metric Valid? {#validity}

A metric is **valid** when it measures the concept you claim it measures. Psychometricians call this _construct validity_: the "construct" is the real thing you care about — health, aptitude, risk, security — and validity is how faithfully your number tracks it.

Three general examples, in increasing order of how much they cost when they're wrong:

- **A scale that is 2 kg off** reads 82.0 kg every time while you actually weigh 80. Perfectly reliable, invalid for "my actual weight." A calibration error doesn't reduce consistency at all — which is precisely why it survives.
- **Standardized tests** produce famously reliable scores: retake next week, get nearly the same number. The century-old argument is entirely about validity — whether the score measures aptitude or measures practice at taking that kind of test.
- **A call center reports 95% of calls answered within 20 seconds** — cleanly measured, stable month to month. But the customers who gave up before connecting were never in the denominator. The metric is valid for "answered calls, handled fast" and invalid for "customers who could reach us," and the gap between those two is where the complaints live.

This framing isn't mine. Messick's 1989 treatment made construct validity the organizing idea of measurement in the social sciences, and Jacobs & Wallach ported the framework to computational systems in 2021. The practitioner translation: every number you publish is implicitly a validity claim, whether you meant to make one or not.

The hard part is that you cannot check validity by re-running. Reliability is verified from inside the measurement; validity needs an independent route to the construct — a second instrument you trust, a real-world outcome, a ground truth established some other way. You can be certain a number is stable and have no idea whether it is true.

## Reliable, Valid, Both, or Neither? {#the-dartboard}

The standard picture is a dartboard. Where the darts land is your metric; the bullseye is the construct.

1. **Tight cluster on the bullseye** — reliable and valid. The goal.
2. **Tight cluster in the wrong corner** — reliable, invalid. **The dangerous quadrant**, because consistency masquerades as correctness. Nobody audits a number that never wobbles.
3. **Scattered around the bullseye** — valid on average, unreliable. Annoying, but self-announcing: the wobble is visible, so it gets fixed.
4. **Scattered and off-target** — neither. Usually caught fast, because nothing about it looks trustworthy.

Here is the misconception this article exists to delete: **"a metric that gives consistent numbers is a good metric."** Consistency is reliability; whether the number measures the right thing is validity — and they are independent. You can have either without the other, and quadrant 2 is where the expensive failures concentrate.

My clearest picture of quadrant 2 is a silent zero. A fraud filter flags 0 of roughly 50,000 transactions every night for a week — the same 0 on every run, perfectly reproducible — because a data feed upstream had gone null and the model was scoring empty rows. The real fraud rate that week was about 0.8%. Nothing wobbled, so nothing got investigated; the stability _was_ the disguise. A number that never moves is not the same as a number that is right.

One more force pushes metrics toward quadrant 2: optimization. When a number becomes a target, people and processes make it _more_ stable while draining its meaning — the number stays crisp as its connection to the construct erodes. That mechanism has [its own article on Goodhart's law](https://ofriperetz.dev/articles/goodharts-law-explained).

## Is One Valid Metric Enough? Construct Coverage {#construct-coverage}

Validity is a property of a metric. **Construct coverage** is the property of your metric _system_: it is valid only if every failure mode that matters has at least one metric watching it.

The expensive failures are usually not a bad metric — they're a missing one. A company can report revenue, gross margin, and burn rate — each audited, each reliable, each valid for its own construct — while no line anywhere tracks customer concentration. Then the single client that was 40% of revenue walks, and every number on the healthy dashboard was true right up to the moment it stopped mattering. A coverage hole is invisible from inside the dashboard, because every number you _do_ have looks fine. The metrics were excellent at answering questions nobody was about to ask.

The audit generalizes to anything you ship or promise:

1. **List the claims.** Everything a spec sheet, a contract, a label, or a marketing page asserts — "safe under load," "accurate to ±1%," "no side effects," "holds up outside the sample it was built on."
2. **For each claim, name the check that would falsify it.** Not the check that sits near it — the one that fails if the claim is false. A "survives a crash" promise needs a test that actually triggers the crash; a "works after the upgrade" promise needs a run on the upgraded system, not the one you happened to have.
3. **The diff is your exposure.** Every claim without a falsifying check is a promise you are making on vibes.

That's the constructive move this whole distinction buys you: reliability tells you your instrument is steady; validity tells you it's pointed at something true; coverage tells you nothing important sits unwatched. Tom DeMarco needed a public recantation in 2009 to walk back decades of "you can't control what you can't measure" — measurement humility from one of the people who taught the industry to measure. The practical version of that humility is small: before you trust a stable number, ask what question it actually answers. Then ask which questions have no number at all.

---

## Quick Reference {#quick-reference}

| Property           | Question it answers                          | How to check                                                                       | Failure smell                                   |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| Reliability        | Does re-measuring give the same number?      | Take it twice under identical conditions                                           | Wobbling numbers — loud, self-announcing        |
| Validity           | Does the number measure the concept claimed? | Independent route to the construct (second instrument, real outcome, ground truth) | Stable dashboard, surprised stakeholders        |
| Reliable + invalid | —                                            | The dangerous quadrant: consistency masquerading as correctness                    | A number nobody audits because it never wobbles |
| Construct coverage | Does every claim have a metric watching it?  | List claims → name the falsifying check for each → diff                            | A stated guarantee with no check pointed at it  |

## Related

- [Goodhart's Law, Explained](https://ofriperetz.dev/articles/goodharts-law-explained) — the mechanism that drives metrics into the reliable-but-invalid quadrant.
- [Proxy Metrics](https://ofriperetz.dev/articles/proxy-metrics) — every proxy has a validity gap; that gap is this article's subject, measured.
- [Composite Scores and Weighting](https://ofriperetz.dev/articles/composite-scores-and-weighting) — what happens to validity when you collapse many metrics into one.
- [Different Metrics for Different Package Types](https://ofriperetz.dev/articles/different-metrics-for-different-package-types) — the software worked example this idea was drawn from: a real construct-coverage hole, and the metric system built to close it.

If this is the kind of reference you'll want at your next metrics review, [follow me on Dev.to](https://dev.to/ofri-peretz) and bookmark it — it's built to be cited, not skimmed once.

## References

- Messick, S. (1989). "Validity." In R. L. Linn (Ed.), _Educational Measurement_ (3rd ed., pp. 13–103). American Council on Education / Macmillan. The authoritative construct-validity treatment; the source of the modern view that validity is about the _interpretation_ of a score, not the score itself.
- Jacobs, A. Z., & Wallach, H. (2021). "Measurement and Fairness." _Proceedings of the ACM Conference on Fairness, Accountability, and Transparency (FAccT '21)_. [arxiv.org/abs/1912.05511](https://arxiv.org/abs/1912.05511). Measurement theory applied to computational systems — the bridge between psychometrics and the numbers you actually ship.
- Trochim, W. M. K. _Research Methods Knowledge Base_. [conjointly.com/kb](https://conjointly.com/kb/). Free online reference; the fastest concept-check for reliability/validity vocabulary, including the dartboard figure.
- DeMarco, T. (2009). "[Software Engineering: An Idea Whose Time Has Come and Gone?](https://doi.org/10.1109/MS.2009.101)" _IEEE Software_, 26(4). The recantation of "you can't control what you can't measure" — metrics humility from one of the field's original measurement advocates.

_Foundations series: ← [Inter-Rater Agreement & Cohen's κ](https://ofriperetz.dev/articles/inter-rater-agreement-cohens-kappa) · [hub](https://ofriperetz.dev/foundations) · [Proxy Metrics](https://ofriperetz.dev/articles/proxy-metrics) →_

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · npm: [@interlace](https://www.npmjs.com/~ofriperetz) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev)_
