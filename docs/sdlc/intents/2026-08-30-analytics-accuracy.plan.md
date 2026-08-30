---
kind: plan
slug: 2026-08-30-analytics-accuracy
opened: 2026-08-30
---

# Plan: make the blog's numbers trustworthy

Intent: [`2026-08-30-analytics-accuracy.intent.md`](./2026-08-30-analytics-accuracy.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Blog pageviews, August | 323 (149 people) | PostHog SQL, `$host = 'ofriperetz.dev'` | 2026-08-30 |
| Monthly trajectory May→Aug | 160 → 225 → 302 → 323 | same, grouped by month | 2026-08-30 |
| `article:playground_open` | 0 events since 2026-08-27 | PostHog SQL by event name | 2026-08-30 |
| `article:code_copy_click` | 0 events in 30d | same | 2026-08-30 |
| `short_link_click` lifetime | 2026-07-26 → 2026-08-10, then nothing | PostHog SQL grouped by day | 2026-08-30 |
| `short_link_click` identity | `uniq(distinct_id) = 1` on every single day | same | 2026-08-30 |
| Live `/go/` redirect | HTTP 302, correct Location | `curl` against production | 2026-08-30 |
| Live `/go/` capture | 3 test clicks → 0 ingested events | `curl` ×3, then PostHog SQL | 2026-08-30 |
| Per-visitor id fix is on main | yes, PR #160 | `git show origin/main:…/resolver.ts` | 2026-08-30 |
| PR #160 merge date | 2026-08-22 | `git log` | 2026-08-30 |
| `visitor_classified` bot rate | `is_bot: false` on all 234 events | PostHog SQL | 2026-08-30 |

The decisive pair: the redirect works, the capture does not, and the identity
fix landed **twelve days after** ingestion stopped — so #160 is not the cause
and reverting it would fix nothing.

## Approach

Three independent repairs. Only the third has an unknown root cause, so it is
the only one that needs investigation rather than implementation.

**A. Internal-traffic flag (blog-local).** A `?internal=1` visit registers a
PostHog *super property* `is_internal: true`, which posthog-js persists in its
own storage and attaches to every later event, including `$pageview` and
everything in `lib/analytics.ts`. One visit per browser, no per-call-site
changes.

Rejected alternative: IP or PostHog's built-in internal-user filtering. IPs
rotate across our laptop, phone, and any network we work from, and the
built-in filter keys off identified users — we never call `identify`, by
design. A super property is the only option that survives all three.

The property is deliberately **absent** for real readers rather than `false`,
so a query that forgets the filter over-counts strangers instead of silently
hiding them. Failing loud beats failing clean.

**B. Strip the flag from the URL after reading.** A shared or indexed link
carrying `?internal=1` would mark genuine readers internal and quietly delete
them from the dataset.

**C. `short_link_click` outage — diagnose before changing.** The capture runs
inside `after()` and swallows failures into `console.warn`, which is why
twenty silent days were possible. Do not guess at a fix: read the Vercel
runtime logs for `[go] posthog capture failed` first. The two candidates worth
testing are the ingest host (`NEXT_PUBLIC_POSTHOG_HOST` defaulting to the
proxy vs the direct endpoint) and `after()` not running to completion on this
route. Whatever the cause, the outage was undetectable, so the repair has to
include a signal that would have caught it.

## Sequence

A and B are one small change and ship together. C is independent and gated on
reading production logs — it does not block A/B.

1. `InternalTrafficFlag` component, mounted in the app shell. *(done)*
2. Lock: the flag registers a super property, is reversible, and strips the
   parameter. *(next)*
3. Mark our own browsers via `?internal=1`, once each.
4. C: read Vercel logs, identify the ingest failure, repair, and add a
   detector so a future outage is loud.

## Gates

- The lock must fail on a version that registers nothing — verify by removing
  the `register` call before trusting green.
- No change to the playground footer or its promise.
- Item 3 is a human step; the flag does nothing until someone visits the URL.

## Risks

- A super property is per-browser. A device we forget to flag keeps
  contaminating the data, and there is no way to tell from the dashboard. Low
  cost, and better than the current state of no separation at all.
- Historical data cannot be retro-flagged. Every figure before today mixes us
  with readers, so the baselines in the operating memo stay labelled as such.
