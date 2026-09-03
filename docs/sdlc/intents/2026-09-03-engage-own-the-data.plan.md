---
kind: plan
slug: 2026-09-03-engage-own-the-data
opened: 2026-09-03
---

# Plan: five tables, one ingest step, one scorecard

Intent: [`2026-09-03-engage-own-the-data.intent.md`](./2026-09-03-engage-own-the-data.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Owner analytics endpoints answer the account key | `/api/analytics/totals`, `/historical?start&end`, `/past_day`, `/referrers`: all 200 | curl with `api-key` | 2026-09-03 |
| History depth | 183 days, 2026-02-23 → 2026-09-03 | `/historical?start=2026-03-01` | 2026-09-03 |
| Six-month totals | 5,973 views, 1,867 follows, 45 comments | same | 2026-09-03 |
| Follows vs views, last three days | 56/60, 91/186, 88/66 | `/historical?start=2026-08-24` | 2026-09-03 |
| Newest eight followers | all joined dev.to the day they followed | `/followers/users?sort=-created_at` + `/users/{id}` | 2026-09-03 |
| Lifetime read time | 250 s average per view; 2,422,750 s total | `/analytics/totals` | 2026-09-03 |
| Referrers | 7,509 none, google.com 944, dev.to 546, duckduckgo 167 | `/analytics/referrers` | 2026-09-03 |
| Per-article owner stats | `page_views_count`, `public_reactions_count`, `comments_count` | `/articles/me` | 2026-09-03 |
| What the ingest stores from dev.to today | one `creator_daily_metrics` row: followers, posts, totals | `impact-ingest/scripts/daily-ingest.ts` | 2026-09-03 |
| Existing tables | 25 in `public`, incl. `creator_daily_metrics`, `article_daily_snapshots` (per-article daily, 5,177 rows), `engagement_outcomes` (0 rows, outbound with quality scoring), `article_commenters` (8 rows, enriched inbound) | Supabase `list_tables`, `information_schema` | 2026-09-03 |
| Where the ingest runs | `ofri-peretz/impact-ingest`, cron 05:00 UTC, `workflow_dispatch` | repo | 2026-09-03 |

## Approach

Extend the ingest that already owns dev.to, with additive tables in the
agents repo's migration folder applied to the same project. Each table has a
natural unique key and an idempotent upsert. The control room reads the
warehouse through the series spine and a new `/api/profile` route; the
standing crawl keeps writing the comment ledger as it discovers threads.

**Rejected: writing from the control room.** The stack has one writer by
design; a second one on a laptop is the two-ledger problem in a database.

**Rejected: a followers-are-readers heuristic from usernames.** The account
creation date is a fact dev.to publishes; same-day creation is the flag.

## Sequence

1. Migration `devto_warehouse`: `devto_daily_analytics(observed_on pk, views,
   read_time_avg_s, read_time_total_s, reactions_total, reactions_like,
   reactions_readinglist, reactions_unicorn, reactions_other, unique_reactors,
   comments, follows)`; per-article daily rows already exist in
   `article_daily_snapshots` (source `devto`, 5,177 rows) and are reused;
   `devto_referrers_daily(observed_on, domain, views, unique (observed_on,
   domain))`; `devto_followers(user_id pk, username, name, followed_at,
   joined_on, onboarding boolean)`; `devto_comments(comment_id pk, article_id,
   article_author, author, direction text check (direction in ('in','out')),
   parent_id, created_at, body_excerpt, our_reply_id, our_reply_at)`. RLS
   deny-all for anon; `v_devto_*` invoker views for readers.
2. `daily-ingest.ts` (impact-ingest): `fetchDevtoAnalytics(day)` → upsert
   daily row; `fetchDevtoReferrers()` → today's rows; `/articles/me` → per-article
   rows; `/followers/users` paged newest-first until a known `user_id`, with
   one `/users/{id}` per new follower for `joined_on` and the `onboarding`
   flag. Back-fill: one `--since 2026-02-23` run for analytics.
3. Comment ledger: the control room's inbox crawl already walks every tree it
   needs; it POSTs nothing. Instead the ingest walks our articles' trees and
   our outbound comments (from `/api/comments?a_id=` for articles we acted on,
   read off `engage.db`'s `actions` exported daily to a small JSON the ingest
   can read from the agents repo) and upserts `devto_comments`. If reading the
   laptop's export proves awkward, the crawl in the control room writes a
   JSON the ingest picks up; the writer is still the ingest.
4. `/api/profile` in the control room: reads `v_devto_daily_analytics`,
   `v_devto_followers`, `v_devto_article_daily` and prints: views/day (7-day
   mean), read time, reactions and comments per 100 views, follows/day with
   the onboarding share, "followers who ever reacted or commented" from
   `devto_comments` and `unique_reactors`, plus standing and yield from their
   rows. Series: `devto.daily_views`, `devto.daily_follows`,
   `devto.read_time_avg_s`, `devto.onboarding_follow_share`.
5. Home page: "Profile" section above Reach; Reach's follower tile gains the
   note "N% ever read".

## Gates

- Migration applied to the project, `list_tables` shows the five tables,
  `select count(*)` on `devto_daily_analytics` equals the back-fill length.
- `daily-ingest.check.ts` extended for the new fetchers' shapes; a dry run
  prints the rows it would write.
- Human: the ingest PR in `impact-ingest` (secrets already exist; no new ones).

## Risks

- `/followers/users` is ~2,000 rows; paging newest-first and stopping at a
  known id keeps the daily cost to one page. The first run pays it all once.
- Per-follower `/users/{id}` lookups: ~2,000 once, then a handful a day; paced.
- The comment ledger's outbound half depends on knowing which articles we
  commented on; `engage.db` knows, the ingest does not. Step 3 names the seam.
