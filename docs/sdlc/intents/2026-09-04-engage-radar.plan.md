---
kind: plan
slug: 2026-09-04-engage-radar
opened: 2026-09-04
---

# Plan: two feeds per tag, velocity times relevance, one panel

Intent: [`2026-09-04-engage-radar.intent.md`](./2026-09-04-engage-radar.intent.md)

## Ground truth

| Claim                 | Value                                                                                       | Source                         | Read on    |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| Rising feed           | `articles?tag=security&state=rising` returns posts 1 to 30 hours old with 0 to 12 reactions | dev.to articles API            | 2026-09-04 |
| Fresh feed            | `state=fresh` returns the newest posts per tag                                              | dev.to articles API            | 2026-09-04 |
| Home tags             | security, javascript, node, ai                                                              | `lib/league.ts`                | 2026-09-04 |
| Our outbound comments | 84 rows with article ids                                                                    | `devto_comments` direction out | 2026-09-04 |
| Mutual ties           | 1 of 15                                                                                     | `/api/standing`                | 2026-09-04 |

## Approach

`lib/radar.ts`: `velocity` is reactions per hour since publish with a
one-hour floor; `relevance` counts hits from a fixed keyword list over
title and tags plus overlap with the home tags; `rank` keeps posts under
24 hours old, drops our own, and sorts by velocity times one plus
relevance. `/api/radar` pulls rising and fresh for each home tag, dedupes
by id, marks the ids we already commented on from the warehouse, and
caches fifteen minutes. The home page panel prints title, author, age,
reactions, comments, velocity and the relevance hits.

**Rejected: a model.** Velocity and subject overlap are the two facts a
person would look at; the panel prints both and their product.

## Sequence

1. `lib/radar.ts` with selfcheck: velocity floor, relevance hits, ranking
   order, own posts dropped, age cut.
2. `/api/radar`.
3. Home page panel "Rising now".

## Gates

- Selfcheck red before step 1, green after.
- `tsc`, hygiene lock, `npm run selfcheck` green.
- Human: none.

## Risks

- The rising feed is dev.to's own selection; the fresh feed catches what it
  misses only for the newest hour. Both are pulled.
