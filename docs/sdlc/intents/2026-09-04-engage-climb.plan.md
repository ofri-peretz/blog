---
kind: plan
slug: 2026-09-04-engage-climb
opened: 2026-09-04
---

# Plan: one crawl, one table, one page, a weekly row

Intent: [`2026-09-04-engage-climb.intent.md`](./2026-09-04-engage-climb.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Sample | 1,280 articles, 788 authors: platform `top=30` pages 1–5 plus tag pages 1–3 for security, javascript, node and ai | dev.to articles API | 2026-09-04 |
| Our line | rank 151; 15 reactions, 4 comments, 4 articles; 3.8 rx/article | same | 2026-09-04 |
| Thresholds | top 5: 338 · 10: 252 · 20: 170 · 50: 59 · 100: 25 · 200: 8 | same | 2026-09-04 |
| Top 10 | sylwia-lask 659 (4 articles), francistrdev 489 (4), debashish_ghosal 416 (20), kenielzep97 392 (14), xulingfeng 338 (5); top-10 mean 61.6 rx/article | same | 2026-09-04 |
| Existing crawl | `/api/league`: four tags, three pages each, cached 24 h | `apps/engage/src/app/api/league/route.ts` | 2026-09-04 |

## Approach

Extend the existing league crawl with the platform-wide pages, dedupe by
article id, aggregate by author, and derive the thresholds and gaps from the
sorted list. A `/league` page renders it; the home page gets one line. A
weekly row in `engage.db` makes rank a series the control bands can watch.

**Rejected: a composite score.** Reactions are the currency dev.to ranks by;
comments and articles are printed beside it, not blended into it.

## Sequence

1. `lib/league.ts`: `mergeTables` over platform + tag samples; `thresholds`,
   `nextUp`, `articlesToReach` (at our rate and at the top-10 rate).
   Selfcheck pins thresholds and the arithmetic.
2. `/api/league`: platform pages 1–5 added; returns `all` (ranked list),
   `ours`, `thresholds`, `nextUp`, `plan`; writes `league_weekly` once a day.
3. `/league` page: the climb header (level, next milestone, articles needed),
   the five above, the top 20, the per-tag tables. Nav link on the home page.
4. `series-league.ts`: `league.rank` (down is good) and `league.reactions30`.

## Gates

- Selfcheck red before step 1, green after.
- Human: none.

## Risks

- A viral single article moves an author 100 places in a week; the page
  prints articles and reactions per article beside rank for that reason.
