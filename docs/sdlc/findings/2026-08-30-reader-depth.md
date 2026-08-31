---
kind: finding
intent: 2026-08-30-reader-depth
date: 2026-08-30
---

# Finding: depth is a traffic problem, not a design problem

Intent: [`../intents/2026-08-30-reader-depth.intent.md`](../intents/2026-08-30-reader-depth.intent.md)

## What the numbers did

| Claim | Value | Source | Read on |
|---|---|---|---|
| Pages per reader, overall | 1.16 | reader-only population | 2026-08-30 |
| Pages per reader, direct arrivals | 1.14 over 179 people | PostHog SQL joined on first referrer | 2026-08-30 |
| Pages per reader, Google arrivals | 1.19 over 80 people | same | 2026-08-30 |
| Articles in a series | 68 of 90 | frontmatter grep | 2026-08-30 |
| Monthly views where a pager renders | about 127 | 168 reader pageviews times 68/90 | 2026-08-30 |
| Clicks on any onward affordance, 30d | 3, from 1 person | PostHog SQL by event name | 2026-08-30 |

## What that rules in or out

**Candidate 2 — arriving intent — is dead.** The theory was that Google
visitors land on one answer and leave, dragging the average down. They do not:
search arrivals read *slightly more* than direct ones, 1.19 against 1.14. The
two populations are indistinguishable, so depth is not a function of who is
arriving.

**Candidate 3 — no opportunity to click — is dead for the series pager.** It
can render on 68 of 90 articles, roughly 127 article views a month. The
affordance is present and unused, not absent.

**Candidate 1 — volume — explains everything, and it is quantified.** Against
127 opportunities a month, treating clicks as Poisson:

- at a 1% click rate, expect 1.3 clicks and observing zero has probability 28%
- at 2%, expect 2.5 and zero has probability 7.9%
- at 5%, expect 6.3 and zero has probability 0.2%

So the observed zero **rules out a good affordance** (5% or better would almost
certainly have shown something) and is **entirely consistent with a mediocre
one** at 1–2%. What it cannot do is separate "mediocre" from "broken". At this
volume those two hypotheses predict the same observation, and no amount of
staring at the number will separate them.

## The decision it licenses

**Stop spending on reader depth.** Not because depth does not matter, but
because at 127 monthly opportunities the measurement cannot tell a working
affordance from a dead one — so any fifth affordance would be unmeasurable by
construction, and we would be choosing designs by taste while calling it data.

The binding constraint is traffic, and the lever for traffic is acquisition:
the dev.to crossing, where a platform with thousand-view articles currently
sends literally nobody. Depth becomes a real question at roughly 5× current
volume, where a 2% affordance would predict about 13 clicks a month and zero
would genuinely mean broken.

**Revisit when** monthly reader pageviews clear 800, or when any onward
affordance passes 10 clicks in a month, whichever happens first.

## What this could not determine

Whether the existing affordances are any good. That is the honest gap, and it
stays open until there is enough traffic to answer it. Nothing here justifies
removing them either — the same arithmetic that cannot prove they work cannot
prove they fail.
