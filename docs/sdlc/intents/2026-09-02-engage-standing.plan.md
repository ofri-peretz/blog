---
kind: plan
slug: 2026-09-02-engage-standing
opened: 2026-09-02
---

# Plan: a standing series, a next-best-action list, and a graph-aware queue

Intent: [`2026-09-02-engage-standing.intent.md`](./2026-09-02-engage-standing.intent.md)
Depends on: [`2026-09-02-engage-truth-and-reach`](./2026-09-02-engage-truth-and-reach.plan.md)
phases A and B (one hub, verified sends). Standing built on unverified "sent"
marks would measure clicks, not conversations.

## Ground truth

Read on 2026-09-02.

| Claim | Value | Source |
| --- | --- | --- |
| Our node after a fresh crawl | degree 46, in 38, out 51, mutual `[xulingfeng]`, rank 19 of 1,796 | `curl ':7777/api/network?refresh=1'`, node `ofri-peretz` |
| Sample size | 219 articles, `fetchedAt` 2026-09-03T04:41Z | same, `sampledArticles` |
| Top nodes | sloan 429 (staff), sylwia-lask 310 (in 669, out 43, mutual 10), the_nortern_dev 138, marcosomma 93, nazar-boyko 91 | same, sorted by `degree` |
| Edges into us | 18 distinct authors | same, `edges.filter(to === "ofri-peretz")` |
| Comments on our articles | 67 on 15 of 85 articles; 20 distinct commenters; top four articles = 40 | Dev.to `/api/articles?username=ofri-peretz` then `/api/comments?a_id=` per article |
| Replies waiting | 35, oldest 100 d, 0 undrafted | `curl :7777/api/threads` |
| How the graph counts | `degree` = distinct partners either direction; `mutual` = A→B and B→A both observed; edges point at the article owner | `lib/network.ts:98-123` |
| Inbound was structurally zero before #153 | `expandTwoHop` filtered `!n.us` | commit 2f4527a message |
| Discovery today | `pickTags(3)` from `TAG_POOL`, then `fetchTrending(TAGS, {maxAgeDays: 3})` | `agents/footprint/scripts/engage-daily.ts:83,112` |
| Series spine sources | one: `supabase:creator_daily_metrics`, plus npm and PostHog adapters | `lib/series.ts:62`, `lib/series-npm.ts` |
| Snapshot table shape | `snapshots(day, followers, articles, reactions, comments, views, at)` | `lib/store.ts:46` |
| Known cohorts | `forem`, `googleai`, asserted with `verified` flags | `lib/people.ts:22-38` |
| Control-band file shape in `eslint` | `{id, description, collector, window, minPoints, worse}` per band, deterministic watcher | `eslint/cadence/.agent/control-bands.json` |
| Followers, 30 days | 1,553 → 1,748 | home page Impact panel |

## Approach

One crawl, two products. The network refresh already produces every edge the
standing metrics need; the Dev.to comments on our own articles are already read
by the reply inbox. Standing is a daily row derived from those two, stored beside
the existing snapshots, and published through the series spine so the terminal,
trend detection, correlation and the stall alerts get it without new UI code.
Next-best-action is a ranking over worklists the page already renders. The queue
generator reads the same graph cache the app writes.

**Rejected: PageRank or eigenvector centrality.** Unstable across crawls of a
sampled graph, and unexplainable on a row. Degree, in-degree and mutual ties are
countable, and a person can verify each one on dev.to.

**Rejected: followers as the standing metric.** Not observable for any other
account, so no rank is possible.

**Rejected: a standing page.** The terminal is the chart surface; a fourth chart
surface would fork the series contract the spine was built to unify.

**Rejected: letting the model choose targets.** Ranking is arithmetic over
observed edges and ages. The model drafts text; it never decides who.

## Sequence

A and C are independent. B depends on A. D and E depend on A. F depends on
four weeks of A.

**A. The standing series** (this repo)

1. `lib/standing.ts`: from the cached graph and the inbox, compute
   `degree`, `in_authors_90d`, `mutual`, `core_reach` (mutual with top-40
   non-staff), `rank_nonstaff`, `rank_pct`, `replies_waiting`,
   `reply_latency_h_median`, `comment_yield_14d`, plus `sample_size` and
   `sample_hash` (sha of sorted `sampledIds`).
