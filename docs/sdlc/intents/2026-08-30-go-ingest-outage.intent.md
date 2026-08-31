---
kind: intent
slug: 2026-08-30-go-ingest-outage
opened: 2026-08-30
status: closed
---

# Intent: get `/go/` clicks being recorded again, and make a future outage loud

> **Closed 2026-08-31.** Verified in production, not just in tests: three live
> `/go/` hits produced 5 `short_link_click` rows across **3 distinct ids**, and
> `short_link_capture_failed` never fired. The distinct-id count is its own
> result — PR #160's per-visitor id shipped 2026-08-22 into an already-dead
> pipeline and had never once executed until now. Cause was the relative
> `NEXT_PUBLIC_POSTHOG_HOST`, exactly as hypothesised.

## What

Repair the server-side `short_link_click` capture, which has recorded nothing
since 2026-08-10, and add a signal that would have caught it in days rather
than twenty.

## Why now

Because it is the prerequisite for reading everything else. The dev.to crossing
we just built is measured by exactly this event, so shipping that invitation
without this repair means readers could start crossing and we would never know.

It is also the clearest instance of the Maintain gap: the redirect kept
working, the failure was caught and swallowed into a `console.warn`, and
nothing anywhere said "your highest-volume event stopped".

## Constraints

- **The redirect path must never be delayed or broken by telemetry.** The
  capture runs inside `after()` for that reason and must stay there.
- No raw IP or user-agent may be stored — the existing daily-rotating hash
  stays as the identity mechanism.
- The route is a public redirect endpoint; a detector must not turn it into
  something that can fail a reader's navigation.

## How we will know it worked

- **Tier 3, binary:** a live `curl` of `/go/<slug>` produces a matching
  `short_link_click` row within the ingestion window. Today three hits produced
  zero.
- **Tier 3, identity:** on any day with more than ten clicks,
  `uniq(distinct_id) > 1`. It has been exactly 1 on every day the event ever
  fired, because the fix that changed that shipped after the outage began and
  has never run against live traffic.
- **Detection:** an artificial failure is visible somewhere we look, without
  reading Vercel logs.

## Not doing

- Not moving the capture out of `after()`, and not making it blocking.
- Not building an alerting system. A signal we can see on a dashboard or in a
  Maintain review is enough at this volume; paging on an eleven-view-a-day blog
  would be theatre.
- Not back-filling the twenty dark days. That data is gone and the baselines
  say so.
