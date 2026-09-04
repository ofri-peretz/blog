---
kind: intent
slug: 2026-09-03-engage-own-the-data
opened: 2026-09-03
status: shipped
---

# Intent: own every number dev.to has about us — daily, per article, per person — and read the profile off that, not off the follower count

## What

A Supabase warehouse of everything dev.to exposes about this account, written
once a day by the ingest that already runs: platform-wide daily analytics
(views, read time, reactions by kind, comments, follows), per-article daily
stats, referrer domains, every follower with the day their account was
created, and every comment in both directions with its reply. On top of it,
one profile scorecard that answers "how is the profile doing" with readers,
resonance and standing — and prints the follower number with the share of it
that ever read anything.

## Why now

Read on 2026-09-03 from dev.to's owner analytics API, which the account's key
unlocks and nothing in the stack reads today.

- **The follower jump is not readers.** Since the last two publishes the
  account gained ~150 followers. dev.to's daily analytics show follows
  exceeding page views: 91 follows on 186 views on 2026-09-02, 88 on 66 the
  next day. The eight newest followers all created their dev.to account the
  same day they followed. That is onboarding's "suggested authors", not people
  who read a post. In June the follows-to-views ratio was 1.06; in August, 0.05.
- **Six months of daily history exist and are stored nowhere.** The historical
  endpoint returns 183 days: 5,973 views, 1,867 follows, 45 comments. The
  ingest stores a single follower total per day; the daily views, reactions by
  kind, comments and follows, and average read time are thrown away.
- **Read time is the one engagement number we have never seen.** Lifetime
  average 250 seconds per view; 98 seconds on the 690-view day. It separates a
  read from a bounce, which no other counter does.
- **Referrers are unknown.** 7,509 of 9,691 views carry no referrer; Google
  944, dev.to itself 546. Nothing tells the article pipeline where readers come from.
- **The comment history lives in files.** Our comments in queue JSONs and
  `engage.db`; theirs in `reply-drafts.json` and a 12-hour cache. The
  standing series is rebuilt from crawls each day rather than read from a ledger.

## Constraints

- **The impact stack's non-negotiables hold** (skill `ofri-impact`): the one
  daily workflow writes, apps read views only, service-role key never on
  Vercel, upserts on natural keys, additive migrations, no renames, no drops.
- **Free tier.** Daily rows are small; the comment ledger is bounded by our own
  activity (hundreds of rows, not millions). No per-view events.
- **Public data about other people is stored as dev.to publishes it** —
  username, comment text, timestamps — and only for people who interacted
  with us. No profile crawling of strangers.
- **The scorecard reports, never ranks people.** Standing already has the
  rules; this adds readers and resonance beside it.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Daily analytics rows in Supabase | 0 | 183 back-filled, then one per day |
| Per-article daily rows | 0 | one per published article per day |
| Followers stored with account-created date | 0 | all, with an `onboarding` flag when created the same day they followed |
| Comments stored, both directions, with reply timestamps | files only | one table, queryable |
| Profile scorecard shows readers (views/day, read time), resonance (reactions and comments per 100 views), standing, and follower share that ever read | none | one section, sourced |
| "Followers who read" | unmeasured | measured, printed beside the follower count |

## Not doing

- Storing page-view events per reader; dev.to does not expose them.
- Any write to dev.to.
- Replacing the standing crawl; it feeds the ledger, it is not replaced by it.
