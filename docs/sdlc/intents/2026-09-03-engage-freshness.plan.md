---
kind: plan
slug: 2026-09-03-engage-freshness
opened: 2026-09-03
---

# Plan: a source stamp on every header, and a served-page check in the keepalive

Intent: [`2026-09-03-engage-freshness.intent.md`](./2026-09-03-engage-freshness.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
| --- | --- | --- | --- |
| Refreshable sections on the home page | 17 `<Refresh>` headers | `grep -c "<Refresh onClick" app/page.tsx` | 2026-09-03 |
| Routes with a source time | threads `asOf`, standing `graphFetchedAt`, yield `cachedAt`, prs `asOf`, board `cachedAt`, people `cachedAt`, alerts `at`, benchmark `day`, network `fetchedAt` | curl of each route, keys filtered for asOf/fetched/cached/day | 2026-09-03 |
| Routes with none | insights, sources, trends, correlate, ecosystem, articles, audience, plugins | same | 2026-09-03 |
| What the header shows today | fetch time only ("3m ago") | `components/panels.tsx` `Refresh` | 2026-09-03 |
| Stale-build incident | served CSS had no harbor token for ~1 h; HMR reported success | session log 2026-09-03 | 2026-09-03 |
| Existing served-page assertion | `smoke.mjs`: "DS brand layer is loaded", "Harbor theme is loaded" — run manually or in CI against a fresh server | `apps/engage/scripts/smoke.mjs` | 2026-09-03 |
| Keepalive and ping | `com.ofri.engage-app` (KeepAlive); `engage-inbox-notify --ping` GETs `/api/threads` | agents `footprint/launchd`, `scripts/engage-inbox-notify.ts` | 2026-09-03 |

## Approach

Two small changes on the two sides that already own the concern. The `Refresh`
header gets an optional `source` and prints "source 2h ago" beside the fetch
time when the section passes one; nine sections pass the field their API
already returns. The loop's `--ping` fetches `/` and its stylesheet and asserts
the harbor token; with `--heal` it kickstarts the keepalive job when the token
is missing, once per hour from `engage-run.sh auto`, logged.

**Rejected: stamping the eight routes without a source time from file mtimes.**
A mtime is when a cache was written, not when the source was read.

**Rejected: putting the served-page check in the app.** The app cannot see
what a stale Turbopack cache serves of itself; an outside GET can.

## Sequence

1. `Refresh` accepts `source?: string | number | null` and renders it as a
   relative time with the ISO value in the title. Nine headers pass it.
2. `/api/insights` gains `asOf` (it is live); `/api/sources` gains `asOf` from
   the newest `observed_on` in its impact rows. Both headers pass it.
3. `engage-inbox-notify.ts --ping`: also GET `/`, find the stylesheet link,
   GET it, assert `harbor`; print `ok · tokens` or `STALE BUILD`. `--heal`
   runs `launchctl kickstart -k gui/<uid>/com.ofri.engage-app` on a stale
   build and logs it.
4. `engage-run.sh auto`: once per hour in business hours,
   `engage-inbox-notify.ts --ping --heal` (state file `ping-YYYY-MM-DD-HH`).
5. Weekly: `engage-status --week` prints the number of stale-build heals.

## Gates

- Selfcheck for the stamp formatting (a source older than 24 h prints days,
  null prints nothing).
- Manual: serve a page with the token removed (rename the harbor import
  locally) and watch `--ping --heal` restart the job; restore.
- Human: none.

## Risks

- A kickstart mid-click restarts the app under someone; the check runs hourly
  and only on a confirmed missing token, which is already a broken page.