2. `store.ts`: table `standing(day PRIMARY KEY, …metrics, sample_size,
   sample_hash, at)`. Written once per day at the end of a network refresh; a
   second refresh the same day overwrites.
3. `lib/series-standing.ts`: source `sqlite:standing`, group "Standing", kind
   `gauge` for ranks and waiting, `cumulative` for mutual and in-authors,
   `staleAfterHours: 36`. Catalog entries appear in the terminal automatically.
4. Home page: a "Standing" strip beside Reach with today's values and 7-day
   deltas, and the sample size printed under it.

**B. Next best action** (this repo)

5. `lib/nba.ts`: score every open item across replies and the stream.
   `+3` reply to someone who commented on us with no tie back (a mutual tie);
   `+2` comment on a top-40 non-staff node we have never touched (core reach);
   `+1` any author with no existing tie; `+0.5` per week of reply age up to 4;
   `0` if inside cooldown or on NEVER_AUTO_COMMENT; halved if the same author
   already appears higher in today's list. Deterministic, unit-tested.
6. Home page: "Do these first · 5" above Up next, each row with its reason
   ("mutual tie with @x, they commented 23d ago"), finish/skip in place,
   keyboard focus starts here. The stepper remains for the rest.

**C. Graph-aware discovery** (`agents`)

7. `engage-daily.ts` reads the app's network cache file before `pickTags`.
   Candidate order: authors who commented on us with no tie back; top-40
   non-staff nodes untouched in 30 days; then the tag pool as today. Every
   anti-bot rule stays. Each queue item gains `why`, shown on the card.
8. `engage-replies.ts` keeps all inbound drafted daily, including comments on
   our own articles, so the list in B is never blocked on a missing draft.

**D. Session timing** (this repo)

9. Record `session_start` on first action and `session_end` on list clear in
   `engage.db` `actions`; expose `session_minutes` as a standing metric.

**E. Weekly standing digest** (`agents`)

10. `engage-status --week` prints standing deltas and the three biggest rank
    moves among authors we touched. Monday notification deep-links to the terminal.

**F. Control bands** (this repo, after four weeks of rows)

11. `apps/engage/.agent/control-bands.json` in the `eslint` shape:
    `replies_waiting` (worse: higher, window 14, minPoints 8),
    `reply_latency_h_median` (worse: higher), `mutual` (worse: lower, on the
    weekly delta), `in_authors_90d` (worse: lower). `scripts/standing-bands.mjs`,
    deterministic, weekly via the existing launchd loop; on a 2σ breach it
    writes `docs/sdlc/intents/<date>-standing-<id>.intent.md` and opens a PR.

## Gates

- **Locks, shown red first.** `standing-lock.test.ts`: a fixture graph with
  staff and non-staff nodes yields the expected degree, mutual, core reach and
  non-staff rank, and the same fixture with one edge removed changes exactly the
  metrics it should. `nba-lock.test.ts`: a mutual-tie candidate outranks a fresh
  tag pick, a cooldown author scores 0, ordering is stable across runs.
  `series-standing-lock.test.ts`: the source honours the spine contract
  (`id`, `points`, `asOf`) and reports stale past 36 h.
- **In `agents`:** `engage-daily` over a graph fixture proposes the inbound
  commenter first and never proposes a NEVER_AUTO_COMMENT account.
- **Human decisions before ship:** accept this pair; confirm the eight-week
  targets; confirm the top-40 non-staff definition (staff list is
  `lib/people.ts`, `cohort: "forem"`).
- Prerequisite: phases A and B of the truth-and-reach plan merged, so "sent"
  means observed.

## Risks

- **Sample drift masquerading as progress.** A wider crawl raises everyone's
  degree. Mitigated by storing `sample_hash` and comparing ranks only within a
  sample policy; the terminal shows sample size as its own series.
- **Optimising the number into spam.** The ranking rewards new and reciprocal
  ties, which is what a genuine participant does, but any ranking can be
  over-driven. The pace budget and cooldowns are the hard stop and are out of
  scope to loosen.
- **Rate limits during the crawl.** A partial crawl already reports
  `articlesFailed`; a standing row from a partial crawl is written with the
  flag and excluded from bands.
- **Staff dominate the top of the graph.** Non-staff rank is the headline;
  if the staff list is wrong the rank is wrong. It is three names, verified.
- **Comment yield depends on the articles, not the loop.** It is measured here
  and handed to the article reviewers; a flat yield is a writing finding, not
  an engagement one, and the intent says so.
