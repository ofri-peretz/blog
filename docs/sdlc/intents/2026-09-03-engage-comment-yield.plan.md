---
kind: plan
slug: 2026-09-03-engage-comment-yield
opened: 2026-09-03
---

# Plan: yield from the comment trees we already fetch

Intent: [`2026-09-03-engage-comment-yield.intent.md`](./2026-09-03-engage-comment-yield.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Published articles | 85 | dev.to `/api/articles?username=ofri-peretz` | 2026-09-03 |
| Articles with any external comment in first 14 days | 12 | per-article `/api/comments?a_id=`, `created_at` vs `published_at` | 2026-09-03 |
| Mean / median first-14-day yield, lifetime | 0.38 / 0 | same | 2026-09-03 |
| Mean first-14-day yield, published in trailing 30 days | 0.50 over 6 articles | same | 2026-09-03 |
| Top first-14-day yields | 7, 4, 4, 3, 3 | same | 2026-09-03 |
| Gate scores available per article | 90 of 91 scored, bar 8.75, median 9.1 | `/api/queue` totals | 2026-09-03 |
| Where gate scores come from | batch-review logs, mined by `scores()` | `apps/engage/src/app/api/queue/route.ts:36-75` | 2026-09-03 |
| Inbox crawl covers our articles' comment trees | yes, population 1 | `apps/engage/src/lib/inbox.ts` | 2026-09-03 |

## Approach

One crawl, one more product. `lib/yield.ts` takes our article list and their
comment trees and returns per-article `{id, publishedAt, comments14d,
commentsTotal}` plus a rolling summary. It is cached on disk like the inbox and
written to a `yield` table daily by the same call that writes standing. The
queue page, which already lists every article with its gate score, gains a
"comments 14d" column and a one-line Pearson between gate score and yield.

**Rejected: yield from `comments_count` on the article list.** Lifetime totals
reward old articles; the window is the honest measure.

**Rejected: a model-scored "commentability".** The reviewer already exists; the
point is to find out whether it predicts anything.

## Sequence

1. `lib/yield.ts` (pure): `yieldOf(article, tree, windowDays=14)` and
   `summarize(rows, sinceDays=30)`; `yield.selfcheck.ts` pins the window edge
   and the exclusion of our own comments.
2. `/api/yield`: crawl our articles (paced, 12 h disk cache, `?refresh=1`),
   compute rows and summary, write today's row to `store.yield`, return both
   with the Pearson against `scores()` where both exist.
3. `store.ts`: `yield(day, articles_30d, mean14d_30d, with_any_30d, articles_total, at)`.
4. `series-yield.ts`: `yield.mean14d_30d` and `yield.with_any_30d` in the terminal.
5. Queue page: "comments 14d" column, and "gate score vs 14-day comments:
   r = …, n = …" under the table.
6. `agents/footprint/scripts/engage-inbox-notify.ts`: call `/api/yield` after
   `/api/standing` in the daily check.

## Gates

- `yield.selfcheck.ts` red before step 1 (no module), green after; the window
  edge case (day 14 at 23:59 counts, day 15 does not) and self-exclusion pinned.
- Queue page smoke route keeps rendering.
- Human: read the correlation once n ≥ 20 and decide whether the reviewer
  prompt changes. That decision is recorded in the agents repo, not here.

## Risks

- Twenty articles with both a score and a window is the minimum for r to mean
  anything; below that the page prints n and no r.
- The comment crawl is the same one that hits dev.to's limit; yield reuses the
  cached trees where the inbox has them, and never forces a crawl on page load.
