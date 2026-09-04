---
kind: intent
slug: 2026-09-04-engage-impact-score
opened: 2026-09-04
status: open
---

# Intent: one definition of "a more impactful author", five pillars, every metric observable and scored the same way every day

## What

An Author Impact Score from 0 to 100, computed daily from numbers the stack
already owns, shown at the top of the control room and stored as a series.
Five pillars of 20 points each: **Readers**, **Resonance**, **Standing**,
**Arena**, **Downstream**. Each pillar is the mean of two to four metrics,
each metric scored linearly between a floor and a target and clamped, so a
point always means the same thing, the targets are written down, and nothing
can move the score except the thing the metric names.

Followers are not in it. Lifetime totals are not in it. The score is the
answer to "are we more impactful than last week", not "are we big".

### The catalog

Score per metric: `clamp((value − floor) / (target − floor), 0, 1)`; for "down"
metrics the floor is the bad end. Pillar = mean of its metrics × 20. Score = sum
of pillars, 0–100. Targets are hypotheses from the leaders in our tags and the
shipped intents; each is one line in `lib/impact-score.ts` and nowhere else.

| Pillar     | Metric                                                                           | Source                               | Floor → target | Now                      | Why this target                                                        |
| ---------- | -------------------------------------------------------------------------------- | ------------------------------------ | -------------- | ------------------------ | ---------------------------------------------------------------------- |
| Readers    | views per day, 7-day mean                                                        | `devto_daily_analytics`              | 20 → 200       | 56                       | a top-300 author's article alone draws ~200/day in its first days      |
| Readers    | average read time, seconds, 7 days                                               | same                                 | 30 → 120       | 52                       | lifetime average is 250 s; 120 s is half a real read                   |
| Resonance  | comments per 100 views, 30 days                                                  | same                                 | 0 → 2.0        | 0.9                      | leaders' comments are a third of reactions; at 4 rx/100 that is ~1.5–2 |
| Resonance  | reactions per 100 views, 30 days                                                 | same                                 | 0.5 → 4.0      | 1.3                      | leaders' articles earn 4–8/100                                         |
| Resonance  | first-14-day comment yield, mean over closed windows, 30 days                    | `comment_yield`                      | 0 → 1.5        | 1.0                      | comment-yield intent target                                            |
| Standing   | mutual ties                                                                      | `standing`                           | 0 → 15         | 1                        | standing intent target                                                 |
| Standing   | distinct inbound authors, 90 days                                                | `standing`                           | 5 → 40         | 18                       | standing intent target                                                 |
| Standing   | core reach (mutual with top-40 non-staff)                                        | `standing`                           | 0 → 5          | 1                        | standing intent target                                                 |
| Standing   | reply latency, median hours (down)                                               | `standing`                           | 168 → 24       | 51.5                     | reply-latency intent target                                            |
| Arena      | rank percentile among top-300 authors, mean over #security #javascript #node #ai | 30-day crawl                         | 0 → 0.95       | 0.66 (absent = 0 in #ai) | top 5% = the top ten names                                             |
| Arena      | home tags present in the top 300                                                 | same                                 | 0 → 4 of 4     | 3                        | absence is the strongest signal we have                                |
| Downstream | article→npm download lift, median %, 30 days                                     | `v_article_download_lift`            | 0 → 20         | unmeasured               | the north star's own view                                              |
| Downstream | blog sessions referred by dev.to, 30 days                                        | `/api/journeys`                      | 0 → 50         | 0                        | dev.to sends nothing today; any is progress                            |
| Downstream | followers who ever commented                                                     | `devto_followers` × `devto_comments` | 2 → 20         | 2                        | the honest proxy for followers who read                                |

## Why now

- Measured 2026-09-04 against the top-300 articles per tag over 30 days: we
  rank 20th of 202 authors in #security, 28th of 230 in #javascript, 23rd of
  205 in #node, and absent from #ai. The leaders earn ten times our reactions
  on the same number of articles, and comments a third to two thirds of their
  reactions where ours are a tenth.
- The follower count grew ~150 since the last publishes while 99% of the
  resolved follower accounts were created the day they followed. A score that
  includes followers would have called that growth.
- Six intents shipped this week each carry their own targets in their own
  tables. Nobody can read them as one number, and the Maintain review needs
  one number to band.
- Dev.to publishes no author score. The internal reputation modifier is
  invisible; the only honest scoreboard is the one we compute from public data.

## Constraints

- **Every input already exists** in the warehouse, the standing and yield
  rows, the crawl, or a 30-day public crawl of our tags. No new secrets, no
  new writers to Supabase; the score is written locally like standing.
- **Linear, floored, capped.** No weights hidden in code paths; a metric's
  contribution is `clamp((value − floor) / (target − floor), 0, 1)` and a pillar
  is the mean of its metrics times 20. Direction is explicit per metric.
- **Targets are hypotheses, stated once.** They come from the leaders in our
  tags and the shipped intents' targets; changing one is a documented edit to
  the catalog, not a tweak.
- **Followers, lifetime views, badges and reactions from onboarding accounts
  are excluded** until they can be separated from the platform's mechanics.
- **Arena is observable only.** Rank among authors of the top-300 articles per
  tag over 30 days. Absent from the top 300 scores zero, not "unknown".

## How we will know it worked

| Signal                                           | Now        | Target                         |
| ------------------------------------------------ | ---------- | ------------------------------ |
| Impact score computed daily, stored, charted     | none       | every day                      |
| Every metric prints value, floor, target, points | none       | 14 of 14                       |
| Score moves only when a named metric moves       | untestable | pinned by the selfcheck        |
| Weekly delta read at the Maintain review         | none       | first review on data, not date |

## Not doing

- Ranking people. Arena compares aggregates, never persons.
- Fitting weights to history. The score is a contract, not a model.
- Any platform-side action. The score reads; the intents act.
