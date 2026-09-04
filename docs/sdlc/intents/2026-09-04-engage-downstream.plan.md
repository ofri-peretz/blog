---
kind: plan
slug: 2026-09-04-engage-downstream
opened: 2026-09-04
---

# Plan: fix the three instruments where each lives

Intent: [`2026-09-04-engage-downstream.intent.md`](./2026-09-04-engage-downstream.intent.md)

## Ground truth

| Claim             | Value                                                                                                                                                                            | Source                                 | Read on    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- |
| Downstream pillar | 0 of 20; npm lift unmeasured, dev.to sessions 0, followers who commented 2 of 20 distinct commenters                                                                             | `/api/impact`                          | 2026-09-04 |
| Lift writer       | matches a plugin only when a tag equals a plugin slug; the last twelve articles are tagged eslint, security, webdev, javascript, ai; zero rows in `v_article_download_lift` ever | impact-ingest `daily-ingest.ts` step 4 | 2026-09-04 |
| Download series   | `plugin_daily_metrics` holds d1 downloads per plugin since 2025-12-01, 7,265 rows                                                                                                | Supabase                               | 2026-09-04 |
| dev.to clicks     | 1,192 `short_link_click` events with `utm_source=devto` in 30 days, all flagged bot; the event carries no user agent                                                             | PostHog HogQL and `go/resolver.ts`     | 2026-09-04 |
| dev.to referrer   | dev.to strips referrers; pageviews tagged devto: 1 in 90 days; blog direct sessions 229 in 30 days                                                                               | PostHog HogQL                          | 2026-09-04 |
| Session counter   | `/api/impact` reads `/api/journeys` at its 7-day default; referrers there are tallied from the 60 deepest sessions                                                               | `api/journeys/route.ts`                | 2026-09-04 |

## Approach

Three small fixes at the source of each number, and one panel.

**Lift.** Pull step 4 out of the ingest monolith into `article-lift.ts` with
pure functions: match a plugin by its name or slug appearing in the article
title, description or tags, else fall back to the ecosystem sum of d1 across
published plugins; lift is the seven-day mean after over the seven before.
The row keeps the slug as dimension and carries scope, pre and post in the
payload. A runner backfills 120 days once; the daily ingest calls the same
function.

**Classification.** `buildClickEventBody` gains the visitor user agent as
`$raw_user_agent`, the property PostHog's bot detection reads. The route
passes the request header through.

**Counter.** `devtoSessions30()` in `lib/sources.ts`: distinct human sessions
over 30 days tagged devto or referred by dev.to, plus the human and bot
click counts. `/api/impact` uses it and returns a `downstream` object with
the lifts, the clicks and the sessions.

**Rejected: computing lift in the app.** The warehouse is the one writer and
the view already exists; the app reads.

## Sequence

1. impact-ingest: `scripts/article-lift.ts` with `matchPlugin`, `liftPct`,
   `computeArticleLifts`; `article-lift.check.ts` in `npm run check`;
   `daily-ingest.ts` step 4 calls it; `npm run lift -- --since-days 120`.
   Run the backfill, verify rows in `v_article_download_lift`, PR, merge.
2. blog: `$raw_user_agent` on the click event; test in `go-resolver.test.ts`.
3. engage: `devtoSessions30()`; `/api/impact` reads it and the lift rows with
   payload; the impact panel renders the downstream block.
4. `/api/impact?refresh=1` shows three of three measured.

## Gates

- `npm run check` in impact-ingest red before step 1's matcher, green after.
- `vitest run go-resolver` red before step 2, green after.
- The hygiene lock and `npm run selfcheck` green.
- Human: none. Merges on green checks.

## Risks

- The ecosystem fallback dilutes a plugin-specific effect; the scope is
  printed beside every lift so the reader knows which one they see.
- Reclassification changes only events from now on; the 30-day human count
  reads low for a month and the panel says since when.
