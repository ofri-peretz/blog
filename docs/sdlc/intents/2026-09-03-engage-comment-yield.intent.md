---
kind: intent
slug: 2026-09-03-engage-comment-yield
opened: 2026-09-03
status: open
---

# Intent: articles that get comments — measure first-14-day yield, and calibrate the reviewer on it

## What

Every article we publish gets a number nobody has computed so far: how many
people commented in its first fourteen days, read from dev.to's own timestamps.
That number becomes a daily series, a column on the queue page, and the thing
the article pipeline's engagement reviewer is judged against. The reviewer's
score and the observed yield are correlated on screen, so a reviewer that
predicts nothing is visible as such.

## Why now

Measured 2026-09-03 against the dev.to API, every article, every comment tree:

- 85 published articles. **12** received any external comment in their first
  fourteen days. Mean first-14-day yield **0.38**, median **0**.
- The six articles published in the last 30 days average **0.50**.
- The top of the distribution is narrow and specific: the Claude-vs-Gemini
  security comparison drew 7 in fourteen days; the NestJS service ESLint caught,
  the circular-dependency bug, the 842-secrets credential rule and the
  30-minute Gemini audit drew 3 to 4 each. Comparative, claim-heavy, named tools.
- Inbound is what central authors run on (standing intent): the top non-staff
  node has 669 comments in. Ours is 38 in from 18 authors. Comments on our
  articles are the only inbound we can grow by writing.
- The article pipeline scores every draft on an "engagement" lens before
  publishing, and that score has never been compared to what happened after.

## Constraints

- **Observed, never inferred.** Yield counts comments by other people with a
  `created_at` inside the window. No views, no reactions, no estimates.
- **No new crawl.** The inbox builder already reads every comment tree on our
  articles; yield is computed from the same fetch, cached the same 12 hours.
- **Calibration is evidence, not automation.** The correlation is shown; the
  reviewer prompt is changed by a person, in the agents repo, with the number
  in front of them.
- **The publishing bar stays at 8.75.** Yield informs the reviewer; it does not
  replace the gate.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Mean first-14-day yield, articles published in the trailing 30 days | 0.50 | ≥ 1.5 |
| Share of new articles with any comment in 14 days | 12 of 85 lifetime | ≥ 50% of the trailing 10 |
| Correlation of engagement-reviewer score with observed yield, n ≥ 20 | unmeasured | r ≥ 0.4, printed on the queue page |
| Yield row written daily | none | every day, via the loop's daily check |

## Not doing

- Changing what gets written. That is the article pipeline's job, informed by this number.
- Counting our own replies as yield.
- Anything with views or reactions as the outcome.
