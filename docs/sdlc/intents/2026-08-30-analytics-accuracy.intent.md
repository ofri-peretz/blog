---
kind: intent
slug: 2026-08-30-analytics-accuracy
opened: 2026-08-30
status: open
---

# Intent: make the blog's numbers trustworthy before we optimise anything with them

## What

Repair the three things that make current blog analytics unsafe to decide
from: our own traffic is indistinguishable from readers', the highest-volume
event has been dark for twenty days, and that event never carried a usable
identity even when it worked.

## Why now

Because every other initiative on the board wants to be evaluated by these
numbers, and right now they cannot carry that weight. The August baseline
reads 323 pageviews from 149 people, with `loom:weave_change` at 52 events
across 2 people — almost certainly us. At this volume a single internal
browser is a visible fraction of every metric, so "did readers like it?"
and "did Ofri click it?" currently have the same answer shape.

Doing this first is not tidiness. Optimising a funnel measured by a broken
instrument produces confident, wrong conclusions faster than doing nothing.

## Constraints

- **The playground privacy promise is load-bearing.** The footer says nothing
  the reader types leaves the page. Nothing here may weaken it, and aggregate
  rule-fire telemetry stays off the table without an explicit decision and a
  footer that says so plainly.
- `.interlace/components/analytics/*` is auto-generated from the agents repo;
  local edits are overwritten. Anything new ships blog-local.
- One shared PostHog project (428927) serves six properties, so every new
  property must be scoped by `app` / `$host` or it pollutes the others.

## How we will know it worked

- **Tier 3, prerequisite:** `short_link_click` produces events again, with
  `uniq(distinct_id) > 1` on any day with more than ten clicks. Today it is
  literally 1, and has been for every day it ever fired.
- **Tier 3, quality:** every reported figure can be filtered by
  `is_internal != true`, and a query run with and without that filter differs
  on at least one of our own known browsing sessions — proving the flag is
  actually attaching.

Both are pass/fail counts, not rates, which is the right shape at this volume.

## Not doing

- No new reader-facing telemetry. This initiative only makes existing signals
  honest; it adds no new observation of readers.
- Not fixing the Dev.to→blog crossing *rate* yet — that needs traffic, not
  instrumentation, and belongs to the distribution initiative.
- Not touching bot classification for client events. `visitor_classified`
  reports `is_bot: false` for all 234 August events, which is expected: it is
  a client-side event and crawlers largely do not run JS. The bot problem
  lives on server routes.
