---
kind: plan
slug: 2026-09-04-engage-levers
opened: 2026-09-04
---

# Plan: rank correlation over the owner article list and the snapshots

Intent: [`2026-09-04-engage-levers.intent.md`](./2026-09-04-engage-levers.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Owner article list | 85 published; fields include body_markdown, tag_list, reading_time_minutes, published_at, page_views_count, comments_count, public_reactions_count | `/api/articles/me/published?per_page=100` | 2026-09-04 |
| Per-article daily snapshots | cumulative views/reactions/comments per article per day since 2026-05-31; 5,177 rows, 85 slugs | `article_daily_snapshots` where source='devto' | 2026-09-04 |
| Reviewer score vs comments | r = −0.04, n = 74 | `/api/yield` calibration | 2026-09-03 |

## Approach

Pure functions over two lists. Features are extracted from the article
record; outcomes from the snapshots, taking the value at the first day at or
after publish + 14 minus the value at publish. Spearman rank correlation for
numeric features, mean difference with a sign for boolean features. Cached
six hours; the section prints only levers with n ≥ 20 and |r| ≥ 0.2, and
prints the caveat in the header.

**Rejected: a regression with all features.** 85 rows and a dozen features is
a fit, not a finding. **Rejected: lifetime views as the outcome.** Age
dominates it; the 14-day window is the like-for-like.

## Sequence

1. `lib/levers.ts`: `features(article)`, `outcome14(snapshots)`, `spearman`,
   `levers(articles, snapshots)`; `levers.selfcheck.ts` pins spearman on a
   known pair and the windowing on a fixture.
2. `/api/levers`: owner list + snapshots, cached 6 h, `?refresh=1`.
3. Home page: "What drives what" section under the impact score, three
   columns, one row per lever above threshold.

## Gates

- Selfcheck red before step 1, green after.
- Human: none; this measures.

## Risks

- 85 articles, 30 with closed 14-day windows: coefficients will be noisy;
  the threshold and the printed n are the guard.
