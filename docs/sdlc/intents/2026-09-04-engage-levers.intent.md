---
kind: intent
slug: 2026-09-04-engage-levers
opened: 2026-09-04
status: open
---

# Intent: know which article shapes earn readers and comments, from our own 85 articles, before writing the next one

## What

A "what drives what" analysis over every article we have published: for each
observable shape feature — title length, a number in the title, a question,
first person, tag set, reading time, code blocks, publish weekday and hour —
the relationship with three outcomes: views in the first 14 days, comments in
the first 14 days, and lifetime reactions per 100 views. Ranked by strength,
printed with the sample size, refreshed daily, and honest about what a
correlation over 85 articles can and cannot say.

## Why now

- The impact score's lowest pillars are Readers and Resonance, and the arena
  says the gap is shape and volume, not quality: the leaders earn ten times
  our reactions on the same number of articles.
- The article reviewer's score does not predict comments (r = −0.04 over 74
  articles, measured 2026-09-03). Something else does, and we have never asked
  the data which.
- The inputs exist: per-article daily snapshots since 2026-05-31 in the
  warehouse, and the owner article list with body, tags, reading time and
  publish time for all 85.

## Constraints

- Correlation, labelled as such. Every lever prints n and the coefficient;
  nothing prints as a rule, and nothing below the visibility threshold prints
  at all.
- Outcomes are windowed: a 14-day outcome exists only for articles with
  snapshot coverage through day 14. Older articles contribute lifetime
  reactions per 100 views only.
- No model, no fitted weights. Rank correlation for numbers, a mean
  difference for yes/no features.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Levers panel with n and coefficient per feature, refreshed daily | none | 3 outcomes × every feature with n ≥ 20 |
| Next article brief cites at least one measured lever | never | every article from the next one on |
| The reviewer's calibration line moves after the panel informs the brief | r = −0.04 | re-measured at the Maintain review |

## Not doing

- Predicting a single article's outcome.
- Changing the article pipeline's prompts here; this measures, the pipeline decides.
