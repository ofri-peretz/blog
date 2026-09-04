---
kind: intent
slug: 2026-09-04-engage-climb
opened: 2026-09-04
status: open
---

# Intent: the climb — where we rank among every author who mattered this month, who is next, and exactly what passing them takes

## What

A league of every author with an article in dev.to's platform-wide top 500
of the last 30 days plus the top 300 in each of our four tags, aggregated by
author, refreshed daily: our rank, the thresholds for top 200, 100, 50, 20,
10 and 5, the five names directly above us with the reaction gap to each,
and the arithmetic of the gap in articles — at our current reactions per
article and at the top-10 rate. Stored weekly so the rank is a series. A page
of its own, `/league`, and one line at the top of the home page.

## Why now

Measured 2026-09-04 over 1,280 articles and 788 authors: we rank **151st**
with 15 reactions from 4 articles, 3.8 per article. The top-5 threshold is
338 reactions; at our rate that is 86 more articles this month, at the
top-10 mean of 61.6 per article it is 5. The thresholds are 25 for top 100,
59 for top 50, 170 for top 20, 252 for top 10. Nothing in the stack shows any
of this; the arena pillar of the impact score is a percentile with no names.

## Constraints

- Public data only: reactions, comments, article counts and tags from the
  articles API. No per-person profiling beyond what a byline shows.
- Compare aggregates; print names only as the rows of a scoreboard dev.to
  itself publishes article by article.
- Sample-bound and stated: top 500 platform-wide plus top 300 per tag over 30 days.
- Weekly rows only; the crawl is 17 pages and cached 24 hours.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| League rank, weekly series | 151 (one reading) | top 100 within 30 days, top 50 within 90, top 20 within 180 |
| Reactions per article, 30-day | 3.8 | ≥ 25 (the top-100 threshold in one article) |
| "Next up" names with a gap in reactions on the page | none | five, daily |

## Not doing

- Chasing reactions with engagement tricks; the levers panel says what earns them.
- Ranking anything but public aggregates.
