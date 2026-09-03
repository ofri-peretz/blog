---
kind: intent
slug: 2026-09-03-engage-one-data-plane
opened: 2026-09-03
status: shipped
---

# Intent: the engagement loop runs from `main`, with one hub and one ledger

## What

The launchd loop that drafts, reminds, reconciles and notifies executes code
from a clean checkout of `main` that updates itself, while the data it works on
(queues, `engage.db`, reply drafts, network cache) stays exactly where it is.
Nothing in the loop runs from a working tree with uncommitted edits. The legacy
single-file hub is decommissioned, and every panel in the control room reads
one ledger.

## Why now

Read on 2026-09-03 while executing the two previous intents.

- The live checkout at `~/repos/ofriperetz.dev/agents` runs the loop from branch
  `chore/content-focus-h2-2026`: 49 commits ahead of `origin/main` on
  `footprint/scripts`, 27 behind, with 392 uncommitted lines across
  `_engage-lib.ts`, `engage-daily.ts`, `engage-run.sh`, `publish-next.ts`, and
  77 untracked files. A dry-run merge of `main` reports 15 committed conflicts.
- Three merged PRs (#145, #146, #147) had to be overlaid onto that tree per
  file with `patch --fuzz=3`, because `git apply --3way` aborts when the index
  does not match. One overlay was silently applied to the wrong directory by a
  background job and had to be redone. That is not a process; it is luck.
- `engage-run.sh` on `main` already self-heals a stale, clean `main` with
  `git pull --ff-only` (PR #143). The mechanism exists; the loop simply is not
  on a tree it can act on.
- The legacy hub (`footprint/scripts/engage-hub.ts`, untracked) still binds
  :7777 when run and writes `.devto-engaged.json`; the control room writes
  `engage.db`. Four items were marked through the legacy path on 2026-09-03.

## Constraints

- **The user's in-progress branch is not mine to resolve.** No merge, rebase, or
  commit on `chore/content-focus-h2-2026`. The loop moves; the branch stays.
- **Data does not move.** Queue files, `engage.db`, `reply-drafts.json`,
  `network-graph.json`, `.env` and `../.env.local` stay in the live footprint
  directory. The code reads them through one root, configurable by environment.
- **launchd stays the scheduler**, one entry per job, installed by
  `engage-install.sh`. No new daemon, no cron.
- **Reversible in one step**: reinstalling the previous plist puts the loop back
  on the old tree.
- **Only the engage loop and the app keepalive move** in this intent. The
  publish, adopters and social-watcher jobs keep their current tree until
  their own scripts are audited for `__dirname` paths.

## How we will know it worked

| Signal | Now | Target |
| --- | --- | --- |
| Checkout the loop executes from | dirty feature branch | `main`, `git status` clean, self-updating |
| Overlays needed to activate a merged PR | one per file, by hand | 0 |
| Engage scripts with a `__dirname`-relative data path outside the shared root | unaudited | 0 (pinned by a selfcheck) |
| Ledgers written by any running surface | 2 | 1 (`engage.db`) |
| Processes that can bind :7777 | 2 (app, legacy hub) | 1 |

## Not doing

- Resolving or committing the chore branch's work.
- Moving `publish-next`, adopters or social-watcher jobs (own intent, after audit).
- Deleting the untracked legacy hub file; decommissioning means nothing runs it.
