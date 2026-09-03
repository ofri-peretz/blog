---
kind: intent
slug: 2026-09-02-engage-truth-and-reach
opened: 2026-09-02
status: shipped
---

# Intent: every draft the control room offers ends in a verified action or a logged decision, and nothing waits on Ofri's memory

## What

`apps/engage` (the control room on :7777) becomes the **only** engagement surface,
its "sent" state becomes a verified fact rather than "tab opened", and the two
highest-decay worklists it already shows — replies waiting and the open stream —
get an owner other than Ofri's memory: an always-on process, a reconciler, and a
notification when the reply inbox is non-empty. The agents keep every step except
the click. The click stays human.

## Why now

Three things were true on 2026-09-02, all read off the running app and its files
(commands in the plan's ground truth):

- **Two hubs write two ledgers.** A legacy single-file hub
  (`agents/footprint/scripts/engage-hub.ts`, also on :7777) still exists and still
  works. It writes `.devto-engaged.json`; the control room writes `engage.db`. The
  control room's ledger shows its last action on **2026-08-26**; the four items
  marked today went through the legacy hub. The partnership table, the pace gauges
  and "actions today" each read only one of the two, so none of them is right.
- **32 replies are waiting, all drafted.** The app's own header comment calls a
  reply "the highest-decay signal in this whole system: the window is hours". The
  oldest visible one is from 2026-08-30. Nothing notifies when the inbox is
  non-empty; the only trigger is opening the page.
- **"Sent" still means "tab opened".** `act("done")` sets `posted` the moment the
  tab opens, the edited textarea is copied to the clipboard but never sent to the
  server, and nothing ever checks Dev.to for the comment. The conversion column and
  the 66% comment / 41% reaction figures are built on that.

Two more, found after this intent was first drafted: the checkout on this Mac was
three engage commits behind `origin/main`, so the screen showed less than the
repo had; and fifteen engage commits from 2026-08-23 (customer monitor, live PR
tracker, alerts, vulnerability ledger) sit unmerged on `fix/exclude-automated-traffic`.
Both are the same defect as the two ledgers: what exists and what is visible
have drifted apart.

Smaller, but each one costs a page load or a number: the home page pays 11–14 s on
every refresh because `releaseQueue()` bypasses the disk cache the other pages
use; the app's `todayCST()` returns the UTC date of the Chicago wall clock, so
after 19:00 CDT "today" is tomorrow and disagrees with the generator in `agents`;
the daily digest drops `reminded` items from every column; the stall budget for
the npm series is 36 h against a source that lags two days, so 38 false alerts sit
above "Up next"; and there is no launchd entry, so the app is up only while a
terminal is.

## Constraints

- **The app never posts.** Dev.to removed api-key writes for comments and reactions.
  No session cookies, no browser automation. The curator model is a fact.
- **Anti-bot rules are unchanged**: the pace budget in `lib/safety.ts`, and
  NEVER_AUTO_COMMENT, cooldowns, off-days and volume weights in `agents/footprint`.
- **Local only, read-only against Supabase and PostHog.** Binds 127.0.0.1, no auth,
  never deployed. The impact pipeline stays owned by the daily-ingest session.
- **Queue files stay the source of truth for what is pending; `engage.db` is the
  accumulator.** Schema changes to either are additive; old files stay readable.
- **Pre-compute, never compute on click.** Every model call runs in the batch job
  and writes a file the app reads. One explicit, spinner-guarded exception is allowed.
- **Never re-derive a number that has an owner.** Schedule comes from
  `publish-next --json`; the fix for its latency is caching, not a second
  implementation.
- **No guessed author scores.** `lib/people.ts` already asserts membership from
  checkable facts; that rule extends to anything new.

## How we will know it worked

All Tier-4 operational data, read from files this repo already owns. Counts, not
rates, except where the denominator is above 100.

| Signal | Source | Now | Counts as evidence |
| --- | --- | --- | --- |
| Replies waiting, undrafted or unanswered | `GET /api/threads` | 32 | ≤ 5 at any daily check for 14 days |
| Median hours from their reply to ours | `engage.db` `threads` + reconciler | unmeasured | < 24 h over 30 days |
| Items in `opened` older than 48 h | reconciler report | n/a (state does not exist) | 0 |
| Comments verified live vs marked done | reconciler | 0 verified | ≥ 85% of `done` in 4 weeks |
| Ledgers in use | `.devto-engaged.json` mtime, `engage.db` | 2 | 1 |
| `GET /api/state` wall time, warm | `curl -w %{time_total}` | 11.4–13.9 s | < 500 ms |
| App reachable when the Mac is up | healthcheck | no check | 100% of checks, 14 days |
| Digest columns sum to the queue total | `engage-digest.ts` output | no | every day |

## Not doing

- Automated posting, or any path that mints a Dev.to session.
- Re-queuing expired items with fresh drafts; if the expired count is large, that is
  its own intent.
- Touching the network, series, terminal, conquest, journeys or calendar pages.
  They answer different questions and are not the leak.
- Moving the app off the laptop.
- The terminal reviewer `engage-review.ts` stays as the offline fallback.
