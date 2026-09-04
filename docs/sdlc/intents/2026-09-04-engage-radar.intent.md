---
kind: intent
slug: 2026-09-04-engage-radar
opened: 2026-09-04
status: open
---

# Intent: rising now — the posts in our tags that will be read today, before they are

## What

A panel on the home page that lists the posts in our four home tags that
are under a day old and gaining reactions fastest, ranked by velocity
weighted by how close the post is to our subject, with the ones we already
commented on marked. Refreshed every fifteen minutes from dev.to's own
rising and fresh feeds.

## Why now

The comment queue scores relevance over posts that are already ranked; by
then the thread has its early comments and ours lands fourth. An early
comment on a post that will rise is the cheapest visibility we have and
the only route to the mutual ties the standing pillar is missing, at one
of fifteen today. Nothing in the app watches velocity.

## Constraints

- Public data only: the articles API, no per-person profiling.
- The panel proposes; the anti-bot rules and the curator decide. Nothing
  here posts.
- Velocity is reactions per hour since publish over the API's own counts;
  the age and the counts are printed so the ranking can be checked by eye.
- Relevance is a keyword and tag overlap with our subject, listed in code.

## How we will know it worked

| Signal                                                | Now          | Target                                     |
| ----------------------------------------------------- | ------------ | ------------------------------------------ |
| Rising posts surfaced per refresh                     | 0            | 10 to 15, under 24 hours old               |
| Our comments placed within 6 hours of a post going up | not measured | tracked from the outreach ledger, 3 a week |
| Mutual ties                                           | 1            | the standing intent's 15                   |

## Not doing

- Commenting automatically.
- Ranking anything older than a day; that is the queue's job.
