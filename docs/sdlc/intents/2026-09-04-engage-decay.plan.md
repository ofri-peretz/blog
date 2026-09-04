---
kind: plan
slug: 2026-09-04-engage-decay
opened: 2026-09-04
---

# Plan: three points on each curve, two shares, one class

Intent: [`2026-09-04-engage-decay.intent.md`](./2026-09-04-engage-decay.intent.md)

## Ground truth

| Claim     | Value                                                                       | Source                    | Read on    |
| --------- | --------------------------------------------------------------------------- | ------------------------- | ---------- |
| Snapshots | 5,262 rows since 2026-05-31, cumulative views per article per day           | `article_daily_snapshots` | 2026-09-04 |
| Windows   | 40 articles have a closed 14-day window starting within two days of publish | `/api/levers`             | 2026-09-04 |
| Referrers | profile-wide only, cumulative                                               | `devto_referrers_daily`   | 2026-09-04 |

## Approach

`lib/decay.ts`: from an article's sorted snapshots take the first row at
or after publish plus three days, plus fourteen days, and the latest row;
the two shares are differences over the latest total; the current rate is
the latest total minus the total fourteen days earlier over fourteen. The
class follows the thresholds. `/api/decay` reads our articles as the levers
route does and the snapshots paged, and returns per-article rows plus the
summary. The panel shows the split and the evergreen list.

**Rejected: fitting a decay constant.** Three points and two shares answer
the question a person asks; an exponent would be printed and not read.

## Sequence

1. `lib/decay.ts` with selfcheck: shares, rate, classes, the two-day start rule.
2. `/api/decay`, cached six hours.
3. Home page panel "How articles age" and a nav link, once the open panels land.

## Gates

- Selfcheck red before step 1, green after.
- `tsc`, hygiene lock, `npm run selfcheck` green.
- Human: none.

## Risks

- Young articles have no day-fourteen point; they are listed as "too young" rather than classed.
