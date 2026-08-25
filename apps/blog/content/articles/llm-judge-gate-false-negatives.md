---
title: "My 9-Reviewer AI Gate Failed Articles It Scored 9.1"
description: "A reviewer scored 10.0 and its clean bill of health parsed as a blocker. Three ways my LLM-judge gate failed work it had just praised."
slug: "llm-judge-gate-false-negatives"
published: false
canonical_url: "https://ofriperetz.dev/articles/llm-judge-gate-false-negatives"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/llm-judge-gate-false-negatives.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/llm-judge-gate-false-negatives-og.jpg"
tier: "T3"
reading_time_minutes: 4
tags:
  - "ai"
  - "webdev"
  - "testing"
  - "eslint"
series: null
author:
---

Nine LLM reviewers score every article I publish. The gate is simple: zero blockers, and a mean score above my floor.

Yesterday it failed an article it had scored **9.1**. Then it failed a second one three separate times. Neither reviewer ever disagreed with the writing — all three failures were the harness misreading its own reviewers.

---

## A perfect score, filed as a blocker {#score-ten}

The Checklist reviewer returned **10.0** and wrote this under `BLOCKERS`:

```text
no biography/family/military/location/heritage; no political position;
the numbers are incident/operational facts, so the rule doesn't bite.
```

That is a clean bill of health. It failed the gate.

The parser dropped lines meaning "nothing here" with `/^none/i`. The prompt asks reviewers to *explain* why nothing is wrong, so they write the explanation instead of the word — and **"no biography" is not "none"**.

**Why it survives review:** the regex is correct for the string it was written against. Nobody writes a test for the sentence a model *didn't* emit.

The fix wasn't a longer regex. Guessing every phrasing of "nothing is wrong" is unbounded. The prompts already state the contract — fully in scope means `BLOCKERS: None` **and** `SCORE: 10` — so a 10 that also reports a blocker is self-contradictory:

```ts
if (score === 10 && blockers.length) {
  improvements.push(...blockers);  // demote, never drop
  blockers = [];
}
```

Demoted, not deleted. If a reviewer ever scores 10 on something genuinely broken, the text still reaches a human.

## The word that made good reviews look like outages {#rate-limit}

My runner treats a quota message as a transport failure, so a billing error can never be scored as a bad article. The pattern included a bare `rate limit`.

It was tested against the reviewer's **entire output**. My corpus is security articles. Reviewers say "rate limit" constantly:

```text
· Discovery & Hook: USAGE LIMIT — SCORE: 8.0
· Voice & Agenda:   USAGE LIMIT — SCORE: 9.5
· Quality:          USAGE LIMIT — SCORE: 9.0
```

Three finished reviews, scores visible in the text that got thrown away. That article lost 4 of 9 reviewers and failed two batch runs before I looked. It reads as an account problem, which is exactly why it survived.

The tell separates the two cleanly: a real quota banner is the *only* thing on stdout. A review that merely discusses limits has a `SCORE:` line sitting right there.

## An excluded reviewer voting anyway {#excluded}

One reviewer is informational — its rubric weights brand fit 40%, which structurally caps anything outside that niche. It was excluded from the gate *score*.

It was not excluded from blockers. So it vetoed through the back door — and what it files under `BLOCKERS` is its own arithmetic:

```text
✗ Axis 1 — Content Quality: 8.5
✗ Weighted = 8.5 x 0.6 + 5 x 0.4 = 7.1
```

Four "blockers" on an article it had just called original and reproducible. A half-applied exclusion is not an exclusion — and a [weighted composite](https://ofriperetz.dev/articles/composite-scores-and-weighting) is exactly the shape that hides one, because the arithmetic looks like a finding.

## The pattern {#pattern}

Every one of these is the harness misreading agreement as disagreement, and all three fail in the same direction: **quietly, toward rejection.** A false pass is loud — something bad ships and you see it. A false *fail* looks exactly like a strict gate doing its job, so it can run for weeks while you assume the work is merely not good enough yet. It is the same asymmetry that makes [a leaderboard wrong in the flattering direction](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), and the same reason [measurement bias](https://ofriperetz.dev/articles/bias-in-measurement) survives longest when it agrees with what you expected.

If you run an LLM as a judge, assert on the disagreements it cannot logically have: a perfect score with a blocker, a reviewer excluded from the score that still blocks, a transport error carrying a parsed result. Those are contradictions, and contradictions are testable without predicting a single word the model will say.

```ts
assert.equal(parse("SCORE: 10\nBLOCKERS:\n- none found here").blockers.length, 0);
assert.equal(parse("SCORE: 7\nBLOCKERS:\n- the claim has no date").blockers.length, 1);
```

Both directions. A one-sided test would have passed on all three bugs — my earlier fix for the *opposite* failure is what introduced the second one. That is the same lesson [ground truth taught me that unit tests could not](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed): a test written from the failure you already know about only ever proves you fixed that one.

---

More on the tooling behind this at [github.com/ofri-peretz/eslint](https://github.com/ofri-peretz/eslint). The three defects above were found on 2026-08-11 across 39 gated articles.

_What's the last false negative you found in your own tooling — and how long had it been running?_
