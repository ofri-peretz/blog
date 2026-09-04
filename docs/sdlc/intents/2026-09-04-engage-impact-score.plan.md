---
kind: plan
slug: 2026-09-04-engage-impact-score
opened: 2026-09-04
---

# Plan: the Author Impact Score — catalog, arithmetic, one section

Intent: [`2026-09-04-engage-impact-score.intent.md`](./2026-09-04-engage-impact-score.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Arena rank by reactions, 30-day top-300 | #security 20/202, #javascript 28/230, #node 23/205, #ai absent | `/api/articles?tag=&top=30`, 3 pages each, aggregated by author | 2026-09-04 |
| Leaders' 30-day lines | #security kenielzep97 107 rx / 52 cm / 5 arts; #ai debashish_ghosal 411 / 271 / 20; #javascript parsajiravand 192 / 24 / 9 | same | 2026-09-04 |
| Our 30-day lines | #security 11 rx / 4 cm / 3 arts; #javascript 13 / 1 / 3; #node 4 / 1 / 1 | same | 2026-09-04 |
| Readers now | 52–56 views/day, 52 s read time (7 d) | `/api/profile` | 2026-09-04 |
| Resonance now | 1.3 reactions and 0.9 comments per 100 views (30 d); 14-day yield mean 1.0 over 3 closed windows | `/api/profile`, `/api/yield` | 2026-09-04 |
| Standing now | mutual 1, inbound authors 18, core reach 1, reply latency 51.5 h | `/api/standing` | 2026-09-04 |
| Downstream | article→npm lift view exists (`v_article_download_lift`); blog sessions referred by dev.to in the journeys sample: 0 of 60; followers who commented: 2 | Supabase, `/api/journeys`, `/api/profile` | 2026-09-04 |
| Correlation of dev.to views with npm downloads | r = −0.33 (n = 23) — no measurable lift yet | `/api/correlate` | 2026-09-04 |

## The catalog

Score per metric: `clamp((value − floor) / (target − floor), 0, 1)`; for
"down" metrics the floor is the bad end. Pillar = mean of its metrics × 20.
Score = sum of pillars, 0–100. Targets are hypotheses from the leaders and the
shipped intents; each is one line in `lib/impact-score.ts` and nowhere else.

| Pillar | Metric | Source | Floor → target | Now | Why this target |
| --- | --- | --- | --- | --- | --- |
| Readers | views per day, 7-day mean | `devto_daily_analytics` | 20 → 200 | 56 | a top-300 author's article alone draws ~200/day in its first days |
| Readers | average read time, seconds, 7 days | same | 30 → 120 | 52 | lifetime average is 250 s; 120 s is half a real read |
| Resonance | comments per 100 views, 30 days | same | 0 → 2.0 | 0.9 | leaders' comments are a third of reactions; at 4 rx/100 that is ~1.5–2 |
| Resonance | reactions per 100 views, 30 days | same | 0.5 → 4.0 | 1.3 | leaders' articles earn 4–8/100 |
| Resonance | first-14-day comment yield, mean over closed windows, 30 days | `comment_yield` | 0 → 1.5 | 1.0 | comment-yield intent target |
| Standing | mutual ties | `standing` | 0 → 15 | 1 | standing intent target |
| Standing | distinct inbound authors, 90 days | `standing` | 5 → 40 | 18 | standing intent target |
| Standing | core reach (mutual with top-40 non-staff) | `standing` | 0 → 5 | 1 | standing intent target |
| Standing | reply latency, median hours (down) | `standing` | 168 → 24 | 51.5 | reply-latency intent target |
| Arena | rank percentile among top-300 authors, mean over #security #javascript #node #ai | 30-day crawl | 0 → 0.95 | 0.66 (absent = 0 in #ai) | top 5% = the top ten names |
| Arena | home tags present in the top 300 | same | 0 → 4 of 4 | 3 | absence is the strongest signal we have |
| Downstream | article→npm download lift, median %, 30 days | `v_article_download_lift` | 0 → 20 | unmeasured | the north star's own view |
| Downstream | blog sessions referred by dev.to, 30 days | `/api/journeys` | 0 → 50 | 0 | dev.to sends nothing today; any is progress |
| Downstream | followers who ever commented | `devto_followers` × `devto_comments` | 2 → 20 | 2 | the honest proxy for followers who read |

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
