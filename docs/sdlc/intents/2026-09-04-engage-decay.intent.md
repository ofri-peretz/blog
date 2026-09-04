---
kind: intent
slug: 2026-09-04-engage-decay
opened: 2026-09-04
status: open
---

# Intent: decay — which articles die in three days and which keep being read

## What

For every article with daily snapshots since publish: the share of its
views that arrived in the first three days, the share that arrived after
day fourteen, and its current rate in views per day over the last two
weeks. Each article is classed feed, search or mixed from those two shares,
and the corpus is summed: how many of each, and which articles still earn
readers a month on. A panel on the home page with the split and the top
evergreen articles by current rate.

## Why now

dev.to exposes referrers for the profile, not per article, so "where do
readers come from" cannot be answered per piece. The shape of the curve
can: a feed article takes most of its views in three days and stops; a
search article keeps a daily rate for months. The publishing plan chooses
between timely and evergreen pieces with no measurement of which kind we
are good at, and the levers panel scores fourteen-day windows only.

## Constraints

- Snapshots must start within two days of publish, as the levers require;
  otherwise the first-three-days share is not a start and the article is
  left unclassed and says so.
- Thresholds in code: feed when 70 percent of views land by day three;
  search when 40 percent land after day fourteen.
- Views only. Reactions and comments are the levers' business.

## How we will know it worked

| Signal                                          | Now          | Target                                          |
| ----------------------------------------------- | ------------ | ----------------------------------------------- |
| Articles classed                                | 0            | every article with a compliant window, about 40 |
| Evergreen articles named with a current rate    | none         | the top ten, daily                              |
| Share of views from articles older than 30 days | not measured | measured, then a target after four weeks        |

## Not doing

- Guessing referrers per article.
- Changing the publishing plan; the panel informs it.
