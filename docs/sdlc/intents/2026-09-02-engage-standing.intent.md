---
kind: intent
slug: 2026-09-02-engage-standing
opened: 2026-09-02
status: open
---

# Intent: make engagement a ten-minute daily habit, and measure whether it is making us a more important author on DEV

## What

Two things, produced by the same crawl the control room already runs.

**Practical.** One page, one ranked list, under ten minutes a day, no terminal.
The list is ordered by what each action does to our standing in the community,
with the reason printed on the row, and every item on it can be finished or
skipped in place. The generator that fills tomorrow's queue reads the same
ranking, so the machine proposes what moves the number and the human only clicks.

**Measurable.** A daily **standing** series: a handful of countable, observed
signals that say whether more of the community is talking to us, and whether the
people at its centre are among them. Charted in the terminal like any other
series, trended on its rate of change, and watched by a control band so a decline
writes the next intent instead of waiting to be noticed.

"Important author" is defined here as: people comment on our work, we answer, and
the ties are two-way with authors the network converges on. Not followers, not
reactions. Those are either invisible for other accounts or carry no "who".

## Why now

Read on 2026-09-02 from the app on :7777 after a fresh network crawl, and from the
Dev.to API directly (commands in the plan).

- **Our node:** degree 46, rank 19 of 1,796 sampled authors. 51 comments out,
  38 in from 18 distinct authors. **One** mutual tie. The top non-staff node,
  sylwia-lask, has 310 ties, 669 comments in, 43 out, and 10 mutual ties. The
  shape of a central author is inbound and reciprocal. Ours is outbound and one-way.
- **Inbound is concentrated and mostly unanswered.** 15 of 85 articles have any
  comment; four of them produced 40 of the 67. 35 replies are waiting, the oldest
  100 days. Every one of the 18 people who commented on us is one comment away
  from a mutual tie.
- **Discovery is blind to the graph.** `engage-daily.ts` picks three random tags
  from a pool and takes trending articles. 51 outbound comments yielded about 28
  ties because the queue keeps returning to the same authors. Nothing in the loop
  knows who the top-40 nodes are or which of them we have never touched.
- **The graph itself was blind until today.** The crawl never sampled our own
  articles, so inbound read zero for every crawl until the fix merged in #153 and
  the cache was refreshed this evening. The "talked back" column and the mutual
  count were structurally zero. Nobody could have steered on them.
- **Followers moved, and it means little on its own.** +195 in 30 days, but DEV
  exposes follower counts only for our own account, so it cannot place us
  relative to anyone. Comment edges are public for every author. That is the
  measurable surface.

## Constraints

- **The curator model and the pace budget are unchanged.** Ranking actions by
  standing gain must never push volume past `lib/safety.ts`, the 7-day author
  cooldown, or NEVER_AUTO_COMMENT. A more important author is not a louder one.
- **Standing is observed, never inferred.** Every metric is a count of comment
  edges or replies that exist on Dev.to. No centrality scores from a force
  layout, no reputation guesses, no membership inferred from usernames.
- **Sample-bound, and says so.** Degree and rank depend on which articles were
  crawled. Every standing row stores the crawl's `sampledIds` hash and the sample
  size, and a rank is only compared against a rank from the same sample policy.
- **Staff are labelled, not hidden.** Forem staff (sloan, ben, jess) sit at the
  top of the graph by construction. Rank among non-staff is the comparison; the
  staff rows stay visible.
- **Pre-compute, never compute on click.** Standing is written when the crawl
  finishes; ranking reads cached data; drafting stays in the morning batch.
- **No new dependencies, no new database.** `engage.db` gains one table; the
  series spine gains one source. Local only, read-only against Supabase and PostHog.

## How we will know it worked

All counts, from files and tables this repo owns, read weekly. Eight-week targets.

| Signal | Now | Target | Tier |
| --- | --- | --- | --- |
| Mutual ties | 1 | ≥ 15 | 4 |
| Distinct authors who commented on us, 90-day window | 18 | ≥ 40 | 4 |
| Core reach: mutual ties with top-40 non-staff nodes | 0 | ≥ 5 | 4 |
| Rank among non-staff nodes, same sample policy | ~17 | top 10 | 4 |
| Replies waiting, daily check | 35 | ≤ 5 on 12 of 14 days | 4 |
| Median hours from their comment to our reply | unmeasured | < 24 | 4 |
| Comment yield, articles published in the last 30 days | 0.8 / article lifetime | ≥ 1.5 / article in first 14 days | 4 |
| Daily session wall time, first action to list clear | unmeasured | < 10 min median | 4 |

If mutual ties and core reach move but rank does not, the sample policy is the
first suspect, not the strategy. If replies waiting drops but nothing else moves,
we are answering people who do not write, and discovery is the next lever.

## Not doing

- Any automated posting, reacting, or following.
- Follower-count targets, Top 7 targets, or anything editorial we cannot observe.
- A new dashboard. The terminal, the graph and the home page already exist; this
  adds series and a list to them.
- Ranking by reactions or views. Neither carries a "who".
- Re-engineering the reply drafter's voice or the article pipeline. Comment yield
  is measured here and handed to the article reviewers, not fixed here.
