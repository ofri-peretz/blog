---
kind: intent
slug: 2026-09-03-engage-freshness
opened: 2026-09-03
status: shipped
---

# Intent: every number on screen says when its source was read, and a stale build cannot pass as healthy

## What

Each section of the control room shows two times: when the page last fetched
it, which it already shows, and when the *source* was last read — the crawl,
the ingest row, the GitHub sweep. Where a route has no source time, the header
says nothing rather than implying freshness. Separately, the keepalive that
holds the app up also checks that the page it serves carries the design-system
tokens, and restarts the app when it does not, because that failure produced a
convincing wrong page for an hour today with every signal green.

## Why now

Three incidents on 2026-09-02/03, all the same defect: a number with no
provenance on screen.

- A stale Turbopack build served the pre-design-system palette after a pull.
  Fast Refresh reported success on every rebuild; the smoke passed against a
  fresh server. Nothing looked at what was actually being served.
- The Impact chart read "not updated" because its last row was yesterday's
  09:20 UTC ingest while the strip above it showed the live count. Fixed for
  that one panel; the other twenty say "3m ago" and mean the fetch, not the source.
- Thirty-eight stall alerts for npm series sat above the queue for weeks
  because a 36-hour budget was applied to a source that lags two days. The
  budget is 72 h now; nothing measures whether alerts are true.

Measured 2026-09-03: of 17 refreshable sections, 9 have a source timestamp in
their API response (`asOf`, `fetchedAt`, `cachedAt`, `day`) and none of them
show it. The other 8 have no source time at all.

## Constraints

- Show what is known; invent nothing. A route without a source time gets no
  stamp, not a fetch time relabelled as one.
- The served-page check reads the real stylesheet the app serves and looks for
  the harbor theme token, the same assertion the smoke makes. It restarts the
  app through launchd only; it never edits files.
- No new dependencies, no new panel.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Sections with a source time in the API that print it | 0 of 9 | 9 of 9 |
| Served stylesheet checked for design tokens by the keepalive | never | hourly, with an automatic restart on failure, logged |
| Stall alerts that are false on inspection, 14-day window | 38 last week | 0 |
| Time a stale build can be served unnoticed | ~1 h observed | ≤ 1 h by construction, and logged when it happens |

## Not doing

- Adding source times to routes that have none by guessing from file mtimes.
- Changing stall budgets again; measuring first.
- Any change to the design system itself.
