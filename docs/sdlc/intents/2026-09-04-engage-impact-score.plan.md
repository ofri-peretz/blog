---
kind: plan
slug: 2026-09-04-engage-impact-score
opened: 2026-09-04
---

# Plan: the Author Impact Score — catalog, arithmetic, one section

Intent: [`2026-09-04-engage-impact-score.intent.md`](./2026-09-04-engage-impact-score.intent.md)

## Ground truth

| Claim                                          | Value                                                                                                                                                  | Source                                                          | Read on    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------- |
| Arena rank by reactions, 30-day top-300        | #security 20/202, #javascript 28/230, #node 23/205, #ai absent                                                                                         | `/api/articles?tag=&top=30`, 3 pages each, aggregated by author | 2026-09-04 |
| Leaders' 30-day lines                          | #security kenielzep97 107 rx / 52 cm / 5 arts; #ai debashish_ghosal 411 / 271 / 20; #javascript parsajiravand 192 / 24 / 9                             | same                                                            | 2026-09-04 |
| Our 30-day lines                               | #security 11 rx / 4 cm / 3 arts; #javascript 13 / 1 / 3; #node 4 / 1 / 1                                                                               | same                                                            | 2026-09-04 |
| Readers now                                    | 52–56 views/day, 52 s read time (7 d)                                                                                                                  | `/api/profile`                                                  | 2026-09-04 |
| Resonance now                                  | 1.3 reactions and 0.9 comments per 100 views (30 d); 14-day yield mean 1.0 over 3 closed windows                                                       | `/api/profile`, `/api/yield`                                    | 2026-09-04 |
| Standing now                                   | mutual 1, inbound authors 18, core reach 1, reply latency 51.5 h                                                                                       | `/api/standing`                                                 | 2026-09-04 |
| Downstream                                     | article→npm lift view exists (`v_article_download_lift`); blog sessions referred by dev.to in the journeys sample: 0 of 60; followers who commented: 2 | Supabase, `/api/journeys`, `/api/profile`                       | 2026-09-04 |
| Correlation of dev.to views with npm downloads | r = −0.33 (n = 23) — no measurable lift yet                                                                                                            | `/api/correlate`                                                | 2026-09-04 |

## Approach

One definition as data. The catalog below is the whole contract: a metric is
a row, a target is a number in that row, and the arithmetic never changes.

**Rejected: fitting weights to history.** A score that learns what moved
last month cannot be held to anything. **Rejected: including followers.**
99% of resolved follower accounts were created the day they followed.

### The catalog

Score per metric: `clamp((value − floor) / (target − floor), 0, 1)`; for
"down" metrics the floor is the bad end. Pillar = mean of its metrics × 20.
Score = sum of pillars, 0–100. Targets are hypotheses from the leaders and the
shipped intents; each is one line in `lib/impact-score.ts` and nowhere else.

The catalog — every metric, its source, floor, target and why — is the table in
[`2026-09-04-engage-impact-score.intent.md`](./2026-09-04-engage-impact-score.intent.md)
under "The catalog"; `lib/impact-score.ts` mirrors it one row per entry.

## Sequence

1. `lib/impact-score.ts` (pure): the catalog as data, `scoreMetric`,
   `scorePillar`, `scoreImpact(inputs)`; `impact-score.selfcheck.ts` pins the
   clamp, the direction handling, "absent = 0", and that a change in one input
   moves exactly one pillar.
2. `lib/league.ts` + `/api/league`: the 30-day top-300 crawl per home tag,
   aggregated by author, cached 24 h, with our rank, percentile and the five
   names above us with their lines.
3. `/api/impact`: assembles inputs from profile, standing, yield, league,
   Supabase lift, journeys; writes today's row to `engage.db` `impact_score`
   (score + five pillars); returns the full breakdown.
4. `series-impact.ts`: `impact.score` and the five pillars in the terminal.
5. Home page: "Impact score" section at the top — the number, five pillar
   bars, and a table of all 14 metrics with value, floor, target and points.
6. The loop's daily check calls `/api/impact` after `/api/prs`.

## Gates

- Selfcheck red before step 1 (no module), green after.
- `/api/impact` prints 14 metrics with a source each; none reads a follower total.
- Human: read the targets once and object to any that is wrong. They are
  hypotheses and the file says so.

## Risks

- The arena crawl is sample-bound (top 300 per tag); a great article outside
  those pages is invisible. Documented; the crawl width is one constant.
- Downstream lift has no measurable signal yet (r = −0.33); the pillar will
  read low until the funnel exists, which is honest and the point.
