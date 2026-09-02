---
id: I-6
slug: i6-detectors-close-the-loop
stage: intent
status: approved
visibility: public
opened: 2026-08-30
opened_by: claude
approved_by: ofri
---

## Claim

Three scheduled detectors — spec staleness, link health, reception band — turn
a published problem into a committed intent without a human in the invocation
path. This is what converts the pipeline into a loop.

## Audience

Us.

## Why us

Articles publish and then go unobserved. The last full quality measurement is
three months old and 29 articles behind. `articles-corpus.json` is pulled by
hand. There is no trigger anywhere that turns a problem into work — which is
why the 5.7 mean has sat unchanged since May.

The staleness detector is the highest-value of the three because it is the one
that catches _"the article says 27 rules and the package now ships 31"_ — a
claim that was true when written and is false now, which no review pass can
ever catch because nothing changed in the article.

## Evidence we believe exists

- [x] Specs (I-2) carry re-runnable commands, so staleness is a diff, not a judgement
- [x] dev.to API exposes per-article views/reactions/comments for the reception band
- [x] Public-repo Actions are free, so a weekly cron costs nothing

## Kill criterion

If the reception band produces mostly noise at 2σ — flagging normal variance
as signal — it drops to advisory-only logging and stops opening intents. The
staleness and link detectors are unaffected; they are deterministic.

## Title candidates

n/a

## Tier

n/a
